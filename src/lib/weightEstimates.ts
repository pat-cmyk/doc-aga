import { differenceInMonths } from "date-fns";

export interface WeightEstimateData {
  birthDate: Date;
  gender: string;
  breed?: string;
  lifeStage?: string | null;
}

// Weight ranges by life stage (in kg) - based on Holstein/Jersey standards
const FEMALE_WEIGHT_RANGES = {
  "Calf": { min: 40, max: 120, avgMonthlyGrowth: 25 },
  "Heifer Calf": { min: 120, max: 200, avgMonthlyGrowth: 20 },
  "Breeding Heifer": { min: 200, max: 380, avgMonthlyGrowth: 15 },
  "Pregnant Heifer": { min: 350, max: 450, avgMonthlyGrowth: 10 },
  "First-Calf Heifer": { min: 400, max: 500, avgMonthlyGrowth: 8 },
  "Mature Cow": { min: 450, max: 650, avgMonthlyGrowth: 2 },
};

const MALE_WEIGHT_RANGES = {
  "Bull Calf": { min: 40, max: 180, avgMonthlyGrowth: 30 },
  "Young Bull": { min: 180, max: 400, avgMonthlyGrowth: 20 },
  "Mature Bull": { min: 400, max: 800, avgMonthlyGrowth: 5 },
};

/**
 * Estimate weight based on age and life stage
 */
export function estimateWeightByAge(data: WeightEstimateData): number {
  const ageInMonths = differenceInMonths(new Date(), data.birthDate);
  const isMale = data.gender?.toLowerCase() === "male";
  
  // Get weight range for current life stage
  const weightRange = isMale 
    ? getWeightRangeForMale(data.lifeStage, ageInMonths)
    : getWeightRangeForFemale(data.lifeStage, ageInMonths);
  
  if (!weightRange) {
    // Fallback to age-based estimation
    return estimateByAgeOnly(ageInMonths, isMale);
  }
  
  // Use average of min and max for the stage
  return Math.round((weightRange.min + weightRange.max) / 2);
}

/**
 * Get weight range for a specific life stage
 */
export function getWeightRange(lifeStage: string | null, gender: string): {
  min: number;
  max: number;
  avgMonthlyGrowth: number;
} | null {
  if (!lifeStage) return null;
  
  const isMale = gender?.toLowerCase() === "male";
  const ranges = isMale ? MALE_WEIGHT_RANGES : FEMALE_WEIGHT_RANGES;
  
  return ranges[lifeStage as keyof typeof ranges] || null;
}

/**
 * Get expected weight range for current stage
 */
function getWeightRangeForFemale(lifeStage: string | null, ageInMonths: number) {
  if (lifeStage && FEMALE_WEIGHT_RANGES[lifeStage as keyof typeof FEMALE_WEIGHT_RANGES]) {
    return FEMALE_WEIGHT_RANGES[lifeStage as keyof typeof FEMALE_WEIGHT_RANGES];
  }
  
  // Fallback based on age
  if (ageInMonths < 8) return FEMALE_WEIGHT_RANGES["Calf"];
  if (ageInMonths < 12) return FEMALE_WEIGHT_RANGES["Heifer Calf"];
  if (ageInMonths < 24) return FEMALE_WEIGHT_RANGES["Breeding Heifer"];
  return FEMALE_WEIGHT_RANGES["Mature Cow"];
}

function getWeightRangeForMale(lifeStage: string | null, ageInMonths: number) {
  if (lifeStage && MALE_WEIGHT_RANGES[lifeStage as keyof typeof MALE_WEIGHT_RANGES]) {
    return MALE_WEIGHT_RANGES[lifeStage as keyof typeof MALE_WEIGHT_RANGES];
  }
  
  // Fallback based on age
  if (ageInMonths < 12) return MALE_WEIGHT_RANGES["Bull Calf"];
  if (ageInMonths < 24) return MALE_WEIGHT_RANGES["Young Bull"];
  return MALE_WEIGHT_RANGES["Mature Bull"];
}

/**
 * Simple age-based weight estimation (fallback)
 */
function estimateByAgeOnly(ageInMonths: number, isMale: boolean): number {
  // Birth weight: 30-45 kg
  const birthWeight = 40;
  
  if (isMale) {
    // Males grow faster
    if (ageInMonths < 12) return Math.round(birthWeight + (ageInMonths * 30));
    if (ageInMonths < 24) return Math.round(180 + ((ageInMonths - 12) * 20));
    return Math.round(400 + ((ageInMonths - 24) * 5));
  } else {
    // Females
    if (ageInMonths < 8) return Math.round(birthWeight + (ageInMonths * 25));
    if (ageInMonths < 12) return Math.round(120 + ((ageInMonths - 8) * 20));
    if (ageInMonths < 24) return Math.round(200 + ((ageInMonths - 12) * 15));
    return Math.round(380 + ((ageInMonths - 24) * 5));
  }
}

/**
 * Calculate expected future weight
 */
export function estimateFutureWeight(
  currentWeight: number,
  lifeStage: string | null,
  gender: string,
  monthsAhead: number
): number {
  const weightRange = getWeightRange(lifeStage, gender);
  
  if (!weightRange) {
    // Conservative growth estimate
    return Math.round(currentWeight + (monthsAhead * 5));
  }
  
  const projectedWeight = currentWeight + (monthsAhead * weightRange.avgMonthlyGrowth);
  
  // Cap at max weight for stage
  return Math.round(Math.min(projectedWeight, weightRange.max));
}
