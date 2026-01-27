/**
 * useBreedingHub Hook
 * 
 * Aggregates breeding-related data for the Breeding Hub dashboard.
 * Uses the new fertility_status field and breeding_events table.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, addDays, format } from 'date-fns';
import type { FertilityStatus } from '@/types/fertility';
import { CYCLE_LENGTH_DAYS, GESTATION_DAYS } from '@/types/fertility';

export interface BreedingAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
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
  const { data, isLoading } = useQuery({
    queryKey: ['breeding-hub', farmId],
    queryFn: async (): Promise<Omit<BreedingHubData, 'isLoading'>> => {
      if (!farmId) {
        return getEmptyData();
      }

      // Fetch female animals with fertility data
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
        .is('exit_date', null)
        .ilike('gender', 'female');

      if (animalsError) throw animalsError;

      // Also fetch latest AI records for pregnancy check due
      const animalIds = animals?.map(a => a.id) || [];
      const { data: aiRecords, error: aiError } = await supabase
        .from('ai_records')
        .select('animal_id, performed_date, pregnancy_confirmed, expected_delivery_date')
        .in('animal_id', animalIds.length > 0 ? animalIds : ['no-match'])
        .order('performed_date', { ascending: false });

      if (aiError) throw aiError;

      // Fetch recent heat records
      const { data: heatRecords, error: heatError } = await supabase
        .from('heat_records')
        .select('animal_id, detected_at, optimal_breeding_start, optimal_breeding_end')
        .in('animal_id', animalIds.length > 0 ? animalIds : ['no-match'])
        .order('detected_at', { ascending: false });

      if (heatError) throw heatError;

      // Build lookup maps
      const latestAIByAnimal = new Map<string, typeof aiRecords[0]>();
      aiRecords?.forEach(record => {
        if (!latestAIByAnimal.has(record.animal_id)) {
          latestAIByAnimal.set(record.animal_id, record);
        }
      });

      const latestHeatByAnimal = new Map<string, typeof heatRecords[0]>();
      heatRecords?.forEach(record => {
        if (!latestHeatByAnimal.has(record.animal_id)) {
          latestHeatByAnimal.set(record.animal_id, record);
        }
      });

      // Calculate stats
      const stats: BreedingHubStats = {
        openCycling: 0,
        inHeat: 0,
        bredWaiting: 0,
        pregCheckDue: 0,
        suspectedPregnant: 0,
        confirmedPregnant: 0,
        freshPostpartum: 0,
        notEligible: 0,
      };

      const actionsToday: BreedingAction[] = [];
      const expectedHeatNext7Days: BreedingAction[] = [];
      const expectedDeliveriesNext30Days: BreedingAction[] = [];
      const now = new Date();

      const processedAnimals: BreedingAnimal[] = (animals || []).map(animal => {
        const status = (animal.fertility_status as FertilityStatus) || 'not_eligible';
        const latestAI = latestAIByAnimal.get(animal.id);
        const latestHeat = latestHeatByAnimal.get(animal.id);
        const cycleLength = CYCLE_LENGTH_DAYS[animal.livestock_type] || 21;

        // Count by status
        switch (status) {
          case 'open_cycling': stats.openCycling++; break;
          case 'in_heat': stats.inHeat++; break;
          case 'bred_waiting': stats.bredWaiting++; break;
          case 'suspected_pregnant': stats.suspectedPregnant++; break;
          case 'confirmed_pregnant': stats.confirmedPregnant++; break;
          case 'fresh_postpartum': stats.freshPostpartum++; break;
          default: stats.notEligible++; break;
        }

        // Check for in-heat animals
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

        // Check for pregnancy check due (28-35 days post AI)
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

        // Expected heat predictions (for open cycling animals)
        if (status === 'open_cycling' && (animal.last_heat_date || latestHeat?.detected_at)) {
          const lastHeat = new Date(animal.last_heat_date || latestHeat?.detected_at || '');
          const daysSinceHeat = differenceInDays(now, lastHeat);
          const expectedNextHeat = addDays(lastHeat, cycleLength);
          const daysUntilHeat = differenceInDays(expectedNextHeat, now);
          
          if (daysUntilHeat >= -3 && daysUntilHeat <= 7) {
            expectedHeatNext7Days.push({
              type: 'expected_heat',
              animal: animal as BreedingAnimal,
              urgency: daysUntilHeat <= 1 ? 'today' : daysUntilHeat <= 3 ? 'soon' : 'upcoming',
              actionDate: expectedNextHeat.toISOString(),
              daysRemaining: Math.max(0, daysUntilHeat),
              description: daysUntilHeat <= 0 
                ? 'Expected today' 
                : `~${daysUntilHeat} days`,
              descriptionTagalog: daysUntilHeat <= 0 
                ? 'Inaasahan ngayon' 
                : `~${daysUntilHeat} araw`,
            });
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

      // Sort actions by urgency
      actionsToday.sort((a, b) => {
        const urgencyOrder = { now: 0, today: 1, soon: 2, upcoming: 3 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });

      expectedHeatNext7Days.sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));
      expectedDeliveriesNext30Days.sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));

      return {
        stats,
        actionsToday,
        expectedHeatNext7Days,
        expectedDeliveriesNext30Days,
        animals: processedAnimals,
      };
    },
    enabled: !!farmId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
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

function getEmptyStats(): BreedingHubStats {
  return {
    openCycling: 0,
    inHeat: 0,
    bredWaiting: 0,
    pregCheckDue: 0,
    suspectedPregnant: 0,
    confirmedPregnant: 0,
    freshPostpartum: 0,
    notEligible: 0,
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
