import { addMonths, format } from "date-fns";
import { estimateFutureWeight } from "./weightEstimates";
import { 
  calculateDryMatterIntake, 
  DRY_MATTER_CONTENT,
  type AnimalForConsumption 
} from "./feedConsumption";

export interface Animal {
  id: string;
  birth_date: string;
  gender: string;
  life_stage: string | null;
  milking_stage: string | null;
  current_weight_kg: number | null;
}

export interface MonthlyFeedForecast {
  month: string;
  monthDate: Date;
  totalFeedKgPerDay: number;
  totalFeedKgPerMonth: number;
  totalFreshForageKgPerDay: number;
  totalFreshForageKgPerMonth: number;
  breakdownByStage: Record<string, {
    count: number;
    feedKgPerDay: number;
    freshForageKgPerDay: number;
  }>;
}

/**
 * Calculate daily feed requirement based on weight and stage
 * Uses unified feedConsumption service for consistency with dashboard
 */
function calculateDailyFeedRequirement(
  weight: number,
  lifeStage: string | null,
  milkingStage: string | null,
  gender: string
): number {
  // Use the unified calculation from feedConsumption service
  const animal: AnimalForConsumption = {
    current_weight_kg: weight,
    life_stage: lifeStage,
    milking_stage: milkingStage,
    gender
  };
  
  return calculateDryMatterIntake(animal);
}

/**
 * Generate 6-month feed forecast for all animals
 * Assumes forage has 30% dry matter content
 */
export function generateFeedForecast(animals: Animal[]): MonthlyFeedForecast[] {
  const forecasts: MonthlyFeedForecast[] = [];
  const today = new Date();
  // Use unified DRY_MATTER_CONTENT from feedConsumption service
  
  // Generate forecast for next 6 months
  for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
    const forecastDate = addMonths(today, monthOffset);
    const monthLabel = format(forecastDate, "MMM yyyy");
    
    let totalFeedKgPerDay = 0;
    const breakdownByStage: Record<string, { count: number; feedKgPerDay: number; freshForageKgPerDay: number }> = {};
    
    animals.forEach(animal => {
      // Estimate weight for this future month
      const currentWeight = animal.current_weight_kg || 
        estimateFutureWeight(300, animal.life_stage, animal.gender, 0); // fallback
      
      const futureWeight = estimateFutureWeight(
        currentWeight,
        animal.life_stage,
        animal.gender,
        monthOffset
      );
      
      // Calculate feed requirement (dry matter)
      const dailyFeed = calculateDailyFeedRequirement(
        futureWeight,
        animal.life_stage,
        animal.milking_stage,
        animal.gender
      );
      
      totalFeedKgPerDay += dailyFeed;
      
      // Group by life stage
      const stageKey = animal.life_stage || "Unknown";
      if (!breakdownByStage[stageKey]) {
        breakdownByStage[stageKey] = { count: 0, feedKgPerDay: 0, freshForageKgPerDay: 0 };
      }
      breakdownByStage[stageKey].count += 1;
      breakdownByStage[stageKey].feedKgPerDay += dailyFeed;
      // Convert dry matter to fresh forage weight using unified constant
      breakdownByStage[stageKey].freshForageKgPerDay += dailyFeed / DRY_MATTER_CONTENT;
    });
    
    // Assume 30 days per month for simplicity
    const totalFeedKgPerMonth = totalFeedKgPerDay * 30;
    const totalFreshForageKgPerDay = totalFeedKgPerDay / DRY_MATTER_CONTENT;
    const totalFreshForageKgPerMonth = totalFreshForageKgPerDay * 30;
    
    forecasts.push({
      month: monthLabel,
      monthDate: forecastDate,
      totalFeedKgPerDay: Math.round(totalFeedKgPerDay * 10) / 10,
      totalFeedKgPerMonth: Math.round(totalFeedKgPerMonth),
      totalFreshForageKgPerDay: Math.round(totalFreshForageKgPerDay * 10) / 10,
      totalFreshForageKgPerMonth: Math.round(totalFreshForageKgPerMonth),
      breakdownByStage,
    });
  }
  
  return forecasts;
}

/**
 * Calculate total feed needed for a time period
 */
export function calculateTotalFeedNeeded(
  forecasts: MonthlyFeedForecast[]
): {
  totalKg: number;
  avgPerDay: number;
  avgPerMonth: number;
} {
  const totalKg = forecasts.reduce((sum, f) => sum + f.totalFeedKgPerMonth, 0);
  const avgPerMonth = forecasts.length > 0 ? totalKg / forecasts.length : 0;
  const avgPerDay = avgPerMonth / 30;
  
  return {
    totalKg: Math.round(totalKg),
    avgPerDay: Math.round(avgPerDay * 10) / 10,
    avgPerMonth: Math.round(avgPerMonth),
  };
}
