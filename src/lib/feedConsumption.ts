/**
 * Unified Feed Consumption Service
 * 
 * Single Source of Truth for feed consumption calculations across the application.
 * Uses dry matter intake as percentage of body weight, then converts to fresh forage.
 * 
 * Used by:
 * - Dashboard (Feed Stock days calculation)
 * - Feed Forecast (6-month projections)
 * - Feed Inventory Comparison
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Dry matter intake as percentage of body weight by life stage
 * Based on dairy cattle nutrition research
 */
export const DRY_MATTER_PERCENTAGES: Record<string, number> = {
  // Lactating animals need highest intake for milk production
  lactating: 0.035,        // 3.5% of body weight
  
  // Young calves need high intake for rapid growth
  calf: 0.030,             // 3.0% of body weight
  bullCalf: 0.030,         // 3.0% of body weight
  
  // Growing animals
  heiferCalf: 0.025,       // 2.5% of body weight
  breedingHeifer: 0.025,   // 2.5% of body weight
  youngBull: 0.025,        // 2.5% of body weight
  
  // Maintenance/dry period
  pregnantHeifer: 0.020,   // 2.0% of body weight
  matureCow: 0.020,        // 2.0% of body weight
  matureBull: 0.025,       // 2.5% (bulls need more for maintenance)
  dryPeriod: 0.020,        // 2.0% of body weight
  
  // Default fallback
  default: 0.022           // 2.2% of body weight
};

/**
 * Dry matter content in fresh forage
 * Used to convert dry matter requirements to fresh weight
 */
export const DRY_MATTER_CONTENT = 0.30; // 30% dry matter in fresh forage

/**
 * Diet composition ratios
 */
export const DIET_RATIOS = {
  roughage: 0.70,    // 70% of diet is roughage (grass, hay, silage)
  concentrate: 0.30  // 30% of diet is concentrate (grains, pellets)
} as const;

/**
 * Default weights by livestock type when actual weight is unavailable
 */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  cattle: 400,
  carabao: 350,
  goat: 40,
  sheep: 50
};

// ============================================================================
// TYPES
// ============================================================================

export interface AnimalForConsumption {
  id?: string;
  current_weight_kg?: number | null;
  entry_weight_kg?: number | null;
  birth_weight_kg?: number | null;
  livestock_type?: string;
  life_stage?: string | null;
  milking_stage?: string | null;
  gender?: string;
}

export interface ConsumptionBreakdown {
  dryMatterKgPerDay: number;
  freshForageKgPerDay: number;
  roughageKgPerDay: number;
  concentrateKgPerDay: number;
}

