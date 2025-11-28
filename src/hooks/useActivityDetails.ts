import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  avatar_url: string | null;
  current_weight_kg: number | null;
  livestock_type: string;
  breed: string | null;
  life_stage: string | null;
}

interface MilkingRecord {
  record_date: string;
  liters: number;
}

interface WeightRecord {
  measurement_date: string;
  weight_kg: number;
}

interface UseActivityDetailsResult {
  animals: Animal[];
  historicalMilking: Map<string, { average: number; records: MilkingRecord[] }>;
  previousWeights: Map<string, number>;
  isLoading: boolean;
}

export const useActivityDetails = (
  activityType: string,
  animalIds: string[],
  enabled: boolean
): UseActivityDetailsResult => {
  // Fetch animal details
  const { data: animals = [], isLoading: isLoadingAnimals } = useQuery({
    queryKey: ['activity-animals', animalIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animals')
        .select('id, name, ear_tag, avatar_url, current_weight_kg, livestock_type, breed, life_stage')
        .in('id', animalIds);

      if (error) throw error;
      return data as Animal[];
    },
    enabled: enabled && animalIds.length > 0,
  });

  // Fetch historical milking data for milking activities
  const { data: milkingData, isLoading: isLoadingMilking } = useQuery({
    queryKey: ['historical-milking', animalIds],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7);
      const { data, error } = await supabase
        .from('milking_records')
        .select('animal_id, record_date, liters')
        .in('animal_id', animalIds)
        .gte('record_date', sevenDaysAgo.toISOString().split('T')[0])
        .order('record_date', { ascending: false });

      if (error) throw error;

      // Group by animal_id and calculate averages
      const grouped = new Map<string, { average: number; records: MilkingRecord[] }>();
      
      data?.forEach((record) => {
        if (!grouped.has(record.animal_id)) {
          grouped.set(record.animal_id, { average: 0, records: [] });
        }
        grouped.get(record.animal_id)!.records.push({
          record_date: record.record_date,
          liters: record.liters,
        });
      });

      // Calculate averages
      grouped.forEach((value, key) => {
        const total = value.records.reduce((sum, r) => sum + r.liters, 0);
        value.average = value.records.length > 0 ? total / value.records.length : 0;
      });

      return grouped;
    },
    enabled: enabled && activityType === 'milking' && animalIds.length > 0,
  });

  // Fetch previous weight records for weight measurement activities
  const { data: weightData, isLoading: isLoadingWeights } = useQuery({
    queryKey: ['previous-weights', animalIds],
    queryFn: async () => {
      const previousWeights = new Map<string, number>();

      for (const animalId of animalIds) {
        const { data, error } = await supabase
          .from('weight_records')
          .select('weight_kg, measurement_date')
          .eq('animal_id', animalId)
          .order('measurement_date', { ascending: false })
          .limit(2); // Get last 2 to find the previous one

        if (error) throw error;
        
        // If there's at least one record, use it as previous
        if (data && data.length > 0) {
          // If there are 2 records, use the second one (older), otherwise use the first
          const previousWeight = data.length > 1 ? data[1].weight_kg : data[0].weight_kg;
          previousWeights.set(animalId, previousWeight);
        }
      }

      return previousWeights;
    },
    enabled: enabled && activityType === 'weight_measurement' && animalIds.length > 0,
  });

  return {
    animals,
    historicalMilking: milkingData || new Map(),
    previousWeights: weightData || new Map(),
    isLoading: isLoadingAnimals || isLoadingMilking || isLoadingWeights,
  };
};
