/**
 * OVR Score Calculator for Bovine Bio-Card
 * 
 * Calculates an Overall Performance Rating (0-100) similar to FIFA/sports games.
 * Weights are adjusted based on livestock purpose (dairy vs beef).
 */

export interface OVRBreakdown {
  production: number;      // 0-100: Milk yield or weight gain
  health: number;          // 0-100: Vaccination compliance, no active issues
  fertility: number;       // 0-100: Conception rate, calving interval
  growth: number;          // 0-100: ADG performance vs benchmark
  bodyCondition: number;   // 0-100: BCS within optimal range
}

export interface OVRResult {
  score: number;           // Final OVR 0-100
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  breakdown: OVRBreakdown;
  trend: 'up' | 'down' | 'stable';
}

// Weight configurations by livestock purpose
const DAIRY_WEIGHTS = {
  production: 0.30,
  health: 0.25,
  fertility: 0.20,
  growth: 0.15,
  bodyCondition: 0.10,
};

const BEEF_WEIGHTS = {
  production: 0.40,
  health: 0.25,
  fertility: 0.15,
  growth: 0.15,
  bodyCondition: 0.05,
};

export interface OVRInputs {
  // Production metrics
  avgDailyMilk?: number | null;          // Liters (for dairy)
  milkBenchmark?: number;                 // Expected liters for stage
  adgGrams?: number | null;               // Average daily gain
  adgBenchmark?: number;                  // Expected ADG
  
  // Health metrics
  vaccinationCompliance: number;          // 0-100 percentage
  hasActiveHealthIssues: boolean;
  hasWithdrawalPeriod: boolean;
  overdueVaccineCount: number;
  
  // Fertility metrics
  isPregnant?: boolean;
  daysSinceLastCalving?: number | null;
  calvingIntervalDays?: number | null;    // Target ~365-400 days
  heatCycleRegularity?: number;           // 0-100 based on 18-24 day cycles
  
  // Growth metrics
  adgPercentOfExpected?: number | null;   // From useGrowthBenchmark
  weightStatus?: 'on_track' | 'below' | 'above' | 'critical' | null;
  
  // Body Condition
  latestBCS?: number | null;              // 1-5 scale
  bcsOptimalMin?: number;                 // Usually 2.5
  bcsOptimalMax?: number;                 // Usually 4.0
  
  // Context
  livestockType: string;
  lifeStage?: string | null;
  gender?: string | null;
  isMilking?: boolean;
}

/**
 * Calculate production score based on milk yield or weight gain
 */
function calculateProductionScore(inputs: OVRInputs): number {
  const { avgDailyMilk, milkBenchmark, adgGrams, adgBenchmark, isMilking, gender } = inputs;
  
  // For milking females, use milk production
  if (isMilking && gender?.toLowerCase() === 'female' && avgDailyMilk != null && milkBenchmark && milkBenchmark > 0) {
    const ratio = avgDailyMilk / milkBenchmark;
    // Score: 50 at 50% benchmark, 100 at 120% benchmark
    return Math.min(100, Math.max(0, ratio * 83));
  }
  
  // For others, use ADG
  if (adgGrams != null && adgBenchmark && adgBenchmark > 0) {
    const ratio = adgGrams / adgBenchmark;
    return Math.min(100, Math.max(0, ratio * 83));
  }
  
  // No data - return neutral score
  return 50;
}

/**
 * Calculate health score based on vaccination and active issues
 */
