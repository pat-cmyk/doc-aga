import { differenceInMonths } from "date-fns";

export interface WeightEstimateData {
  birthDate: Date;
  gender: string;
  breed?: string;
  lifeStage?: string | null;
  livestockType?: string; // NEW
}

// Weight ranges by life stage (in kg) - Cattle (Holstein/Jersey standards)
const CATTLE_FEMALE_WEIGHT_RANGES = {
  "Calf": { min: 40, max: 120, avgMonthlyGrowth: 25 },
  "Heifer Calf": { min: 120, max: 200, avgMonthlyGrowth: 20 },
  "Breeding Heifer": { min: 200, max: 380, avgMonthlyGrowth: 15 },
  "Pregnant Heifer": { min: 350, max: 450, avgMonthlyGrowth: 10 },
  "First-Calf Heifer": { min: 400, max: 500, avgMonthlyGrowth: 8 },
  "Mature Cow": { min: 450, max: 650, avgMonthlyGrowth: 2 },
};

const CATTLE_MALE_WEIGHT_RANGES = {
  "Bull Calf": { min: 40, max: 180, avgMonthlyGrowth: 30 },
  "Young Bull": { min: 180, max: 400, avgMonthlyGrowth: 20 },
  "Mature Bull": { min: 400, max: 800, avgMonthlyGrowth: 5 },
};

// Goat weight ranges
const GOAT_FEMALE_WEIGHT_RANGES = {
  "Kid": { min: 5, max: 15, avgMonthlyGrowth: 3 },
  "Young Doe": { min: 15, max: 30, avgMonthlyGrowth: 2.5 },
  "Mature Doe": { min: 30, max: 60, avgMonthlyGrowth: 0.5 },
};

const GOAT_MALE_WEIGHT_RANGES = {
  "Kid": { min: 5, max: 15, avgMonthlyGrowth: 3 },
  "Young Buck": { min: 15, max: 40, avgMonthlyGrowth: 3 },
  "Mature Buck": { min: 40, max: 80, avgMonthlyGrowth: 0.5 },
};

// Sheep weight ranges
const SHEEP_FEMALE_WEIGHT_RANGES = {
  "Lamb": { min: 8, max: 20, avgMonthlyGrowth: 4 },
  "Young Ewe": { min: 20, max: 40, avgMonthlyGrowth: 3 },
  "Mature Ewe": { min: 40, max: 80, avgMonthlyGrowth: 0.5 },
};

const SHEEP_MALE_WEIGHT_RANGES = {
  "Lamb": { min: 8, max: 20, avgMonthlyGrowth: 4 },
  "Young Ram": { min: 20, max: 50, avgMonthlyGrowth: 4 },
  "Mature Ram": { min: 50, max: 120, avgMonthlyGrowth: 0.5 },
};

// Carabao (Water Buffalo) weight ranges
const CARABAO_FEMALE_WEIGHT_RANGES = {
  "Calf": { min: 20, max: 60, avgMonthlyGrowth: 10 },
  "Young Female": { min: 60, max: 200, avgMonthlyGrowth: 15 },
  "Mature Female": { min: 200, max: 500, avgMonthlyGrowth: 2 },
};

const CARABAO_MALE_WEIGHT_RANGES = {
  "Calf": { min: 20, max: 60, avgMonthlyGrowth: 10 },
  "Young Bull": { min: 60, max: 250, avgMonthlyGrowth: 20 },
  "Mature Bull": { min: 250, max: 700, avgMonthlyGrowth: 2 },
};

/**
 * Estimate weight based on age and life stage
 */
export function estimateWeightByAge(data: WeightEstimateData): number {
  const ageInMonths = differenceInMonths(new Date(), data.birthDate);
  const isMale = data.gender?.toLowerCase() === "male";
  const livestockType = data.livestockType || 'cattle';
  
  // Get weight range for current life stage based on livestock type
  const weightRange = isMale 
    ? getWeightRangeForMale(data.lifeStage, ageInMonths, livestockType)
    : getWeightRangeForFemale(data.lifeStage, ageInMonths, livestockType);
  
  if (!weightRange) {
    // Fallback to age-based estimation
    return estimateByAgeOnly(ageInMonths, isMale, livestockType);
  }
  
  // Use average of min and max for the stage
  return Math.round((weightRange.min + weightRange.max) / 2);
}

/**
 * Get weight range for a specific life stage
 */
