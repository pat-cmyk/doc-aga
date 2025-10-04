import { addMonths, format } from "date-fns";
import { estimateFutureWeight } from "./weightEstimates";

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
  breakdownByStage: Record<string, {
    count: number;
    feedKgPerDay: number;
  }>;
}

/**
 * Calculate daily feed requirement based on weight and stage
 */
function calculateDailyFeedRequirement(
  weight: number,
  lifeStage: string | null,
  milkingStage: string | null,
  gender: string
): number {
  // Base feed as percentage of body weight (dry matter)
  const isMale = gender?.toLowerCase() === "male";
  
  // Lactating cows need more feed
  if (milkingStage && milkingStage !== "Dry Period") {
    return weight * 0.035; // 3.5% of body weight for lactating
  }
  
  // Growing animals need more feed
  if (lifeStage === "Calf" || lifeStage === "Bull Calf") {
    return weight * 0.03; // 3% for calves
  }
  
  if (lifeStage === "Heifer Calf" || lifeStage === "Breeding Heifer" || lifeStage === "Young Bull") {
    return weight * 0.025; // 2.5% for growing heifers/bulls
  }
  
  // Mature animals
  if (isMale) {
    return weight * 0.025; // Bulls need more for maintenance
  }
  
  // Dry/pregnant cows
  if (lifeStage === "Pregnant Heifer" || lifeStage === "Mature Cow") {
    return weight * 0.02; // 2% for dry/pregnant cows
  }
  
  // Default maintenance
  return weight * 0.02;
}

/**
 * Generate 6-month feed forecast for all animals
 */
export function generateFeedForecast(animals: Animal[]): MonthlyFeedForecast[] {
  const forecasts: MonthlyFeedForecast[] = [];
  const today = new Date();
  
  // Generate forecast for next 6 months
  for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
    const forecastDate = addMonths(today, monthOffset);
    const monthLabel = format(forecastDate, "MMM yyyy");
    
    let totalFeedKgPerDay = 0;
    const breakdownByStage: Record<string, { count: number; feedKgPerDay: number }> = {};
    
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
      
      // Calculate feed requirement
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
        breakdownByStage[stageKey] = { count: 0, feedKgPerDay: 0 };
      }
      breakdownByStage[stageKey].count += 1;
      breakdownByStage[stageKey].feedKgPerDay += dailyFeed;
    });
    
    // Assume 30 days per month for simplicity
    const totalFeedKgPerMonth = totalFeedKgPerDay * 30;
    
    forecasts.push({
      month: monthLabel,
      monthDate: forecastDate,
      totalFeedKgPerDay: Math.round(totalFeedKgPerDay * 10) / 10,
      totalFeedKgPerMonth: Math.round(totalFeedKgPerMonth),
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
