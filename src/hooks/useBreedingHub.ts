/**
 * useBreedingHub Hook
 *
 * Aggregates breeding-related data for the Breeding Hub dashboard.
 * Uses the new fertility_status field and breeding_events table.
 * Supports offline-first via IndexedDB cache fallback.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, addDays } from 'date-fns';
import type { FertilityStatus } from '@/types/fertility';
import { CYCLE_LENGTH_DAYS, VWP_DAYS } from '@/types/fertility';
import { getCachedAnimals, getCachedRecords } from '@/lib/dataCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export interface BreedingAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  gender?: string;
  fertility_status: FertilityStatus | null;
  last_heat_date: string | null;
  last_ai_date: string | null;
  last_calving_date: string | null;
  parity: number | null;
  services_this_cycle: number | null;
  voluntary_waiting_end_date: string | null;
}

export interface BreedingAction {
  type: 'in_heat' | 'preg_check_due' | 'expected_heat' | 'expected_delivery' | 'vwp_ending';
  animal: BreedingAnimal;
  urgency: 'now' | 'today' | 'soon' | 'upcoming';
  actionDate: string;
  hoursRemaining?: number;
  daysRemaining?: number;
  description: string;
  descriptionTagalog: string;
}

export interface BreedingHubStats {
  openCycling: number;
  inHeat: number;
  bredWaiting: number;
  pregCheckDue: number;
  suspectedPregnant: number;
  confirmedPregnant: number;
  freshPostpartum: number;
  notEligible: number;
  maleCount: number;
}

export interface BreedingHubData {
  stats: BreedingHubStats;
  actionsToday: BreedingAction[];
  expectedHeatNext7Days: BreedingAction[];
  expectedDeliveriesNext30Days: BreedingAction[];
  animals: BreedingAnimal[];
  isLoading: boolean;
}

export function useBreedingHub(farmId: string | null): BreedingHubData {
  const isOnline = useOnlineStatus();

  const { data, isLoading } = useQuery({
    queryKey: ['breeding-hub', farmId],
    queryFn: async (): Promise<Omit<BreedingHubData, 'isLoading'>> => {
      if (!farmId) return getEmptyData();

      // Offline: derive stats from IndexedDB cache
      if (!isOnline) {
        const cachedAnimalData = await getCachedAnimals(farmId);
        if (cachedAnimalData) {
          return computeBreedingHubFromCache(cachedAnimalData.data, farmId);
        }
        return getEmptyData();
      }

      // Online: fetch fresh from Supabase
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select(`
          id, name, ear_tag, livestock_type,
          fertility_status, last_heat_date, last_ai_date,
          last_calving_date, parity, services_this_cycle,
          voluntary_waiting_end_date, birth_date, gender
        `)
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .is('exit_date', null);

      if (animalsError) throw animalsError;

      // Only fetch AI/heat records for females — males have no breeding records
      const femaleAnimalIds = animals?.filter(a => a.gender?.toLowerCase() === 'female').map(a => a.id) || [];
      const [aiResult, heatResult] = await Promise.all([
        supabase
          .from('ai_records')
          .select('animal_id, performed_date, pregnancy_confirmed, expected_delivery_date')
          .in('animal_id', femaleAnimalIds.length > 0 ? femaleAnimalIds : ['no-match'])
          .order('performed_date', { ascending: false }),
        supabase
          .from('heat_records')
          .select('animal_id, detected_at, optimal_breeding_start, optimal_breeding_end')
          .in('animal_id', femaleAnimalIds.length > 0 ? femaleAnimalIds : ['no-match'])
          .order('detected_at', { ascending: false }),
      ]);

      if (aiResult.error) throw aiResult.error;
      if (heatResult.error) throw heatResult.error;

      return computeBreedingHubFromData(
        animals || [],
        aiResult.data || [],
        heatResult.data || [],
      );
    },
    enabled: !!farmId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return {
    stats: data?.stats || getEmptyStats(),
    actionsToday: data?.actionsToday || [],
    expectedHeatNext7Days: data?.expectedHeatNext7Days || [],
    expectedDeliveriesNext30Days: data?.expectedDeliveriesNext30Days || [],
    animals: data?.animals || [],
    isLoading,
  };
}

// ---------- Offline cache helper ----------

async function computeBreedingHubFromCache(
  allAnimals: any[],
  farmId: string,
): Promise<Omit<BreedingHubData, 'isLoading'>> {
  if (allAnimals.length === 0) return getEmptyData();

  const aiRecords: any[] = [];
  const heatRecords: any[] = [];

  // Only fetch breeding records for females — males have none
  for (const animal of allAnimals) {
    if (animal.gender?.toLowerCase() !== 'female') continue;
    const cached = await getCachedRecords(animal.id);
    if (cached) {
      for (const ai of cached.ai) {
        aiRecords.push({
          animal_id: animal.id,
          performed_date: ai.performed_date,
          pregnancy_confirmed: ai.pregnancy_confirmed,
          expected_delivery_date: ai.expected_delivery_date,
        });
      }
      for (const heat of (cached.heat || [])) {
        heatRecords.push({
          animal_id: animal.id,
          detected_at: heat.detected_at,
          optimal_breeding_start: heat.optimal_breeding_start,
          optimal_breeding_end: heat.optimal_breeding_end,
        });
      }
    }
  }

  return computeBreedingHubFromData(allAnimals, aiRecords, heatRecords);
}

// ---------- Shared computation ----------

function computeBreedingHubFromData(
  animals: any[],
  aiRecords: any[],
  heatRecords: any[],
): Omit<BreedingHubData, 'isLoading'> {
  // Build lookup maps
  const latestAIByAnimal = new Map<string, any>();
  aiRecords.forEach(record => {
    if (!latestAIByAnimal.has(record.animal_id)) {
      latestAIByAnimal.set(record.animal_id, record);
    }
  });

  const latestHeatByAnimal = new Map<string, any>();
  heatRecords.forEach(record => {
    if (!latestHeatByAnimal.has(record.animal_id)) {
      latestHeatByAnimal.set(record.animal_id, record);
    }
  });

  const stats: BreedingHubStats = {
    openCycling: 0, inHeat: 0, bredWaiting: 0, pregCheckDue: 0,
    suspectedPregnant: 0, confirmedPregnant: 0, freshPostpartum: 0, notEligible: 0,
    maleCount: 0,
  };

  const actionsToday: BreedingAction[] = [];
  const expectedHeatNext7Days: BreedingAction[] = [];
  const expectedDeliveriesNext30Days: BreedingAction[] = [];
  const now = new Date();

  const processedAnimals: BreedingAnimal[] = animals.map(animal => {
    // Males are "Not Ready" — skip all breeding predictions
    const isMale = animal.gender?.toLowerCase() !== 'female';
    if (isMale) {
      stats.notEligible++;
      stats.maleCount++;
      return animal as BreedingAnimal;
    }

    const status = (animal.fertility_status as FertilityStatus) || 'not_eligible';
    const latestAI = latestAIByAnimal.get(animal.id);
    const latestHeat = latestHeatByAnimal.get(animal.id);
    const cycleLength = CYCLE_LENGTH_DAYS[animal.livestock_type] || 21;

    switch (status) {
      case 'open_cycling': stats.openCycling++; break;
      case 'in_heat': stats.inHeat++; break;
      case 'bred_waiting': stats.bredWaiting++; break;
      case 'suspected_pregnant': stats.suspectedPregnant++; break;
      case 'confirmed_pregnant': stats.confirmedPregnant++; break;
      case 'fresh_postpartum': stats.freshPostpartum++; break;
      default: stats.notEligible++; break;
    }

    // In-heat animals
    if (status === 'in_heat' && latestHeat?.optimal_breeding_end) {
      const breedingEnd = new Date(latestHeat.optimal_breeding_end);
      const hoursRemaining = Math.max(0, (breedingEnd.getTime() - now.getTime()) / (1000 * 60 * 60));
      if (hoursRemaining > 0) {
        actionsToday.push({
          type: 'in_heat',
          animal: animal as BreedingAnimal,
          urgency: hoursRemaining <= 6 ? 'now' : 'today',
          actionDate: latestHeat.optimal_breeding_end,
          hoursRemaining: Math.round(hoursRemaining),
          description: `Breed within ${Math.round(hoursRemaining)}h`,
          descriptionTagalog: `I-breed sa loob ng ${Math.round(hoursRemaining)} oras`,
        });
      }
    }

    // Pregnancy check due (28-45 days post AI)
    if (status === 'bred_waiting' && latestAI?.performed_date) {
      const performedDate = new Date(latestAI.performed_date);
      const daysSinceAI = differenceInDays(now, performedDate);
      if (daysSinceAI >= 28 && daysSinceAI <= 45 && !latestAI.pregnancy_confirmed) {
        stats.pregCheckDue++;
        actionsToday.push({
          type: 'preg_check_due',
          animal: animal as BreedingAnimal,
          urgency: daysSinceAI >= 35 ? 'now' : 'today',
          actionDate: addDays(performedDate, 30).toISOString(),
          daysRemaining: 0,
          description: `Preg check - ${daysSinceAI} days post-AI`,
          descriptionTagalog: `Tsek ng pagbubuntis - ${daysSinceAI} araw matapos ang AI`,
        });
      }
    }

    // Expected heat predictions (open cycling)
    if (status === 'open_cycling') {
      let expectedNextHeat: Date | null = null;

      if (animal.last_heat_date || latestHeat?.detected_at) {
        // Primary: predict from last heat + cycle length
        const lastHeat = new Date(animal.last_heat_date || latestHeat?.detected_at || '');
        expectedNextHeat = addDays(lastHeat, cycleLength);
      } else if (animal.last_calving_date) {
        // Fallback: predict from last calving + VWP (first post-calving heat)
        const vwpDays = VWP_DAYS[animal.livestock_type as keyof typeof VWP_DAYS] || 60;
        expectedNextHeat = addDays(new Date(animal.last_calving_date), vwpDays);
      }

      if (expectedNextHeat) {
        const daysUntilHeat = differenceInDays(expectedNextHeat, now);
        if (daysUntilHeat >= -3 && daysUntilHeat <= 7) {
          expectedHeatNext7Days.push({
            type: 'expected_heat',
            animal: animal as BreedingAnimal,
            urgency: daysUntilHeat <= 1 ? 'today' : daysUntilHeat <= 3 ? 'soon' : 'upcoming',
            actionDate: expectedNextHeat.toISOString(),
            daysRemaining: Math.max(0, daysUntilHeat),
            description: daysUntilHeat <= 0 ? 'Expected today' : `~${daysUntilHeat} days`,
            descriptionTagalog: daysUntilHeat <= 0 ? 'Inaasahan ngayon' : `~${daysUntilHeat} araw`,
          });
        }
      }
    }

    // Expected deliveries
    if ((status === 'confirmed_pregnant' || status === 'suspected_pregnant') && latestAI?.expected_delivery_date) {
      const deliveryDate = new Date(latestAI.expected_delivery_date);
      const daysUntilDelivery = differenceInDays(deliveryDate, now);
      if (daysUntilDelivery >= 0 && daysUntilDelivery <= 30) {
        expectedDeliveriesNext30Days.push({
          type: 'expected_delivery',
          animal: animal as BreedingAnimal,
          urgency: daysUntilDelivery <= 3 ? 'now' : daysUntilDelivery <= 7 ? 'soon' : 'upcoming',
          actionDate: latestAI.expected_delivery_date,
          daysRemaining: daysUntilDelivery,
          description: daysUntilDelivery === 0 ? 'Due today!' : `${daysUntilDelivery} days`,
          descriptionTagalog: daysUntilDelivery === 0 ? 'Ngayon!' : `${daysUntilDelivery} araw`,
        });
      }
    }

    return animal as BreedingAnimal;
  });

  // Sort by urgency
  actionsToday.sort((a, b) => {
    const urgencyOrder = { now: 0, today: 1, soon: 2, upcoming: 3 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });
  expectedHeatNext7Days.sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));
  expectedDeliveriesNext30Days.sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));

  return { stats, actionsToday, expectedHeatNext7Days, expectedDeliveriesNext30Days, animals: processedAnimals };
}

function getEmptyStats(): BreedingHubStats {
  return {
    openCycling: 0, inHeat: 0, bredWaiting: 0, pregCheckDue: 0,
    suspectedPregnant: 0, confirmedPregnant: 0, freshPostpartum: 0, notEligible: 0,
    maleCount: 0,
  };
}

function getEmptyData(): Omit<BreedingHubData, 'isLoading'> {
  return {
    stats: getEmptyStats(),
    actionsToday: [],
    expectedHeatNext7Days: [],
    expectedDeliveriesNext30Days: [],
    animals: [],
  };
}
