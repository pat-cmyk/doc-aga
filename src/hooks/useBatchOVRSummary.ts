import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatusReason } from "@/types/status";

export interface AnimalOVRSummary {
  animalId: string;
  ovr: number;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  trend: 'up' | 'down' | 'stable';
  status: 'green' | 'yellow' | 'red';
  statusReason: StatusReason;
  alertCount: number;
}

interface TriageData {
  healthIssues: Map<string, number>;
  overdueVaccines: Map<string, number>;
  activeAlerts: Map<string, number>;
  hasWithdrawal: Set<string>;
  overdueDelivery: Set<string>;
  nearDelivery: Set<string>;
  inHeatWindow: Set<string>;
  criticalBCS: Set<string>;
  withdrawalWithMilkSold: Set<string>;
}

interface CachedOVR {
  animal_id: string;
  score: number;
  tier: string;
  trend: string;
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
    return { status: 'red', reason: 'withdrawal_milk_sold' };
  }
  if (isOverdueDelivery) {
    return { status: 'red', reason: 'overdue_delivery' };
  }
  if (overdueVaccineCount >= 2) {
    return { status: 'red', reason: 'multiple_overdue_vaccines' };
  }
  if (healthIssueCount > 0) {
    return { status: 'red', reason: 'active_health_issue' };
  }
  
  // YELLOW: Attention needed soon
  if (hasWithdrawal) {
    return { status: 'yellow', reason: 'active_withdrawal' };
  }
  if (isNearDelivery) {
    return { status: 'yellow', reason: 'near_delivery' };
  }
  if (overdueVaccineCount === 1) {
    return { status: 'yellow', reason: 'single_overdue_vaccine' };
  }
  if (isInHeatWindow) {
    return { status: 'yellow', reason: 'in_heat_window' };
  }
  if (isBCSCritical) {
    return { status: 'yellow', reason: 'critical_bcs' };
  }
  
  // GREEN: All clear
  return { status: 'green', reason: 'healthy' };
}

/**
 * Fetch triage-related data only (not OVR - that comes from cache)
 */
async function fetchTriageData(farmId: string, animalIds: string[]): Promise<TriageData> {
  if (animalIds.length === 0) {
    return {
      healthIssues: new Map(),
      overdueVaccines: new Map(),
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

  const [
    healthResult,
    schedulesResult,
    withdrawalResult,
    aiRecordsResult,
    heatRecordsResult,
    bcsResult,
    milkSoldDuringWithdrawalResult
  ] = await Promise.all([
    supabase
      .from('health_records')
      .select('animal_id')
      .in('animal_id', animalIds)
      .gte('visit_date', thirtyDaysAgo.toISOString().split('T')[0]),
    
    supabase
      .from('preventive_health_schedules')
      .select('animal_id, status, scheduled_date')
      .eq('farm_id', farmId)
      .in('animal_id', animalIds),
    
    supabase
      .from('injection_records')
      .select('animal_id, record_datetime')
      .in('animal_id', animalIds)
      .gte('record_datetime', sevenDaysAgo.toISOString()),
    
    supabase
      .from('ai_records')
      .select('animal_id, expected_delivery_date')
      .in('animal_id', animalIds)
      .eq('pregnancy_confirmed', true)
      .not('expected_delivery_date', 'is', null),
    
    supabase
      .from('heat_records')
      .select('animal_id, optimal_breeding_start, optimal_breeding_end')
      .in('animal_id', animalIds)
      .lte('optimal_breeding_start', today.toISOString())
      .gte('optimal_breeding_end', today.toISOString()),
    
    supabase
      .from('body_condition_scores')
      .select('animal_id, score')
      .eq('farm_id', farmId)
      .in('animal_id', animalIds)
      .order('assessment_date', { ascending: false }),
    
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
  if (schedulesResult.data) {
    for (const schedule of schedulesResult.data) {
      if (schedule.status === 'scheduled' && schedule.scheduled_date < todayStr) {
        const current = overdueVaccines.get(schedule.animal_id) || 0;
        overdueVaccines.set(schedule.animal_id, current + 1);
      }
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

  // Check for milk sold during withdrawal
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

  // Process heat records
  const inHeatWindow = new Set<string>();
  if (heatRecordsResult.data) {
    for (const record of heatRecordsResult.data) {
      inHeatWindow.add(record.animal_id);
    }
  }

  // Process BCS
  const criticalBCS = new Set<string>();
  const seenAnimals = new Set<string>();
  if (bcsResult.data) {
    for (const record of bcsResult.data) {
      if (!seenAnimals.has(record.animal_id)) {
        seenAnimals.add(record.animal_id);
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
  gender?: string | null;
  life_stage?: string | null;
  milking_stage?: string | null;
}

/**
 * Batch OVR Summary Hook
 * 
 * SSOT: This hook READS from the animal_ovr_cache table.
 * The cache is WRITTEN by useBioCardData when Bio-Card is opened.
 * 
 * For animals without cache (never opened Bio-Card), shows placeholder.
 */
export function useBatchOVRSummary(
  farmId: string | undefined,
  animals: AnimalInput[]
): {
  summaries: Map<string, AnimalOVRSummary>;
  isLoading: boolean;
} {
  const animalIds = animals.map(a => a.id);
  
  const { data, isLoading } = useQuery({
    queryKey: ['batch-ovr-cache', farmId, animalIds.join(',')],
    queryFn: async () => {
      if (!farmId || animalIds.length === 0) {
        return new Map<string, AnimalOVRSummary>();
      }

      // Fetch OVR from cache and triage data in parallel
      const [ovrCacheResult, triageData] = await Promise.all([
        // Read OVR from cache (cast needed until types regenerate)
        (supabase
          .from('animal_ovr_cache' as any)
          .select('animal_id, score, tier, trend')
          .in('animal_id', animalIds) as any),
        fetchTriageData(farmId, animalIds)
      ]);

      // Build OVR cache lookup
      const ovrCache = new Map<string, CachedOVR>();
      if (ovrCacheResult.data) {
        for (const row of ovrCacheResult.data as CachedOVR[]) {
          ovrCache.set(row.animal_id, row);
        }
      }

      const summaries = new Map<string, AnimalOVRSummary>();

      for (const animal of animals) {
        const healthIssueCount = triageData.healthIssues.get(animal.id) || 0;
        const overdueCount = triageData.overdueVaccines.get(animal.id) || 0;
        const hasWithdrawal = triageData.hasWithdrawal.has(animal.id);
        const alertCount = triageData.activeAlerts.get(animal.id) || 0;
        
        const isOverdueDelivery = triageData.overdueDelivery.has(animal.id);
        const isNearDelivery = triageData.nearDelivery.has(animal.id);
        const isInHeatWindow = triageData.inHeatWindow.has(animal.id);
        const isBCSCritical = triageData.criticalBCS.has(animal.id);
        const isMilkSoldDuringWithdrawal = triageData.withdrawalWithMilkSold.has(animal.id);

        // Get cached OVR or use placeholder
        const cached = ovrCache.get(animal.id);
        const ovr = cached?.score ?? 0; // 0 = not cached yet
        const tier = (cached?.tier as AnimalOVRSummary['tier']) ?? 'silver';
        const trend = (cached?.trend as AnimalOVRSummary['trend']) ?? 'stable';
        
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
          trend,
          status,
          statusReason: reason,
          alertCount
        });
      }

      return summaries;
    },
    enabled: !!farmId && animalIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds - cache refreshes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    summaries: data || new Map(),
    isLoading
  };
}
