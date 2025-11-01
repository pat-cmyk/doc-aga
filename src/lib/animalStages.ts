import { differenceInMonths, differenceInDays } from "date-fns";

/**
 * Data structure for calculating animal life and milking stages
 * 
 * Contains all information needed to determine a female cattle's life stage
 * (Calf, Heifer, Cow) and milking stage (Early/Mid/Late Lactation, Dry Period).
 * 
 * @interface
 * @property birthDate - Animal's birth date (null if unknown)
 * @property gender - "Male" or "Female" (null if unknown)
 * @property milkingStartDate - Date when animal started producing milk
 * @property offspringCount - Number of calves produced (0 for heifers)
 * @property lastCalvingDate - Date of most recent calving event
 * @property hasRecentMilking - Whether animal has milking records in last 60 days
 * @property hasActiveAI - Whether animal has AI record but no offspring yet (pregnant)
 */
export interface AnimalStageData {
  birthDate: Date | null;
  gender: string | null;
  milkingStartDate: Date | null;
  offspringCount: number;
  lastCalvingDate: Date | null;
  hasRecentMilking: boolean;
  hasActiveAI: boolean;
}

/**
 * Calculate the life stage of a female cattle based on age and reproduction history
 * 
 * Determines developmental stage using industry-standard age thresholds and
 * reproductive milestones. Only applies to female cattle - returns null for males.
 * 
 * Life stages progression:
 * - **Calf** (0-8 months): Newborn to weaning
 * - **Heifer Calf** (8-12 months): Post-weaning growth
 * - **Yearling Heifer** (12-15 months): Approaching breeding age
 * - **Breeding Heifer** (15+ months, no offspring): Ready for breeding
 * - **Pregnant Heifer** (15+ months, has AI record, no offspring): Confirmed pregnant
 * - **First-Calf Heifer** (has exactly 1 offspring): New mother
 * - **Mature Cow** (has 2+ offspring): Experienced mother
 * 
 * @param data - Animal stage data including birth date, gender, and reproduction info
 * @returns Life stage string or null if male/invalid data
 * 
 * @example
 * ```typescript
 * // Calculate stage for a 6-month-old female
 * const stage = calculateLifeStage({
 *   birthDate: new Date('2024-05-01'),
 *   gender: 'Female',
 *   milkingStartDate: null,
 *   offspringCount: 0,
 *   lastCalvingDate: null,
 *   hasRecentMilking: false,
 *   hasActiveAI: false
 * });
 * console.log(stage); // "Calf"
 * 
 * // Calculate stage for breeding-age heifer
 * const stage = calculateLifeStage({
 *   birthDate: new Date('2023-06-01'),
 *   gender: 'Female',
 *   offspringCount: 0,
 *   hasActiveAI: false,
 *   // ... other fields
 * });
 * console.log(stage); // "Breeding Heifer" (16 months old)
 * ```
 */
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

/**
 * Calculate the milking/lactation stage based on time since last calving
 * 
 * Determines where the animal is in the lactation cycle, which is crucial for
 * nutrition management, milking frequency, and breeding decisions. A standard
 * lactation cycle is 305 days, followed by a dry period before next calving.
 * 
 * Lactation stages:
 * - **Early Lactation** (0-100 days post-calving): Peak milk production, high energy needs
 * - **Mid-Lactation** (100-200 days): Stable production, optimal breeding window
 * - **Late Lactation** (200-305 days): Declining production, prepare for dry period
 * - **Dry Period** (305+ days or no recent milking): Resting before next calving
 * 
 * @param data - Animal stage data including calving date and recent milking status
 * @returns Milking stage string or null if not applicable (male, no calving date)
 * 
 * @example
 * ```typescript
 * // Calculate for cow 50 days post-calving
 * const stage = calculateMilkingStage({
 *   birthDate: new Date('2020-03-15'),
 *   gender: 'Female',
 *   lastCalvingDate: new Date('2024-09-12'),
 *   hasRecentMilking: true,
 *   // ... other fields
 * });
 * console.log(stage); // "Early Lactation"
 * 
 * // Calculate for cow in dry period
 * const stage = calculateMilkingStage({
 *   birthDate: new Date('2020-03-15'),
 *   gender: 'Female',
 *   lastCalvingDate: new Date('2023-11-01'),
 *   hasRecentMilking: false,
 *   // ... other fields
 * });
 * console.log(stage); // "Dry Period"
 * ```
 */
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

/**
 * Get Tailwind CSS classes for life stage badge styling
 * 
 * Returns background and text color classes to visually distinguish different
 * life stages in the UI. Uses semantic colors that progress from blue (young)
 * to green (mature).
 * 
 * @param stage - Life stage string from calculateLifeStage()
 * @returns Tailwind CSS class string for badge styling
 * 
 * @example
 * ```typescript
 * const stage = calculateLifeStage(animalData);
 * const badgeClasses = getLifeStageBadgeColor(stage);
 * 
 * return <Badge className={badgeClasses}>{stage}</Badge>;
 * // Calf → blue, Breeding Heifer → purple, Mature Cow → green
 * ```
 */
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

/**
 * Calculate the life stage of male cattle based on age
 * 
 * Simpler than female stages - males progress through three basic stages
 * based solely on age. Used for bulls kept for breeding or beef production.
 * 
 * Male stages:
 * - **Bull Calf** (0-12 months): Young male, post-weaning
 * - **Young Bull** (12-24 months): Adolescent, approaching sexual maturity
 * - **Mature Bull** (24+ months): Adult, suitable for breeding or market
 * 
 * @param data - Animal stage data (only birthDate and gender are used)
 * @returns Male life stage string or null if female/invalid data
 * 
 * @example
 * ```typescript
 * // Calculate stage for 8-month-old male
 * const stage = calculateMaleStage({
 *   birthDate: new Date('2024-03-01'),
 *   gender: 'Male',
 *   // ... other fields not used for males
 * });
 * console.log(stage); // "Bull Calf"
 * 
 * // Calculate stage for 30-month-old male
 * const stage = calculateMaleStage({
 *   birthDate: new Date('2022-05-01'),
 *   gender: 'Male',
 *   // ... other fields
 * });
 * console.log(stage); // "Mature Bull"
 * ```
 */
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

/**
 * Get Tailwind CSS classes for milking stage badge styling
 * 
 * Returns appropriate colors for each lactation phase to help farmers quickly
 * identify animal status. Uses green shades for active lactation and gray for dry period.
 * 
 * @param stage - Milking stage string from calculateMilkingStage()
 * @returns Tailwind CSS class string for badge styling
 * 
 * @example
 * ```typescript
 * const milkingStage = calculateMilkingStage(animalData);
 * const badgeClasses = getMilkingStageBadgeColor(milkingStage);
 * 
 * return <Badge className={badgeClasses}>{milkingStage}</Badge>;
 * // Early Lactation → emerald green, Dry Period → gray
 * ```
 */
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
