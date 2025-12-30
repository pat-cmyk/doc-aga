import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WeightDataCompleteness {
  totalAnimals: number;
  missingEntryWeight: number;
  missingBirthWeight: number;
  unknownEntryWeight: number;
  completeWeightData: number;
  completenessPercentage: number;
}

export const useWeightDataCompleteness = (farmId: string) => {
  return useQuery<WeightDataCompleteness>({
    queryKey: ["weight-data-completeness", farmId],
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: animals, error } = await supabase
        .from("animals")
        .select("id, entry_weight_kg, entry_weight_unknown, birth_weight_kg, birth_date, farm_entry_date")
        .eq("farm_id", farmId)
        .eq("is_deleted", false)
        .is("exit_date", null);

      if (error) throw error;

      const totalAnimals = animals?.length || 0;
      let missingEntryWeight = 0;
      let missingBirthWeight = 0;
      let unknownEntryWeight = 0;
      let completeWeightData = 0;

      animals?.forEach((animal) => {
        const isAcquired = animal.farm_entry_date !== null;
        const hasEntryWeight = animal.entry_weight_kg !== null;
        const hasBirthWeight = animal.birth_weight_kg !== null;
        const isEntryUnknown = animal.entry_weight_unknown === true;

        if (isAcquired) {
          // Acquired animals: check entry weight
          if (isEntryUnknown) {
            unknownEntryWeight++;
            completeWeightData++;
          } else if (!hasEntryWeight) {
            missingEntryWeight++;
          } else {
            completeWeightData++;
          }
        } else {
          // Farm-born animals: check birth weight
          if (animal.birth_date && !hasBirthWeight) {
            missingBirthWeight++;
          } else {
            completeWeightData++;
          }
        }
      });

      return {
        totalAnimals,
        missingEntryWeight,
        missingBirthWeight,
        unknownEntryWeight,
        completeWeightData,
        completenessPercentage: totalAnimals > 0 ? (completeWeightData / totalAnimals) * 100 : 100,
      };
    },
  });
};