export interface FarmConsumptionSummary {
  totalDryMatterKgPerDay: number;
  totalFreshForageKgPerDay: number;
  totalRoughageKgPerDay: number;
  totalConcentrateKgPerDay: number;
  animalCount: number;
  breakdownByStage: Record<string, {
    count: number;
    dryMatterKgPerDay: number;
    freshForageKgPerDay: number;
  }>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the effective weight for an animal, using priority order:
 * current_weight > entry_weight > birth_weight > default by livestock type
 */
export function getEffectiveWeight(animal: AnimalForConsumption): number {
  if (animal.current_weight_kg && animal.current_weight_kg > 0) {
    return animal.current_weight_kg;
  }
  if (animal.entry_weight_kg && animal.entry_weight_kg > 0) {
    return animal.entry_weight_kg;
  }
  if (animal.birth_weight_kg && animal.birth_weight_kg > 0) {
    return animal.birth_weight_kg;
  }
  
  // Fallback to default weight by livestock type
  const type = (animal.livestock_type || 'cattle').toLowerCase();
  return DEFAULT_WEIGHTS[type] || DEFAULT_WEIGHTS.cattle;
}

/**
 * Get the dry matter percentage based on life stage and milking status
 */
export function getDryMatterPercentage(
  lifeStage: string | null | undefined,
  milkingStage: string | null | undefined,
  gender?: string
): number {
  // Lactating animals get highest percentage
  if (milkingStage && milkingStage !== 'Dry Period') {
    return DRY_MATTER_PERCENTAGES.lactating;
  }
  
  // Dry period gets maintenance level
  if (milkingStage === 'Dry Period') {
    return DRY_MATTER_PERCENTAGES.dryPeriod;
  }
  
  // Map life stages to percentages
  const stageMap: Record<string, string> = {
    'Calf': 'calf',
    'Bull Calf': 'bullCalf',
    'Heifer Calf': 'heiferCalf',
    'Breeding Heifer': 'breedingHeifer',
    'Young Bull': 'youngBull',
    'Pregnant Heifer': 'pregnantHeifer',
    'Mature Cow': 'matureCow',
    'Mature Bull': 'matureBull'
  };
  
  if (lifeStage && stageMap[lifeStage]) {
    return DRY_MATTER_PERCENTAGES[stageMap[lifeStage]];
  }
  
  // Gender-based fallback for unknown stages
  if (gender?.toLowerCase() === 'male') {
    return DRY_MATTER_PERCENTAGES.matureBull;
  }
  
  return DRY_MATTER_PERCENTAGES.default;
}

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate daily dry matter intake for a single animal
 * @returns Dry matter requirement in kg per day
 */
export function calculateDryMatterIntake(animal: AnimalForConsumption): number {
  const weight = getEffectiveWeight(animal);
  const dmPercentage = getDryMatterPercentage(
    animal.life_stage,
    animal.milking_stage,
    animal.gender
  );
  
  return weight * dmPercentage;
}

/**
 * Calculate daily fresh forage intake for a single animal
 * Converts dry matter to fresh weight using DRY_MATTER_CONTENT
 * @returns Fresh forage requirement in kg per day
 */
export function calculateFreshForageIntake(animal: AnimalForConsumption): number {
  const dryMatter = calculateDryMatterIntake(animal);
  return dryMatter / DRY_MATTER_CONTENT;
}

/**
 * Calculate complete consumption breakdown for a single animal
 */
export function calculateAnimalConsumption(animal: AnimalForConsumption): ConsumptionBreakdown {
  const dryMatterKgPerDay = calculateDryMatterIntake(animal);
  const freshForageKgPerDay = dryMatterKgPerDay / DRY_MATTER_CONTENT;
  
  return {
    dryMatterKgPerDay: Math.round(dryMatterKgPerDay * 100) / 100,
    freshForageKgPerDay: Math.round(freshForageKgPerDay * 100) / 100,
    roughageKgPerDay: Math.round(freshForageKgPerDay * DIET_RATIOS.roughage * 100) / 100,
    concentrateKgPerDay: Math.round(freshForageKgPerDay * DIET_RATIOS.concentrate * 100) / 100
  };
}

/**
 * Calculate total daily consumption for all animals on a farm
 * This is the main function used by dashboard and inventory calculations
 */
export function calculateFarmDailyConsumption(
  animals: AnimalForConsumption[]
): FarmConsumptionSummary {
  let totalDryMatter = 0;
  let totalFreshForage = 0;
  const breakdownByStage: Record<string, { count: number; dryMatterKgPerDay: number; freshForageKgPerDay: number }> = {};
  
  animals.forEach(animal => {
    const dryMatter = calculateDryMatterIntake(animal);
    const freshForage = dryMatter / DRY_MATTER_CONTENT;
    
    totalDryMatter += dryMatter;
    totalFreshForage += freshForage;
    
    // Group by life stage
    const stageKey = animal.life_stage || 'Unknown';
    if (!breakdownByStage[stageKey]) {
      breakdownByStage[stageKey] = { count: 0, dryMatterKgPerDay: 0, freshForageKgPerDay: 0 };
    }
    breakdownByStage[stageKey].count += 1;
    breakdownByStage[stageKey].dryMatterKgPerDay += dryMatter;
    breakdownByStage[stageKey].freshForageKgPerDay += freshForage;
  });
  
  // Round values in breakdown
  Object.keys(breakdownByStage).forEach(key => {
    breakdownByStage[key].dryMatterKgPerDay = Math.round(breakdownByStage[key].dryMatterKgPerDay * 10) / 10;
    breakdownByStage[key].freshForageKgPerDay = Math.round(breakdownByStage[key].freshForageKgPerDay * 10) / 10;
  });
  
  return {
    totalDryMatterKgPerDay: Math.round(totalDryMatter * 10) / 10,
    totalFreshForageKgPerDay: Math.round(totalFreshForage * 10) / 10,
    totalRoughageKgPerDay: Math.round(totalFreshForage * DIET_RATIOS.roughage * 10) / 10,
    totalConcentrateKgPerDay: Math.round(totalFreshForage * DIET_RATIOS.concentrate * 10) / 10,
    animalCount: animals.length,
    breakdownByStage
  };
}

/**
 * Calculate days of stock remaining given inventory and daily consumption
 */
export function calculateDaysOfStock(
  inventoryKg: number,
  dailyConsumptionKg: number
): number | null {
  if (dailyConsumptionKg <= 0) {
    return null; // Cannot calculate without consumption
  }
  
  return Math.floor(inventoryKg / dailyConsumptionKg);
}

/**
 * Calculate days of stock for roughage and concentrate separately
 */
export function calculateCategoryDaysOfStock(
  roughageKg: number,
  concentrateKg: number,
  dailyFreshForageKg: number
): { roughageDays: number | null; concentrateDays: number | null; feedStockDays: number | null } {
  if (dailyFreshForageKg <= 0) {
    return { roughageDays: null, concentrateDays: null, feedStockDays: null };
  }
  
  const dailyRoughage = dailyFreshForageKg * DIET_RATIOS.roughage;
  const dailyConcentrate = dailyFreshForageKg * DIET_RATIOS.concentrate;
  
  const roughageDays = dailyRoughage > 0 ? Math.floor(roughageKg / dailyRoughage) : null;
  const concentrateDays = dailyConcentrate > 0 ? Math.floor(concentrateKg / dailyConcentrate) : null;
  
  // Feed stock days is limited by the category that runs out first
  // But we show roughage days as the main metric since it's 70% of diet
  return {
    roughageDays,
    concentrateDays,
    feedStockDays: roughageDays // Primary metric is roughage
  };
}

/**
 * Legacy compatibility: Calculate consumption from animal counts
 * Use this only when full animal data is not available
 * @deprecated Prefer calculateFarmDailyConsumption with full animal data
 */
export function calculateConsumptionFromCounts(
  animalCounts: Array<{ livestockType: string; count: number; avgWeight?: number }>
): number {
  let totalFreshForage = 0;
  
  animalCounts.forEach(({ livestockType, count, avgWeight }) => {
    const type = livestockType.toLowerCase();
    const weight = avgWeight || DEFAULT_WEIGHTS[type] || DEFAULT_WEIGHTS.cattle;
    
    // Use default maintenance percentage
    const dryMatter = weight * DRY_MATTER_PERCENTAGES.default;
    const freshForage = dryMatter / DRY_MATTER_CONTENT;
    
    totalFreshForage += freshForage * count;
  });
  
  return Math.round(totalFreshForage * 10) / 10;
}
