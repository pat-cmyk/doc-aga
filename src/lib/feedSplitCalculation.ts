/**
 * Feed split calculation based on animal weight
 */

// Default weights by livestock type when actual weight is unknown
export const DEFAULT_WEIGHTS: Record<string, number> = {
  cattle: 400,
  carabao: 450,
  goat: 50,
  sheep: 45,
};

interface AnimalForFeedSplit {
  id: string;
  name: string | null;
  ear_tag: string | null;
  livestock_type: string;
  current_weight_kg: number | null;
}

export interface FeedSplitResult {
  animalId: string;
  animalName: string;
  kilograms: number;
  weight: number;
  percentage: number;
}

export function calculateFeedSplit(
  animals: AnimalForFeedSplit[],
  totalKg: number
): FeedSplitResult[] {
  if (animals.length === 0 || totalKg <= 0) {
    return [];
  }

  // If single animal, assign all feed
  if (animals.length === 1) {
    const animal = animals[0];
    const weight = animal.current_weight_kg || DEFAULT_WEIGHTS[animal.livestock_type] || 400;
    return [{
      animalId: animal.id,
      animalName: animal.name || animal.ear_tag || 'Unknown',
      kilograms: totalKg,
      weight,
      percentage: 100,
    }];
  }

  // Calculate weight for each animal
  const animalWeights = animals.map(animal => {
    const weight = animal.current_weight_kg || DEFAULT_WEIGHTS[animal.livestock_type] || 400;
    return {
      animalId: animal.id,
      animalName: animal.name || animal.ear_tag || 'Unknown',
      weight,
    };
  });

  const totalWeight = animalWeights.reduce((sum, a) => sum + a.weight, 0);

  // Calculate proportional feed for each animal
  return animalWeights.map(a => ({
    ...a,
    kilograms: Math.round((a.weight / totalWeight) * totalKg * 100) / 100,
    percentage: Math.round((a.weight / totalWeight) * 100),
  }));
}