function calculateHealthScore(inputs: OVRInputs): number {
  const { 
    vaccinationCompliance, 
    hasActiveHealthIssues, 
    hasWithdrawalPeriod, 
    overdueVaccineCount 
  } = inputs;
  
  let score = vaccinationCompliance;
  
  // Penalties
  if (hasActiveHealthIssues) score -= 30;
  if (hasWithdrawalPeriod) score -= 20;
  score -= overdueVaccineCount * 10;
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate fertility score based on reproductive performance
 */
function calculateFertilityScore(inputs: OVRInputs): number {
  const { 
    isPregnant, 
    calvingIntervalDays, 
    heatCycleRegularity,
    gender,
    lifeStage 
  } = inputs;
  
  // Males or young animals get neutral score
  if (gender?.toLowerCase() === 'male' || lifeStage === 'calf' || lifeStage === 'kid') {
    return 75; // Neutral-positive
  }
  
  let score = 50; // Base
  
  // Pregnancy is positive
  if (isPregnant) score += 25;
  
  // Calving interval scoring (target 365-400 days)
  if (calvingIntervalDays != null) {
    if (calvingIntervalDays >= 365 && calvingIntervalDays <= 400) {
      score += 25; // Optimal
    } else if (calvingIntervalDays < 365) {
      score += 15; // Short but acceptable
    } else if (calvingIntervalDays <= 450) {
      score += 10; // Slightly long
    } else {
      score -= 10; // Too long
    }
  }
  
  // Heat cycle regularity bonus
  if (heatCycleRegularity != null) {
    score += (heatCycleRegularity / 100) * 20;
  }
  
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate growth score based on ADG performance
 */
function calculateGrowthScore(inputs: OVRInputs): number {
  const { adgPercentOfExpected, weightStatus } = inputs;
  
  // Use ADG percentage if available
  if (adgPercentOfExpected != null) {
    // 100% of expected = 80 points, 120% = 100 points
    return Math.min(100, Math.max(0, adgPercentOfExpected * 0.8));
  }
  
  // Fallback to weight status
  if (weightStatus) {
    switch (weightStatus) {
      case 'on_track': return 80;
      case 'above': return 90;
      case 'below': return 60;
      case 'critical': return 30;
      default: return 50;
    }
  }
  
  return 50; // No data
}

/**
 * Calculate body condition score (BCS) rating
 */
function calculateBCSScore(inputs: OVRInputs): number {
  const { latestBCS, bcsOptimalMin = 2.5, bcsOptimalMax = 4.0 } = inputs;
  
  if (latestBCS == null) return 50; // No data
  
  // Optimal range gets 100
  if (latestBCS >= bcsOptimalMin && latestBCS <= bcsOptimalMax) {
    return 100;
  }
  
  // Calculate distance from optimal
  if (latestBCS < bcsOptimalMin) {
    const deficit = bcsOptimalMin - latestBCS;
    return Math.max(0, 100 - deficit * 40);
  }
  
  if (latestBCS > bcsOptimalMax) {
    const excess = latestBCS - bcsOptimalMax;
    return Math.max(0, 100 - excess * 30);
  }
  
  return 50;
}

/**
 * Determine OVR tier based on score
 */
function getOVRTier(score: number): OVRResult['tier'] {
  if (score >= 90) return 'diamond';
  if (score >= 80) return 'gold';
  if (score >= 60) return 'silver';
  return 'bronze';
}

/**
 * Calculate the complete OVR score
 */
export function calculateOVRScore(
  inputs: OVRInputs,
  previousScore?: number
): OVRResult {
  const weights = inputs.livestockType === 'cattle' && inputs.isMilking 
    ? DAIRY_WEIGHTS 
    : BEEF_WEIGHTS;
  
  const breakdown: OVRBreakdown = {
    production: calculateProductionScore(inputs),
    health: calculateHealthScore(inputs),
    fertility: calculateFertilityScore(inputs),
    growth: calculateGrowthScore(inputs),
    bodyCondition: calculateBCSScore(inputs),
  };
  
  // Calculate weighted score
  const score = Math.round(
    breakdown.production * weights.production +
    breakdown.health * weights.health +
    breakdown.fertility * weights.fertility +
    breakdown.growth * weights.growth +
    breakdown.bodyCondition * weights.bodyCondition
  );
  
  // Determine trend
  let trend: OVRResult['trend'] = 'stable';
  if (previousScore != null) {
    if (score > previousScore + 2) trend = 'up';
    else if (score < previousScore - 2) trend = 'down';
  }
  
  return {
    score: Math.min(100, Math.max(0, score)),
    tier: getOVRTier(score),
    breakdown,
    trend,
  };
}

/**
 * Get display color for OVR tier
 */
export function getOVRTierColor(tier: OVRResult['tier']): string {
  switch (tier) {
    case 'diamond': return 'from-cyan-400 to-blue-500';
    case 'gold': return 'from-yellow-400 to-amber-500';
    case 'silver': return 'from-gray-300 to-gray-400';
    case 'bronze': return 'from-orange-400 to-orange-600';
  }
}

/**
 * Get status aura color based on triage priority
 */
export type StatusAura = 'green' | 'yellow' | 'red';

export function calculateStatusAura(inputs: {
  hasActiveWithdrawal: boolean;
  isQuarantined: boolean;
  hasOverdueVaccine: boolean;
  isBCSCritical: boolean;
  isInHeatWindow: boolean;
  hasActiveHealthIssue: boolean;
}): StatusAura {
  const { 
    hasActiveWithdrawal, 
    isQuarantined, 
    hasActiveHealthIssue,
    hasOverdueVaccine, 
    isBCSCritical, 
    isInHeatWindow 
  } = inputs;
  
  // Red: Immediate attention required
  if (hasActiveWithdrawal || isQuarantined || hasActiveHealthIssue) {
    return 'red';
  }
  
  // Yellow: Watch/action needed
  if (hasOverdueVaccine || isBCSCritical || isInHeatWindow) {
    return 'yellow';
  }
  
  // Green: All good
  return 'green';
}
