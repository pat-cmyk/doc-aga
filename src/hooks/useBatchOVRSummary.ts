import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnimalOVRSummary {
  animalId: string;
  ovr: number;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  trend: 'up' | 'down' | 'stable';
  status: 'green' | 'yellow' | 'red';
  alertCount: number;
}

interface BatchQueryData {
  healthIssues: Map<string, number>;
  overdueVaccines: Map<string, number>;
  completedVaccines: Map<string, number>;
  avgMilkProduction: Map<string, number>;
  activeAlerts: Map<string, number>;
  hasWithdrawal: Set<string>;
}

function calculateTier(score: number): AnimalOVRSummary['tier'] {
  if (score >= 85) return 'diamond';
  if (score >= 70) return 'gold';
  if (score >= 50) return 'silver';
  return 'bronze';
}

function calculateStatus(
  healthIssueCount: number,
  overdueVaccineCount: number,
  hasWithdrawal: boolean
): AnimalOVRSummary['status'] {
  // Red: critical issues
  if (healthIssueCount > 0 || overdueVaccineCount > 1 || hasWithdrawal) {
    return 'red';
  }
  // Yellow: attention needed
  if (overdueVaccineCount === 1) {
    return 'yellow';
  }
  // Green: healthy
  return 'green';
}

function calculateSimplifiedOVR(
  vaccinationCompliance: number,
  hasActiveHealthIssue: boolean,
  avgMilkLiters: number | null,
  livestockType: string
): number {
  // Simplified OVR calculation based on available batch data
  // Health score (40%)
  const healthScore = hasActiveHealthIssue ? 40 : 100;
  
  // Vaccination compliance score (30%)
  const vaccinationScore = vaccinationCompliance;
  
  // Production score (30%) - simplified
  let productionScore = 70; // Default baseline
  if (avgMilkLiters !== null && avgMilkLiters > 0) {
    // Compare to basic benchmarks
    const benchmarks: Record<string, number> = {
      cattle: 15,
      carabao: 4,
      goat: 2,
      sheep: 1.5
    };
    const benchmark = benchmarks[livestockType] || 10;
    productionScore = Math.min(100, (avgMilkLiters / benchmark) * 100);
  }
  
  // Weighted average
  const ovr = (healthScore * 0.4) + (vaccinationScore * 0.3) + (productionScore * 0.3);
  return Math.round(Math.max(0, Math.min(100, ovr)));
}

