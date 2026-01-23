import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  checkMilkRevenueSync, 
  checkWeightSync, 
  checkStatsConsistency, 
  checkValuationConsistency,
  IntegrityCheckResult 
} from "@/test-utils/data-integrity-helpers";
import { toast } from "sonner";

export interface FarmInfo {
  farm_id: string;
  farm_name: string;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
  animal_count: number;
  last_activity: string | null;
}

export interface FarmIntegrityResult {
  farmId: string;
  farmName: string;
  ownerEmail: string | null;
  ownerName: string | null;
  animalCount: number;
  checks: IntegrityCheckResult[];
  passedCount: number;
  failedCount: number;
  status: 'healthy' | 'warning' | 'critical';
  lastScanned: Date;
}

export interface ScanProgress {
  current: number;
  total: number;
  currentFarm: string | null;
}

const BATCH_SIZE = 5;

export function useIntegrityScan() {
  const [results, setResults] = useState<FarmIntegrityResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>({ current: 0, total: 0, currentFarm: null });
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-refresh effect
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefreshInterval && autoRefreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        scanAllFarms();
      }, autoRefreshInterval * 60 * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefreshInterval]);

  const fetchAllFarms = useCallback(async (): Promise<FarmInfo[]> => {
    // @ts-ignore - RPC was just created and types haven't regenerated
    const { data, error } = await supabase.rpc('get_all_farms_for_integrity_check');
    
    if (error) {
      console.error('Error fetching farms:', error);
      throw new Error(`Failed to fetch farms: ${error.message}`);
    }
    
    return (data || []) as unknown as FarmInfo[];
  }, []);

  const runChecksForFarm = useCallback(async (farmId: string): Promise<IntegrityCheckResult[]> => {
    const today = new Date().toISOString().split('T')[0];
    
    // Run database-based integrity checks (skip cache checks for admin)
    const [milkRevenue, weightSync, statsConsistency, valuation] = await Promise.all([
      checkMilkRevenueSync(farmId),
      checkWeightSync(farmId),
      checkStatsConsistency(farmId, today),
      checkValuationConsistency(farmId)
    ]);

    return [milkRevenue, weightSync, statsConsistency, valuation];
  }, []);

  const scanAllFarms = useCallback(async () => {
    if (isScanning) return;
    
    setIsScanning(true);
    setResults([]);
    
    try {
      const farms = await fetchAllFarms();
      setProgress({ current: 0, total: farms.length, currentFarm: null });

      const allResults: FarmIntegrityResult[] = [];

      // Process farms in batches
      for (let i = 0; i < farms.length; i += BATCH_SIZE) {
        const batch = farms.slice(i, i + BATCH_SIZE);
        
        const batchResults = await Promise.all(
          batch.map(async (farm) => {
            setProgress(prev => ({ ...prev, currentFarm: farm.farm_name }));
            
            try {
              const checks = await runChecksForFarm(farm.farm_id);
              const passedCount = checks.filter(c => c.passed).length;
              const failedCount = checks.filter(c => !c.passed).length;
              
              let status: 'healthy' | 'warning' | 'critical' = 'healthy';
              if (failedCount >= 3) status = 'critical';
              else if (failedCount >= 1) status = 'warning';

              return {
                farmId: farm.farm_id,
                farmName: farm.farm_name,
                ownerEmail: farm.owner_email,
                ownerName: farm.owner_name,
                animalCount: farm.animal_count,
                checks,
                passedCount,
                failedCount,
                status,
                lastScanned: new Date()
              } as FarmIntegrityResult;
            } catch (error) {
              console.error(`Error scanning farm ${farm.farm_name}:`, error);
              return {
                farmId: farm.farm_id,
                farmName: farm.farm_name,
                ownerEmail: farm.owner_email,
                ownerName: farm.owner_name,
                animalCount: farm.animal_count,
                checks: [],
                passedCount: 0,
                failedCount: 0,
                status: 'warning' as const,
                lastScanned: new Date()
              };
            }
          })
        );

        allResults.push(...batchResults);
        setProgress(prev => ({ ...prev, current: i + batch.length }));
        setResults([...allResults]);
      }

      setLastScanTime(new Date());
      toast.success(`Scanned ${farms.length} farms successfully`);
    } catch (error) {
      console.error('Error during scan:', error);
      toast.error('Failed to complete integrity scan');
    } finally {
      setIsScanning(false);
      setProgress({ current: 0, total: 0, currentFarm: null });
    }
  }, [isScanning, fetchAllFarms, runChecksForFarm]);

  const scanSingleFarm = useCallback(async (farmId: string) => {
    try {
      const checks = await runChecksForFarm(farmId);
      const passedCount = checks.filter(c => c.passed).length;
      const failedCount = checks.filter(c => !c.passed).length;
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (failedCount >= 3) status = 'critical';
      else if (failedCount >= 1) status = 'warning';

      setResults(prev => prev.map(r => 
        r.farmId === farmId 
          ? { ...r, checks, passedCount, failedCount, status, lastScanned: new Date() }
          : r
      ));

      toast.success('Farm rescanned successfully');
    } catch (error) {
      console.error('Error scanning farm:', error);
      toast.error('Failed to scan farm');
    }
  }, [runChecksForFarm]);

  const fixWeightSync = useCallback(async (farmId: string, farmName: string) => {
    try {
      // @ts-ignore - RPC was just created
      const { data, error } = await supabase.rpc('fix_animal_weights', { p_farm_id: farmId });
      
      if (error) throw error;

      const result = data as { success: boolean; fixed_count: number };
      
      // @ts-ignore - Table was just created
      await supabase.from('integrity_fix_log').insert({
        farm_id: farmId,
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        fix_type: 'weight_sync',
        items_fixed: result.fixed_count,
        details: { farm_name: farmName }
      });

      toast.success(`Fixed ${result.fixed_count} animal weights`);
      await scanSingleFarm(farmId);
    } catch (error) {
      console.error('Error fixing weights:', error);
      toast.error('Failed to fix weight sync');
    }
  }, [scanSingleFarm]);

  const fixMilkRevenue = useCallback(async (farmId: string, farmName: string) => {
    try {
      // @ts-ignore - RPC was just created
      const { data, error } = await supabase.rpc('fix_missing_milk_revenues', { p_farm_id: farmId });
      
      if (error) throw error;

      const result = data as { success: boolean; fixed_count: number };
      
      // @ts-ignore - Table was just created
      await supabase.from('integrity_fix_log').insert({
        farm_id: farmId,
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        fix_type: 'milk_revenue',
        items_fixed: result.fixed_count,
        details: { farm_name: farmName }
      });

      toast.success(`Created ${result.fixed_count} missing revenue entries`);
      await scanSingleFarm(farmId);
    } catch (error) {
      console.error('Error fixing milk revenue:', error);
      toast.error('Failed to fix milk revenue sync');
    }
  }, [scanSingleFarm]);

  const fixValuations = useCallback(async (farmId: string, farmName: string) => {
    try {
      // @ts-ignore - RPC was just created
      const { data, error } = await supabase.rpc('fix_valuation_calculations', { p_farm_id: farmId });
      
      if (error) throw error;

      const result = data as { success: boolean; fixed_count: number };
      
      // @ts-ignore - Table was just created
      await supabase.from('integrity_fix_log').insert({
        farm_id: farmId,
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        fix_type: 'valuation',
        items_fixed: result.fixed_count,
        details: { farm_name: farmName }
      });

      toast.success(`Fixed ${result.fixed_count} valuation calculations`);
      await scanSingleFarm(farmId);
    } catch (error) {
      console.error('Error fixing valuations:', error);
      toast.error('Failed to fix valuations');
    }
  }, [scanSingleFarm]);

  const recalculateStats = useCallback(async (farmId: string) => {
    try {
      // Note: calculate_daily_farm_stats runs for all farms for a given date
      // For now, trigger a general recalculation
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.rpc('calculate_daily_farm_stats', { 
        p_target_date: today 
      });
      
      if (error) throw error;

      toast.success('Stats recalculation triggered');
      await scanSingleFarm(farmId);
    } catch (error) {
      console.error('Error recalculating stats:', error);
      toast.error('Failed to recalculate stats');
    }
  }, [scanSingleFarm]);

  const fixAllForFarm = useCallback(async (farmId: string, farmName: string, checks: IntegrityCheckResult[]) => {
    const failedChecks = checks.filter(c => !c.passed);
    
    for (const check of failedChecks) {
      switch (check.checkName) {
        case 'Weight Sync':
          await fixWeightSync(farmId, farmName);
          break;
        case 'Milk Revenue Sync':
          await fixMilkRevenue(farmId, farmName);
          break;
        case 'Valuation Consistency':
          await fixValuations(farmId, farmName);
          break;
        case 'Stats Consistency':
          await recalculateStats(farmId);
          break;
      }
    }
  }, [fixWeightSync, fixMilkRevenue, fixValuations, recalculateStats]);

  // Computed stats
  const stats = {
    totalFarms: results.length,
    farmsWithIssues: results.filter(r => r.status !== 'healthy').length,
    criticalFarms: results.filter(r => r.status === 'critical').length,
    healthyFarms: results.filter(r => r.status === 'healthy').length,
    issuePercentage: results.length > 0 
      ? Math.round((results.filter(r => r.status !== 'healthy').length / results.length) * 100)
      : 0
  };

  return {
    results,
    isScanning,
    progress,
    lastScanTime,
    stats,
    autoRefreshInterval,
    setAutoRefreshInterval,
    scanAllFarms,
    scanSingleFarm,
    fixWeightSync,
    fixMilkRevenue,
    fixValuations,
    recalculateStats,
    fixAllForFarm
  };
}