export function getWeightRange(lifeStage: string | null, gender: string, livestockType: string = 'cattle'): {
  min: number;
  max: number;
  avgMonthlyGrowth: number;
} | null {
  if (!lifeStage) return null;
  
  const isMale = gender?.toLowerCase() === "male";
  
  // Select appropriate weight ranges based on livestock type
  let ranges: any;
  switch (livestockType) {
    case 'goat':
      ranges = isMale ? GOAT_MALE_WEIGHT_RANGES : GOAT_FEMALE_WEIGHT_RANGES;
      break;
    case 'sheep':
      ranges = isMale ? SHEEP_MALE_WEIGHT_RANGES : SHEEP_FEMALE_WEIGHT_RANGES;
      break;
    case 'carabao':
      ranges = isMale ? CARABAO_MALE_WEIGHT_RANGES : CARABAO_FEMALE_WEIGHT_RANGES;
      break;
    case 'cattle':
    default:
      ranges = isMale ? CATTLE_MALE_WEIGHT_RANGES : CATTLE_FEMALE_WEIGHT_RANGES;
      break;
  }
  
  return ranges[lifeStage as keyof typeof ranges] || null;
}

/**
 * Get expected weight range for current stage
 */
function getWeightRangeForFemale(lifeStage: string | null, ageInMonths: number, livestockType: string = 'cattle') {
  // Select appropriate weight ranges
  let ranges: any;
  switch (livestockType) {
    case 'goat':
      ranges = GOAT_FEMALE_WEIGHT_RANGES;
      break;
    case 'sheep':
      ranges = SHEEP_FEMALE_WEIGHT_RANGES;
      break;
    case 'carabao':
      ranges = CARABAO_FEMALE_WEIGHT_RANGES;
      break;
    case 'cattle':
    default:
      ranges = CATTLE_FEMALE_WEIGHT_RANGES;
      break;
  }
  
  if (lifeStage && ranges[lifeStage as keyof typeof ranges]) {
    return ranges[lifeStage as keyof typeof ranges];
  }
  
  // Fallback based on age and livestock type
  if (livestockType === 'cattle') {
    if (ageInMonths < 8) return CATTLE_FEMALE_WEIGHT_RANGES["Calf"];
    if (ageInMonths < 12) return CATTLE_FEMALE_WEIGHT_RANGES["Heifer Calf"];
    if (ageInMonths < 24) return CATTLE_FEMALE_WEIGHT_RANGES["Breeding Heifer"];
    return CATTLE_FEMALE_WEIGHT_RANGES["Mature Cow"];
  } else if (livestockType === 'goat') {
    if (ageInMonths < 6) return GOAT_FEMALE_WEIGHT_RANGES["Kid"];
    if (ageInMonths < 12) return GOAT_FEMALE_WEIGHT_RANGES["Young Doe"];
    return GOAT_FEMALE_WEIGHT_RANGES["Mature Doe"];
  } else if (livestockType === 'sheep') {
    if (ageInMonths < 6) return SHEEP_FEMALE_WEIGHT_RANGES["Lamb"];
    if (ageInMonths < 12) return SHEEP_FEMALE_WEIGHT_RANGES["Young Ewe"];
    return SHEEP_FEMALE_WEIGHT_RANGES["Mature Ewe"];
  } else { // carabao
    if (ageInMonths < 12) return CARABAO_FEMALE_WEIGHT_RANGES["Calf"];
    if (ageInMonths < 24) return CARABAO_FEMALE_WEIGHT_RANGES["Young Female"];
    return CARABAO_FEMALE_WEIGHT_RANGES["Mature Female"];
  }
}

