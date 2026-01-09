import { differenceInDays } from 'date-fns';
import { getWeightRange } from './weightEstimates';

export interface WeightMeasurement {
  weight_kg: number;
  measurement_date: string;
}

export type ADGStatus = 'excellent' | 'good' | 'fair' | 'poor';

export interface ADGResult {
  adgGrams: number;          // ADG in grams per day
  adgKg: number;             // ADG in kg per day
  totalGainKg: number;       // Total weight gained
  daysBetween: number;       // Days between measurements
  status: ADGStatus;
  percentOfExpected: number; // % of expected ADG for life stage
}

// Expected ADG values in grams/day by livestock type, gender, and life stage
const EXPECTED_ADG: Record<string, Record<string, Record<string, { min: number; max: number; optimal: number }>>> = {
  cattle: {
    female: {
      "Calf": { min: 700, max: 1000, optimal: 850 },
      "Heifer Calf": { min: 600, max: 800, optimal: 700 },
      "Breeding Heifer": { min: 500, max: 700, optimal: 600 },
      "Pregnant Heifer": { min: 300, max: 500, optimal: 400 },
      "First-Calf Heifer": { min: 200, max: 400, optimal: 300 },
      "Mature Cow": { min: 0, max: 200, optimal: 100 },
    },
    male: {
      "Bull Calf": { min: 900, max: 1200, optimal: 1050 },
      "Young Bull": { min: 600, max: 900, optimal: 750 },
      "Mature Bull": { min: 0, max: 300, optimal: 150 },
    },
  },
  goat: {
    female: {
      "Kid": { min: 80, max: 120, optimal: 100 },
      "Young Doe": { min: 60, max: 100, optimal: 80 },
      "Mature Doe": { min: 0, max: 30, optimal: 15 },
    },
    male: {
      "Kid": { min: 80, max: 120, optimal: 100 },
      "Young Buck": { min: 80, max: 120, optimal: 100 },
      "Mature Buck": { min: 0, max: 30, optimal: 15 },
    },
  },
  sheep: {
    female: {
      "Lamb": { min: 150, max: 250, optimal: 200 },
      "Young Ewe": { min: 80, max: 150, optimal: 115 },
      "Mature Ewe": { min: 0, max: 50, optimal: 25 },
    },
    male: {
      "Lamb": { min: 150, max: 300, optimal: 225 },
      "Young Ram": { min: 100, max: 180, optimal: 140 },
      "Mature Ram": { min: 0, max: 50, optimal: 25 },
    },
  },
  carabao: {
    female: {
      "Calf": { min: 300, max: 400, optimal: 350 },
      "Young Female": { min: 400, max: 600, optimal: 500 },
      "Mature Female": { min: 0, max: 100, optimal: 50 },
    },
    male: {
      "Calf": { min: 300, max: 400, optimal: 350 },
      "Young Bull": { min: 500, max: 800, optimal: 650 },
      "Mature Bull": { min: 0, max: 100, optimal: 50 },
    },
  },
};

/**
 * Get expected ADG for livestock type, gender, and life stage
 */
export function getExpectedADG(
  livestockType: string,
  gender: string,
  lifeStage: string | null
): { min: number; max: number; optimal: number } | null {
  if (!lifeStage) return null;
  
  const type = livestockType?.toLowerCase() || 'cattle';
  const genderKey = gender?.toLowerCase() === 'male' ? 'male' : 'female';
  
  return EXPECTED_ADG[type]?.[genderKey]?.[lifeStage] || null;
}

/**
 * Determine ADG status based on percent of expected
 */
export function getADGStatus(percentOfExpected: number): ADGStatus {
  if (percentOfExpected >= 100) return 'excellent';
  if (percentOfExpected >= 80) return 'good';
  if (percentOfExpected >= 60) return 'fair';
  return 'poor';
}

/**
 * Calculate ADG between two measurements
 */
export function calculateADG(
  current: WeightMeasurement,
  previous: WeightMeasurement,
  livestockType: string = 'cattle',
  gender: string = 'female',
  lifeStage: string | null = null
): ADGResult | null {
  const currentDate = new Date(current.measurement_date);
  const previousDate = new Date(previous.measurement_date);
  
  const daysBetween = differenceInDays(currentDate, previousDate);
  
  // Need at least 1 day difference
  if (daysBetween < 1) return null;
  
  const totalGainKg = current.weight_kg - previous.weight_kg;
  const adgKg = totalGainKg / daysBetween;
  const adgGrams = adgKg * 1000;
  
  // Get expected ADG for status calculation
  const expectedADG = getExpectedADG(livestockType, gender, lifeStage);
  const optimalADG = expectedADG?.optimal || 800; // Default to 800g/day for cattle
  
  const percentOfExpected = Math.round((adgGrams / optimalADG) * 100);
  const status = getADGStatus(percentOfExpected);
  
  return {
    adgGrams: Math.round(adgGrams),
    adgKg: Math.round(adgKg * 100) / 100,
    totalGainKg: Math.round(totalGainKg * 10) / 10,
    daysBetween,
    status,
    percentOfExpected,
  };
}

/**
 * Calculate overall ADG from first to last measurement
 */
export function calculateOverallADG(
  records: WeightMeasurement[],
  livestockType: string = 'cattle',
  gender: string = 'female',
  lifeStage: string | null = null
): ADGResult | null {
  if (records.length < 2) return null;
  
  // Sort by date ascending
  const sorted = [...records].sort(
    (a, b) => new Date(a.measurement_date).getTime() - new Date(b.measurement_date).getTime()
  );
  
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  
  return calculateADG(newest, oldest, livestockType, gender, lifeStage);
}

/**
 * Format ADG for display
 */
export function formatADG(adgGrams: number): string {
  if (Math.abs(adgGrams) >= 1000) {
    return `${(adgGrams / 1000).toFixed(2)} kg/day`;
  }
  return `${Math.round(adgGrams)} g/day`;
}
