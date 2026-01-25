import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getOVRTier } from "@/lib/ovrScoreCalculator";
import type { StatusReason } from "@/components/animal-list/StatusDot";

export interface AnimalOVRSummary {
  animalId: string;
  ovr: number;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  trend: 'up' | 'down' | 'stable';
  status: 'green' | 'yellow' | 'red';
  statusReason: StatusReason;
  alertCount: number;
}

interface BatchQueryData {
  healthIssues: Map<string, number>;
  overdueVaccines: Map<string, number>;
  completedVaccines: Map<string, number>;
  avgMilkProduction: Map<string, number>;
  activeAlerts: Map<string, number>;
  hasWithdrawal: Set<string>;
  // Enhanced triage data
  overdueDelivery: Set<string>;
  nearDelivery: Set<string>;
  inHeatWindow: Set<string>;
  criticalBCS: Set<string>;
  withdrawalWithMilkSold: Set<string>;
}

/**
 * Calculate triage status with veterinary priority ordering
 * RED: Immediate attention (food safety, calving emergency, severe illness)
 * YELLOW: Action needed soon (single overdue vax, breeding window, near calving)
 * GREEN: Routine/healthy
 */
function calculateStatus(
  healthIssueCount: number,
  overdueVaccineCount: number,
  hasWithdrawal: boolean,
  isOverdueDelivery: boolean,
  isNearDelivery: boolean,
  isInHeatWindow: boolean,
  isBCSCritical: boolean,
  isMilkSoldDuringWithdrawal: boolean
): { status: AnimalOVRSummary['status']; reason: StatusReason } {
  // RED: Critical - immediate action required
  if (isMilkSoldDuringWithdrawal) {
    return { status: 'red', reason: 'withdrawal_milk_sold' };  // Food safety!
  }
  if (isOverdueDelivery) {
    return { status: 'red', reason: 'overdue_delivery' };      // Calving emergency risk
  }
  if (overdueVaccineCount >= 2) {
    return { status: 'red', reason: 'multiple_overdue_vaccines' };  // Significant compliance gap
  }
  if (healthIssueCount > 0) {
    return { status: 'red', reason: 'active_health_issue' };   // Active health concern
  }
  
  // YELLOW: Attention needed soon
  if (hasWithdrawal) {
    return { status: 'yellow', reason: 'active_withdrawal' };  // Monitor, but milk not sold
  }
  if (isNearDelivery) {
    return { status: 'yellow', reason: 'near_delivery' };      // Prepare for calving
  }
  if (overdueVaccineCount === 1) {
    return { status: 'yellow', reason: 'single_overdue_vaccine' };
  }
  if (isInHeatWindow) {
    return { status: 'yellow', reason: 'in_heat_window' };     // Time-sensitive breeding
  }
  if (isBCSCritical) {
    return { status: 'yellow', reason: 'critical_bcs' };
  }
  
  // GREEN: All clear
  return { status: 'green', reason: 'healthy' };
}