function getWeightRangeForMale(lifeStage: string | null, ageInMonths: number, livestockType: string = 'cattle') {
  // Select appropriate weight ranges
  let ranges: any;
  switch (livestockType) {
    case 'goat':
      ranges = GOAT_MALE_WEIGHT_RANGES;
      break;
    case 'sheep':
      ranges = SHEEP_MALE_WEIGHT_RANGES;
      break;
    case 'carabao':
      ranges = CARABAO_MALE_WEIGHT_RANGES;
      break;
    case 'cattle':
    default:
      ranges = CATTLE_MALE_WEIGHT_RANGES;
      break;
  }
  
  if (lifeStage && ranges[lifeStage as keyof typeof ranges]) {
    return ranges[lifeStage as keyof typeof ranges];
  }
  
  // Fallback based on age and livestock type
  if (livestockType === 'cattle') {
    if (ageInMonths < 12) return CATTLE_MALE_WEIGHT_RANGES["Bull Calf"];
    if (ageInMonths < 24) return CATTLE_MALE_WEIGHT_RANGES["Young Bull"];
    return CATTLE_MALE_WEIGHT_RANGES["Mature Bull"];
  } else if (livestockType === 'goat') {
    if (ageInMonths < 6) return GOAT_MALE_WEIGHT_RANGES["Kid"];
    if (ageInMonths < 12) return GOAT_MALE_WEIGHT_RANGES["Young Buck"];
    return GOAT_MALE_WEIGHT_RANGES["Mature Buck"];
  } else if (livestockType === 'sheep') {
    if (ageInMonths < 6) return SHEEP_MALE_WEIGHT_RANGES["Lamb"];
    if (ageInMonths < 12) return SHEEP_MALE_WEIGHT_RANGES["Young Ram"];
    return SHEEP_MALE_WEIGHT_RANGES["Mature Ram"];
  } else { // carabao
    if (ageInMonths < 12) return CARABAO_MALE_WEIGHT_RANGES["Calf"];
    if (ageInMonths < 24) return CARABAO_MALE_WEIGHT_RANGES["Young Bull"];
    return CARABAO_MALE_WEIGHT_RANGES["Mature Bull"];
  }
}

/**
 * Simple age-based weight estimation (fallback)
 */
function estimateByAgeOnly(ageInMonths: number, isMale: boolean, livestockType: string = 'cattle'): number {
  // Birth weights vary by livestock type
  let birthWeight: number;
  let growthRates: { early: number; mid: number; late: number };
  
  switch (livestockType) {
    case 'goat':
      birthWeight = 3;
      growthRates = isMale ? { early: 3, mid: 2.5, late: 0.5 } : { early: 3, mid: 2, late: 0.5 };
      break;
    case 'sheep':
      birthWeight = 4;
      growthRates = isMale ? { early: 4, mid: 3, late: 1 } : { early: 3.5, mid: 2.5, late: 0.5 };
      break;
    case 'carabao':
      birthWeight = 30;
      growthRates = isMale ? { early: 20, mid: 15, late: 5 } : { early: 15, mid: 10, late: 3 };
      break;
    case 'cattle':
    default:
      birthWeight = 40;
      growthRates = isMale ? { early: 30, mid: 20, late: 5 } : { early: 25, mid: 15, late: 5 };
      break;
  }
  
  if (isMale) {
    if (ageInMonths < 12) return Math.round(birthWeight + (ageInMonths * growthRates.early));
    if (ageInMonths < 24) return Math.round(birthWeight + (12 * growthRates.early) + ((ageInMonths - 12) * growthRates.mid));
    return Math.round(birthWeight + (12 * growthRates.early) + (12 * growthRates.mid) + ((ageInMonths - 24) * growthRates.late));
  } else {
    if (ageInMonths < 8) return Math.round(birthWeight + (ageInMonths * growthRates.early));
    if (ageInMonths < 12) return Math.round(birthWeight + (8 * growthRates.early) + ((ageInMonths - 8) * growthRates.mid));
    if (ageInMonths < 24) return Math.round(birthWeight + (8 * growthRates.early) + (4 * growthRates.mid) + ((ageInMonths - 12) * growthRates.late));
    return Math.round(birthWeight + (8 * growthRates.early) + (4 * growthRates.mid) + (12 * growthRates.late) + ((ageInMonths - 24) * (growthRates.late / 2)));
  }
}

/**
 * Calculate expected future weight
 */
export function estimateFutureWeight(
  currentWeight: number,
  lifeStage: string | null,
  gender: string,
  monthsAhead: number,
  livestockType: string = 'cattle'
): number {
  const weightRange = getWeightRange(lifeStage, gender, livestockType);
  
  if (!weightRange) {
    // Conservative growth estimate - varies by livestock type
    const conservativeGrowth = livestockType === 'goat' ? 1 : livestockType === 'sheep' ? 1.5 : livestockType === 'carabao' ? 8 : 5;
    return Math.round(currentWeight + (monthsAhead * conservativeGrowth));
  }
  
  const projectedWeight = currentWeight + (monthsAhead * weightRange.avgMonthlyGrowth);
  
  // Cap at max weight for stage
  return Math.round(Math.min(projectedWeight, weightRange.max));
}
