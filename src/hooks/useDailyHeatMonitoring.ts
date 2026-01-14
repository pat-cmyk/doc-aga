import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, differenceInMonths, addDays, parseISO } from 'date-fns';

export interface BreedingEligibleAnimal {
  id: string;
  name: string | null;
  earTag: string | null;
  gender: 'female';
  ageMonths: number;
  lastHeatDate: string | null;
  expectedNextHeat: string | null;
  daysSinceLastHeat: number | null;
  daysUntilExpectedHeat: number | null;
  isOverdue: boolean;
  isPregnant: boolean;
  needsObservation: boolean;
}

export interface HeatMonitoringSummary {
  breedingEligibleCount: number;
  breedingEligibleAnimals: BreedingEligibleAnimal[];
  animalsNeedingObservation: BreedingEligibleAnimal[];
  overdueAnimals: BreedingEligibleAnimal[];
  pregnantCount: number;
  lastHeatCheckDate: string | null;
}

const AVERAGE_CYCLE_LENGTH = 21; // days
const CYCLE_VARIANCE = 3; // days +/-
const MIN_BREEDING_AGE_MONTHS = 15;

export function useDailyHeatMonitoring(farmId: string | null) {
  return useQuery({
    queryKey: ['daily-heat-monitoring', farmId],
    queryFn: async (): Promise<HeatMonitoringSummary> => {
      if (!farmId) {
        return {
          breedingEligibleCount: 0,
          breedingEligibleAnimals: [],
          animalsNeedingObservation: [],
          overdueAnimals: [],
          pregnantCount: 0,
          lastHeatCheckDate: null,
        };
      }

      const today = new Date();

      // Fetch female animals that are breeding eligible
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('id, name, ear_tag, birth_date, gender')
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .is('exit_date', null)
        .eq('gender', 'female');

      if (animalsError) throw animalsError;

      // Fetch heat records for all animals
      const animalIds = animals?.map(a => a.id) || [];
      const { data: heatRecords, error: heatError } = await supabase
        .from('heat_records')
        .select('animal_id, detected_at')
        .eq('farm_id', farmId)
        .in('animal_id', animalIds.length > 0 ? animalIds : ['no-match'])
        .order('detected_at', { ascending: false });

      if (heatError) throw heatError;

      // Fetch AI records with confirmed pregnancies
      const { data: aiRecords, error: aiError } = await supabase
        .from('ai_records')
        .select('animal_id, pregnancy_confirmed')
        .in('animal_id', animalIds.length > 0 ? animalIds : ['no-match'])
        .eq('pregnancy_confirmed', true);

      if (aiError) throw aiError;

      // Create lookup maps
      const lastHeatByAnimal = new Map<string, string>();
      heatRecords?.forEach(record => {
        if (!lastHeatByAnimal.has(record.animal_id)) {
          lastHeatByAnimal.set(record.animal_id, record.detected_at);
        }
      });

      const pregnantAnimals = new Set(aiRecords?.map(r => r.animal_id) || []);

      // Process animals
      const breedingEligibleAnimals: BreedingEligibleAnimal[] = [];
      let pregnantCount = 0;

      animals?.forEach(animal => {
        if (!animal.birth_date) return;

        const birthDate = parseISO(animal.birth_date);
        const ageMonths = differenceInMonths(today, birthDate);

        // Skip if too young for breeding
        if (ageMonths < MIN_BREEDING_AGE_MONTHS) return;

        const isPregnant = pregnantAnimals.has(animal.id);
        if (isPregnant) {
          pregnantCount++;
          return; // Skip pregnant animals from heat monitoring
        }

        const lastHeatDate = lastHeatByAnimal.get(animal.id) || null;
        let expectedNextHeat: string | null = null;
        let daysSinceLastHeat: number | null = null;
        let daysUntilExpectedHeat: number | null = null;
        let isOverdue = false;
        let needsObservation = false;

        if (lastHeatDate) {
          const lastHeat = parseISO(lastHeatDate);
          daysSinceLastHeat = differenceInDays(today, lastHeat);
          const expectedDate = addDays(lastHeat, AVERAGE_CYCLE_LENGTH);
          expectedNextHeat = expectedDate.toISOString();
          daysUntilExpectedHeat = differenceInDays(expectedDate, today);

          // Needs observation if expected heat is within 3 days
          needsObservation = daysUntilExpectedHeat >= -CYCLE_VARIANCE && daysUntilExpectedHeat <= CYCLE_VARIANCE;

          // Overdue if past expected date by more than variance
          isOverdue = daysUntilExpectedHeat < -CYCLE_VARIANCE;
        } else {
          // No heat record - needs observation
          needsObservation = true;
        }

        breedingEligibleAnimals.push({
          id: animal.id,
          name: animal.name,
          earTag: animal.ear_tag,
          gender: 'female',
          ageMonths,
          lastHeatDate,
          expectedNextHeat,
          daysSinceLastHeat,
          daysUntilExpectedHeat,
          isOverdue,
          isPregnant,
          needsObservation,
        });
      });

      const animalsNeedingObservation = breedingEligibleAnimals.filter(a => a.needsObservation && !a.isOverdue);
      const overdueAnimals = breedingEligibleAnimals.filter(a => a.isOverdue);

      // Get last heat check date
      const lastHeatCheckDate = heatRecords?.[0]?.detected_at || null;

      return {
        breedingEligibleCount: breedingEligibleAnimals.length,
        breedingEligibleAnimals,
        animalsNeedingObservation,
        overdueAnimals,
        pregnantCount,
        lastHeatCheckDate,
      };
    },
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });
}
