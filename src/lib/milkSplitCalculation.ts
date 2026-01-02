/**
 * Milk split calculation based on animal weight and lactation stage
 */

export const LACTATION_STAGE_FACTORS: Record<string, number> = {
  'Early Lactation': 1.0,
  'Mid-Lactation': 0.85,
  'Late Lactation': 0.65,
};

// Default weights by livestock type when actual weight is unknown
export const DEFAULT_WEIGHTS: Record<string, number> = {
  cattle: 400,
  carabao: 450,
  goat: 50,
  sheep: 45,
};

interface AnimalForSplit {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  milking_stage: string | null;
  current_weight_kg: number | null;
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
    const weight = animal.current_weight_kg || DEFAULT_WEIGHTS[animal.livestock_type] || 400;
    return [{
      animalId: animal.id,
      animalName: animal.name || animal.ear_tag || 'Unknown',
      liters: totalLiters,
      weight,
      stage: animal.milking_stage || 'Unknown',
      score: 1,
    }];
  }

  // Calculate production score for each animal
  const scores = animals.map(animal => {
    const weight = animal.current_weight_kg || DEFAULT_WEIGHTS[animal.livestock_type] || 400;
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
