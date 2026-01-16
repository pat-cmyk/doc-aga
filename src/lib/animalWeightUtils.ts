/**
 * Single source of truth for animal weight data
 * 
 * Priority order for determining effective weight:
 * 1. current_weight_kg (latest measured weight)
 * 2. entry_weight_kg (for acquired animals)
 * 3. birth_weight_kg (for farm-born animals)
 * 4. null (no weight data)
 */

export interface AnimalWeightData {
  current_weight_kg?: number | null;
  entry_weight_kg?: number | null;
  entry_weight_unknown?: boolean | null;
  birth_weight_kg?: number | null;
  livestock_type?: string;
}

// Default weights by livestock type when actual weight is unknown
export const DEFAULT_WEIGHTS: Record<string, number> = {
  cattle: 400,
  carabao: 450,
  goat: 50,
  sheep: 45,
};

/**
 * Get the effective weight for an animal using priority fallback logic
 */
export function getEffectiveWeight(animal: AnimalWeightData): number | null {
  // Priority 1: Current weight (most recent measurement)
  if (animal.current_weight_kg !== null && animal.current_weight_kg !== undefined) {
    return animal.current_weight_kg;
  }
  
  // Priority 2: Entry weight for acquired animals
  if (animal.entry_weight_kg !== null && animal.entry_weight_kg !== undefined) {
    return animal.entry_weight_kg;
  }
  
  // Priority 3: Birth weight for farm-born animals
  if (animal.birth_weight_kg !== null && animal.birth_weight_kg !== undefined) {
    return animal.birth_weight_kg;
  }
  
  // No weight data available
  return null;
}

/**
 * Get effective weight with default fallback based on livestock type
 */
export function getEffectiveWeightWithDefault(animal: AnimalWeightData): number {
  const effectiveWeight = getEffectiveWeight(animal);
  if (effectiveWeight !== null) {
    return effectiveWeight;
  }
  return DEFAULT_WEIGHTS[animal.livestock_type || 'cattle'] || 400;
}

/**
 * Check if animal has any weight data (including "unknown" flag)
 */
export function hasWeightData(animal: AnimalWeightData): boolean {
  return getEffectiveWeight(animal) !== null || animal.entry_weight_unknown === true;
}

/**
 * Get the source of the weight data for display purposes
 */
export function getWeightSource(animal: AnimalWeightData): 'current' | 'entry' | 'birth' | 'unknown' | 'none' {
  if (animal.current_weight_kg !== null && animal.current_weight_kg !== undefined) return 'current';
  if (animal.entry_weight_kg !== null && animal.entry_weight_kg !== undefined) return 'entry';
  if (animal.birth_weight_kg !== null && animal.birth_weight_kg !== undefined) return 'birth';
  if (animal.entry_weight_unknown) return 'unknown';
  return 'none';
}

/**
 * Format weight display with source indicator
 */
export function formatWeightWithSource(animal: AnimalWeightData): string {
  const weight = getEffectiveWeight(animal);
  if (weight === null) {
    return animal.entry_weight_unknown ? 'Unknown weight' : 'No weight';
  }
  
  const source = getWeightSource(animal);
  const suffix = source === 'entry' ? ' (entry)' : source === 'birth' ? ' (birth)' : '';
  return `${weight}kg${suffix}`;
}
