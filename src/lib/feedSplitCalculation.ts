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
  cost?: number;
}

/**
 * Calculate cost per kilogram from inventory data
 */
export function calculateCostPerKg(
  costPerUnit: number | null,
  weightPerUnit: number | null,
  unit: string
): number {
  if (!costPerUnit || costPerUnit <= 0) return 0;
  
  // If unit is already "kg", cost_per_unit is cost per kg
  if (unit === 'kg') return costPerUnit;
  
  // If we have weight_per_unit, calculate cost per kg
  if (weightPerUnit && weightPerUnit > 0) {
    return costPerUnit / weightPerUnit;
  }
  
  // Default: assume 1 unit = 1 kg if no weight info
  return costPerUnit;
}

export function calculateFeedSplit(
  animals: AnimalForFeedSplit[],
  totalKg: number,
  costPerKg: number = 0
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
      cost: costPerKg > 0 ? Math.round(totalKg * costPerKg * 100) / 100 : undefined,
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
  return animalWeights.map(a => {
    const kilograms = Math.round((a.weight / totalWeight) * totalKg * 100) / 100;
    return {
      ...a,
      kilograms,
      percentage: Math.round((a.weight / totalWeight) * 100),
      cost: costPerKg > 0 ? Math.round(kilograms * costPerKg * 100) / 100 : undefined,
    };
  });
}
