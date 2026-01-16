/**
 * Milk split calculation based on animal weight and lactation stage
 */

import { getEffectiveWeightWithDefault, DEFAULT_WEIGHTS } from "@/lib/animalWeightUtils";

export const LACTATION_STAGE_FACTORS: Record<string, number> = {
  'Early Lactation': 1.0,
  'Mid-Lactation': 0.85,
  'Late Lactation': 0.65,
};

// Re-export for backwards compatibility
export { DEFAULT_WEIGHTS };

interface AnimalForSplit {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  milking_stage: string | null;
  current_weight_kg: number | null;
  entry_weight_kg?: number | null;
  entry_weight_unknown?: boolean | null;
  birth_weight_kg?: number | null;
}

export interface MilkSplitResult {
  animalId: string;
  animalName: string;
  liters: number;
  weight: number;
  stage: string;
  score: number;
}

export function calculateMilkSplit(
  animals: AnimalForSplit[],
  totalLiters: number
): MilkSplitResult[] {
  if (animals.length === 0 || totalLiters <= 0) {
    return [];
  }

  // If single animal, assign all liters
  if (animals.length === 1) {
    const animal = animals[0];
    const weight = getEffectiveWeightWithDefault(animal);
    return [{
      animalId: animal.id,
      animalName: animal.name || animal.ear_tag || 'Unknown',
      liters: totalLiters,
      weight,
      stage: animal.milking_stage || 'Unknown',
      score: 1,
    }];
  }

  // Calculate production score for each animal using effective weight
  const scores = animals.map(animal => {
    const weight = getEffectiveWeightWithDefault(animal);
    const factor = LACTATION_STAGE_FACTORS[animal.milking_stage || ''] || 0.75;
    const score = weight * factor;
    
    return {
      animalId: animal.id,
      animalName: animal.name || animal.ear_tag || 'Unknown',
      weight,
      stage: animal.milking_stage || 'Unknown',
      score,
    };
  });

  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

  // Calculate proportional liters for each
  return scores.map(s => ({
    ...s,
    liters: Math.round((s.score / totalScore) * totalLiters * 100) / 100, // Round to 2 decimal places
  }));
}
