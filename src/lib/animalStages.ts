import { differenceInMonths, differenceInDays } from "date-fns";

export interface AnimalStageData {
  birthDate: Date | null;
  gender: string | null;
  milkingStartDate: Date | null;
  offspringCount: number;
  lastCalvingDate: Date | null;
  hasRecentMilking: boolean;
  hasActiveAI: boolean;
}

export function calculateLifeStage(data: AnimalStageData): string | null {
  try {
    const { birthDate, gender, offspringCount, hasActiveAI } = data;
    
    if (!birthDate || gender !== "Female") return null;
    
    // Ensure birthDate is a valid date
    if (isNaN(birthDate.getTime())) return null;
    
    const ageInMonths = differenceInMonths(new Date(), birthDate);
    
    // Ensure ageInMonths is a valid number
    if (isNaN(ageInMonths) || ageInMonths < 0) return null;
    
    // Calf (0-8 months)
    if (ageInMonths < 8) return "Calf";
    
    // Heifer Calf (8-12 months)
    if (ageInMonths < 12) return "Heifer Calf";
    
    // Yearling Heifer (12-15 months)
    if (ageInMonths < 15) return "Yearling Heifer";
    
    // For animals 15+ months
    if (offspringCount === 0) {
      // Pregnant Heifer (has AI record but no offspring)
      if (hasActiveAI) return "Pregnant Heifer";
      // Breeding Heifer (ready for breeding)
      return "Breeding Heifer";
    }
    
    // First-Calf Heifer (has exactly 1 offspring)
    if (offspringCount === 1) return "First-Calf Heifer";
    
    // Mature Cow (has 2+ offspring)
    return "Mature Cow";
  } catch (error) {
    console.error("Error in calculateLifeStage:", error);
    return null;
  }
}

export function calculateMilkingStage(data: AnimalStageData): string | null {
  try {
    const { birthDate, gender, lastCalvingDate, hasRecentMilking } = data;
    
    if (!birthDate || gender !== "Female" || !lastCalvingDate) return null;
    
    // Ensure dates are valid
    if (isNaN(birthDate.getTime()) || isNaN(lastCalvingDate.getTime())) return null;
    
    const daysSinceCalving = differenceInDays(new Date(), lastCalvingDate);
    
    // Ensure daysSinceCalving is a valid number
    if (isNaN(daysSinceCalving) || daysSinceCalving < 0) return null;
    
    // If no recent milking records, consider it dry period
    if (!hasRecentMilking && daysSinceCalving > 60) return "Dry Period";
    
    // Early Lactation (0-100 days)
    if (daysSinceCalving <= 100) return "Early Lactation";
    
    // Mid-Lactation (100-200 days)
    if (daysSinceCalving <= 200) return "Mid-Lactation";
    
    // Late Lactation (200-305 days)
    if (daysSinceCalving <= 305) return "Late Lactation";
    
    // Dry Period (305+ days)
    return "Dry Period";
  } catch (error) {
    console.error("Error in calculateMilkingStage:", error);
    return null;
  }
}

export function getLifeStageBadgeColor(stage: string | null): string {
  switch (stage) {
    case "Calf":
    case "Heifer Calf":
      return "bg-blue-100 text-blue-800";
    case "Yearling Heifer":
    case "Breeding Heifer":
      return "bg-purple-100 text-purple-800";
    case "Pregnant Heifer":
      return "bg-pink-100 text-pink-800";
    case "First-Calf Heifer":
      return "bg-orange-100 text-orange-800";
    case "Mature Cow":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function calculateMaleStage(data: AnimalStageData): string | null {
  try {
    const { birthDate, gender } = data;
    
    if (!birthDate || gender !== "Male") return null;
    
    // Ensure birthDate is a valid date
    if (isNaN(birthDate.getTime())) return null;
    
    const ageInMonths = differenceInMonths(new Date(), birthDate);
    
    // Ensure ageInMonths is a valid number
    if (isNaN(ageInMonths) || ageInMonths < 0) return null;
    
    // Bull Calf (0-12 months)
    if (ageInMonths < 12) return "Bull Calf";
    
    // Young Bull (12-24 months)
    if (ageInMonths < 24) return "Young Bull";
    
    // Mature Bull (24+ months)
    return "Mature Bull";
  } catch (error) {
    console.error("Error in calculateMaleStage:", error);
    return null;
  }
}

export function getMilkingStageBadgeColor(stage: string | null): string {
  switch (stage) {
    case "Early Lactation":
      return "bg-emerald-100 text-emerald-800";
    case "Mid-Lactation":
      return "bg-teal-100 text-teal-800";
    case "Late Lactation":
      return "bg-amber-100 text-amber-800";
    case "Dry Period":
      return "bg-slate-100 text-slate-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