function calculateSimplifiedOVR(
  vaccinationCompliance: number,
  hasActiveHealthIssue: boolean,
  avgMilkLiters: number | null,
  livestockType: string
): number {
  // Simplified OVR calculation based on available batch data
  // Health score (40%) - adjusted penalties
  const healthScore = hasActiveHealthIssue ? 60 : 100;  // -40 for active issues
  
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
      hasWithdrawal: new Set(),
      overdueDelivery: new Set(),
      nearDelivery: new Set(),
      inHeatWindow: new Set(),
      criticalBCS: new Set(),
      withdrawalWithMilkSold: new Set(),
    };
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Run all queries in parallel - enhanced for veterinary triage
  const [
    healthResult,
    schedulesResult,
    milkResult,
    withdrawalResult,
    aiRecordsResult,
    heatRecordsResult,
    bcsResult,
    milkSoldDuringWithdrawalResult
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
      .gte('record_datetime', sevenDaysAgo.toISOString()),
    
    // Expected deliveries - for overdue and near delivery detection
    supabase
      .from('ai_records')
      .select('animal_id, expected_delivery_date')
      .in('animal_id', animalIds)
      .eq('pregnancy_confirmed', true)
      .not('expected_delivery_date', 'is', null),
    
    // Heat records - for breeding window detection
    supabase
      .from('heat_records')
      .select('animal_id, optimal_breeding_start, optimal_breeding_end')
      .in('animal_id', animalIds)
      .lte('optimal_breeding_start', today.toISOString())
      .gte('optimal_breeding_end', today.toISOString()),
    
    // Body condition scores - for critical BCS detection
    supabase
      .from('body_condition_scores')
      .select('animal_id, score')
      .eq('farm_id', farmId)
      .in('animal_id', animalIds)
      .order('assessment_date', { ascending: false }),
    
    // Check for milk sold during withdrawal (food safety critical)
    supabase
      .from('milking_records')
      .select('animal_id')
      .in('animal_id', animalIds)
      .eq('is_sold', true)
      .gte('record_date', sevenDaysAgo.toISOString().split('T')[0])
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
  
  if (schedulesResult.data) {
    for (const schedule of schedulesResult.data) {
      if (schedule.status === 'completed') {
        const current = completedVaccines.get(schedule.animal_id) || 0;
        completedVaccines.set(schedule.animal_id, current + 1);
      } else if (schedule.status === 'scheduled' && schedule.scheduled_date < todayStr) {
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

  // Process withdrawal periods
  const hasWithdrawal = new Set<string>();
  const withdrawalAnimalIds = new Set<string>();
  if (withdrawalResult.data) {
    for (const record of withdrawalResult.data) {
      hasWithdrawal.add(record.animal_id);
      withdrawalAnimalIds.add(record.animal_id);
    }
  }

  // Check for milk sold during withdrawal (food safety critical)
  const withdrawalWithMilkSold = new Set<string>();
  if (milkSoldDuringWithdrawalResult.data) {
    for (const record of milkSoldDuringWithdrawalResult.data) {
      if (withdrawalAnimalIds.has(record.animal_id)) {
        withdrawalWithMilkSold.add(record.animal_id);
      }
    }
  }

  // Process expected deliveries
  const overdueDelivery = new Set<string>();
  const nearDelivery = new Set<string>();
  if (aiRecordsResult.data) {
    for (const record of aiRecordsResult.data) {
      if (record.expected_delivery_date) {
        const deliveryDate = new Date(record.expected_delivery_date);
        if (deliveryDate < today) {
          overdueDelivery.add(record.animal_id);
        } else if (deliveryDate <= sevenDaysFromNow) {
          nearDelivery.add(record.animal_id);
        }
      }
    }
  }

  // Process heat records - animals currently in breeding window
  const inHeatWindow = new Set<string>();
  if (heatRecordsResult.data) {
    for (const record of heatRecordsResult.data) {
      inHeatWindow.add(record.animal_id);
    }
  }

  // Process BCS - get latest per animal and check for critical values
  const criticalBCS = new Set<string>();
  const seenAnimals = new Set<string>();
  if (bcsResult.data) {
    for (const record of bcsResult.data) {
      // Only consider first (most recent) record per animal
      if (!seenAnimals.has(record.animal_id)) {
        seenAnimals.add(record.animal_id);
        // Critical: BCS ≤ 2.0 or ≥ 4.5
        if (record.score <= 2.0 || record.score >= 4.5) {
          criticalBCS.add(record.animal_id);
        }
      }
    }
  }

  // Calculate alert counts
  const activeAlerts = new Map<string, number>();
  for (const animalId of animalIds) {
    let alertCount = 0;
    alertCount += healthIssues.get(animalId) || 0;
    alertCount += overdueVaccines.get(animalId) || 0;
    if (hasWithdrawal.has(animalId)) alertCount += 1;
    if (overdueDelivery.has(animalId)) alertCount += 1;
    if (nearDelivery.has(animalId)) alertCount += 1;
    if (inHeatWindow.has(animalId)) alertCount += 1;
    if (criticalBCS.has(animalId)) alertCount += 1;
    activeAlerts.set(animalId, alertCount);
  }

  return {
    healthIssues,
    overdueVaccines,
    completedVaccines,
    avgMilkProduction,
    activeAlerts,
    hasWithdrawal,
    overdueDelivery,
    nearDelivery,
    inHeatWindow,
    criticalBCS,
    withdrawalWithMilkSold,
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
        
        // Enhanced triage data
        const isOverdueDelivery = batchData.overdueDelivery.has(animal.id);
        const isNearDelivery = batchData.nearDelivery.has(animal.id);
        const isInHeatWindow = batchData.inHeatWindow.has(animal.id);
        const isBCSCritical = batchData.criticalBCS.has(animal.id);
        const isMilkSoldDuringWithdrawal = batchData.withdrawalWithMilkSold.has(animal.id);

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

        // Use SSOT tier calculation
        const tier = getOVRTier(ovr);
        
        // Calculate veterinary-priority triage status
        const { status, reason } = calculateStatus(
          healthIssueCount,
          overdueCount,
          hasWithdrawal,
          isOverdueDelivery,
          isNearDelivery,
          isInHeatWindow,
          isBCSCritical,
          isMilkSoldDuringWithdrawal
        );

        summaries.set(animal.id, {
          animalId: animal.id,
          ovr,
          tier,
          trend: 'stable', // Simplified - would need historical data for real trend
          status,
          statusReason: reason,
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
