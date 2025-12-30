import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AcquisitionMetrics {
  count: number;
  avgHealthEvents: number;
  avgMilkProduction: number;
  mortalityRate: number;
  breedingSuccessRate: number;
}

export interface GrantSourceMetrics extends AcquisitionMetrics {
  source: string;
}

export interface GrantEffectivenessData {
  grantAnimals: AcquisitionMetrics;
  purchasedAnimals: AcquisitionMetrics;
  bornOnFarmAnimals: AcquisitionMetrics;
  byGrantSource: GrantSourceMetrics[];
}

export const useGrantEffectiveness = (
  region?: string,
  province?: string,
  municipality?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<GrantEffectivenessData>({
    queryKey: ["grant-effectiveness", region || "all", province || "all", municipality || "all"],
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Fetch animals with acquisition type
      let animalsQuery = supabase
        .from("animals")
        .select(`
          id,
          acquisition_type,
          grant_source,
          exit_date,
          exit_reason,
          farms!inner(region, province, municipality)
        `)
        .eq("is_deleted", false);

      if (region) animalsQuery = animalsQuery.eq("farms.region", region);
      if (province) animalsQuery = animalsQuery.eq("farms.province", province);
      if (municipality) animalsQuery = animalsQuery.eq("farms.municipality", municipality);

      const { data: animals, error: animalsError } = await animalsQuery;
      if (animalsError) throw animalsError;

      // Get animal IDs for further queries
      const animalIds = animals?.map(a => a.id) || [];
      
      if (animalIds.length === 0) {
        const emptyMetrics: AcquisitionMetrics = {
          count: 0,
          avgHealthEvents: 0,
          avgMilkProduction: 0,
          mortalityRate: 0,
          breedingSuccessRate: 0,
        };
        return {
          grantAnimals: emptyMetrics,
          purchasedAnimals: emptyMetrics,
          bornOnFarmAnimals: emptyMetrics,
          byGrantSource: [],
        };
      }

      // Fetch health records for these animals
      const { data: healthRecords } = await supabase
        .from("health_records")
        .select("animal_id")
        .in("animal_id", animalIds);

      // Fetch milking records
      const { data: milkingRecords } = await supabase
        .from("milking_records")
        .select("animal_id, liters")
        .in("animal_id", animalIds);

      // Fetch AI records for breeding success
      const { data: aiRecords } = await supabase
        .from("ai_records")
        .select("animal_id, pregnancy_confirmed")
        .in("animal_id", animalIds);

      // Group animals by acquisition type
      const grantAnimals = animals?.filter(a => a.acquisition_type === "grant") || [];
      const purchasedAnimals = animals?.filter(a => a.acquisition_type === "purchased") || [];
      const bornOnFarmAnimals = animals?.filter(a => a.acquisition_type === "born_on_farm") || [];

      // Helper to calculate metrics for a group
      const calculateMetrics = (animalGroup: typeof animals): AcquisitionMetrics => {
        if (!animalGroup || animalGroup.length === 0) {
          return {
            count: 0,
            avgHealthEvents: 0,
            avgMilkProduction: 0,
            mortalityRate: 0,
            breedingSuccessRate: 0,
          };
        }

        const groupIds = new Set(animalGroup.map(a => a.id));
        
        // Health events per animal
        const healthEventsCount = healthRecords?.filter(h => groupIds.has(h.animal_id)).length || 0;
        const avgHealthEvents = animalGroup.length > 0 ? healthEventsCount / animalGroup.length : 0;

        // Milk production per animal
        const groupMilkRecords = milkingRecords?.filter(m => groupIds.has(m.animal_id)) || [];
        const totalMilk = groupMilkRecords.reduce((sum, m) => sum + (m.liters || 0), 0);
        const animalsWithMilk = new Set(groupMilkRecords.map(m => m.animal_id)).size;
        const avgMilkProduction = animalsWithMilk > 0 ? totalMilk / animalsWithMilk : 0;

        // Mortality rate
        const deadAnimals = animalGroup.filter(a => 
          a.exit_date && (a.exit_reason === "died" || a.exit_reason === "slaughtered_emergency")
        ).length;
        const mortalityRate = animalGroup.length > 0 ? (deadAnimals / animalGroup.length) * 100 : 0;

        // Breeding success rate
        const groupAiRecords = aiRecords?.filter(r => groupIds.has(r.animal_id)) || [];
        const confirmedPregnancies = groupAiRecords.filter(r => r.pregnancy_confirmed).length;
        const breedingSuccessRate = groupAiRecords.length > 0 
          ? (confirmedPregnancies / groupAiRecords.length) * 100 
          : 0;

        return {
          count: animalGroup.length,
          avgHealthEvents: Math.round(avgHealthEvents * 10) / 10,
          avgMilkProduction: Math.round(avgMilkProduction * 10) / 10,
          mortalityRate: Math.round(mortalityRate * 10) / 10,
          breedingSuccessRate: Math.round(breedingSuccessRate * 10) / 10,
        };
      };

      // Calculate by grant source
      const grantSources: Record<string, typeof grantAnimals> = {};
      grantAnimals.forEach(animal => {
        const source = animal.grant_source || "Unknown Source";
        if (!grantSources[source]) grantSources[source] = [];
        grantSources[source].push(animal);
      });

      const byGrantSource: GrantSourceMetrics[] = Object.entries(grantSources)
        .map(([source, animalGroup]) => ({
          source,
          ...calculateMetrics(animalGroup),
        }))
        .sort((a, b) => b.count - a.count);

      return {
        grantAnimals: calculateMetrics(grantAnimals),
        purchasedAnimals: calculateMetrics(purchasedAnimals),
        bornOnFarmAnimals: calculateMetrics(bornOnFarmAnimals),
        byGrantSource,
      };
    },
  });
};