async function fetchBatchData(farmId: string, animalIds: string[]): Promise<BatchQueryData> {
  if (animalIds.length === 0) {
    return {
      healthIssues: new Map(),
      overdueVaccines: new Map(),
      completedVaccines: new Map(),
      avgMilkProduction: new Map(),
      activeAlerts: new Map(),
      hasWithdrawal: new Set()
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Run all queries in parallel
  const [
    healthResult,
    schedulesResult,
    milkResult,
    withdrawalResult
  ] = await Promise.all([
    // Active health issues (last 30 days)
    supabase
      .from('health_records')
      .select('animal_id')
      .in('animal_id', animalIds)
      .gte('visit_date', thirtyDaysAgo.toISOString().split('T')[0]),
    
    // Preventive health schedules
    supabase
      .from('preventive_health_schedules')
      .select('animal_id, status, scheduled_date')
      .eq('farm_id', farmId)
      .in('animal_id', animalIds),
    
    // Recent milk production (last 7 days)
    supabase
      .from('milking_records')
      .select('animal_id, liters')
      .in('animal_id', animalIds)
      .gte('record_date', sevenDaysAgo.toISOString().split('T')[0]),
    
    // Animals with active withdrawal periods (from injection records)
    supabase
      .from('injection_records')
      .select('animal_id, record_datetime')
      .in('animal_id', animalIds)
      .gte('record_datetime', sevenDaysAgo.toISOString())
  ]);

  // Process health issues
  const healthIssues = new Map<string, number>();
  if (healthResult.data) {
    for (const record of healthResult.data) {
      const current = healthIssues.get(record.animal_id) || 0;
      healthIssues.set(record.animal_id, current + 1);
    }
  }

  // Process vaccination schedules
  const overdueVaccines = new Map<string, number>();
  const completedVaccines = new Map<string, number>();
  const today = new Date().toISOString().split('T')[0];
  
  if (schedulesResult.data) {
    for (const schedule of schedulesResult.data) {
      if (schedule.status === 'completed') {
        const current = completedVaccines.get(schedule.animal_id) || 0;
        completedVaccines.set(schedule.animal_id, current + 1);
      } else if (schedule.status === 'scheduled' && schedule.scheduled_date < today) {
        const current = overdueVaccines.get(schedule.animal_id) || 0;
        overdueVaccines.set(schedule.animal_id, current + 1);
      }
    }
  }

  // Process milk production (calculate average per animal)
  const milkTotals = new Map<string, { total: number; count: number }>();
  if (milkResult.data) {
    for (const record of milkResult.data) {
      const current = milkTotals.get(record.animal_id) || { total: 0, count: 0 };
      milkTotals.set(record.animal_id, {
        total: current.total + (record.liters || 0),
        count: current.count + 1
      });
    }
  }
  const avgMilkProduction = new Map<string, number>();
  for (const [animalId, data] of milkTotals) {
    if (data.count > 0) {
      avgMilkProduction.set(animalId, data.total / data.count);
    }
  }

  // Process withdrawal periods (simplified: any injection in last 7 days)
  const hasWithdrawal = new Set<string>();
  if (withdrawalResult.data) {
    for (const record of withdrawalResult.data) {
      hasWithdrawal.add(record.animal_id);
    }
  }

  // Calculate alert counts
  const activeAlerts = new Map<string, number>();
  for (const animalId of animalIds) {
    let alertCount = 0;
    alertCount += healthIssues.get(animalId) || 0;
    alertCount += overdueVaccines.get(animalId) || 0;
    if (hasWithdrawal.has(animalId)) alertCount += 1;
    activeAlerts.set(animalId, alertCount);
  }

  return {
    healthIssues,
    overdueVaccines,
    completedVaccines,
    avgMilkProduction,
    activeAlerts,
    hasWithdrawal
  };
}

interface AnimalInput {
  id: string;
  livestock_type: string;
}

export function useBatchOVRSummary(
  farmId: string | undefined,
  animals: AnimalInput[]
): {
  summaries: Map<string, AnimalOVRSummary>;
  isLoading: boolean;
} {
  const animalIds = animals.map(a => a.id);
  
  const { data, isLoading } = useQuery({
    queryKey: ['batch-ovr-summary', farmId, animalIds.join(',')],
    queryFn: async () => {
      if (!farmId || animalIds.length === 0) {
        return new Map<string, AnimalOVRSummary>();
      }

      const batchData = await fetchBatchData(farmId, animalIds);
      const summaries = new Map<string, AnimalOVRSummary>();

      for (const animal of animals) {
        const healthIssueCount = batchData.healthIssues.get(animal.id) || 0;
        const overdueCount = batchData.overdueVaccines.get(animal.id) || 0;
        const completedCount = batchData.completedVaccines.get(animal.id) || 0;
        const avgMilk = batchData.avgMilkProduction.get(animal.id) || null;
        const hasWithdrawal = batchData.hasWithdrawal.has(animal.id);
        const alertCount = batchData.activeAlerts.get(animal.id) || 0;

        // Calculate vaccination compliance
        const totalSchedules = overdueCount + completedCount;
        const vaccinationCompliance = totalSchedules > 0 
          ? (completedCount / totalSchedules) * 100 
          : 80; // Default if no schedules

        const ovr = calculateSimplifiedOVR(
          vaccinationCompliance,
          healthIssueCount > 0,
          avgMilk,
          animal.livestock_type
        );

        const tier = calculateTier(ovr);
        const status = calculateStatus(healthIssueCount, overdueCount, hasWithdrawal);

        summaries.set(animal.id, {
          animalId: animal.id,
          ovr,
          tier,
          trend: 'stable', // Simplified - would need historical data for real trend
          status,
          alertCount
        });
      }

      return summaries;
    },
    enabled: !!farmId && animalIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    summaries: data || new Map(),
    isLoading
  };
}
