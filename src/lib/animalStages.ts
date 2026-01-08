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
  livestockType: string | null;
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
    const { birthDate, gender, offspringCount, hasActiveAI, livestockType } = data;
    
    // Must have gender and livestock type
    if (gender !== "Female" || !livestockType) return null;
    
    const normalizedType = livestockType.toLowerCase().trim();

    // If birth date is unknown, infer stage from offspring/AI data
    if (!birthDate) {
      return inferLifeStageWithoutBirthDate(normalizedType, offspringCount, hasActiveAI);
    }
    
    // Ensure birthDate is a valid date
    if (isNaN(birthDate.getTime())) {
      return inferLifeStageWithoutBirthDate(normalizedType, offspringCount, hasActiveAI);
    }
    
    const ageInMonths = differenceInMonths(new Date(), birthDate);
    
    // Ensure ageInMonths is a valid number
    if (isNaN(ageInMonths) || ageInMonths < 0) {
      return inferLifeStageWithoutBirthDate(normalizedType, offspringCount, hasActiveAI);
    }

    // Species-specific logic
    if (normalizedType === 'cattle') {
      return calculateCattleLifeStage(ageInMonths, offspringCount, hasActiveAI);
    } else if (normalizedType === 'carabao') {
      return calculateCarabaoLifeStage(ageInMonths, offspringCount, hasActiveAI);
    } else if (normalizedType === 'goat') {
      return calculateGoatLifeStage(ageInMonths, offspringCount, hasActiveAI);
    } else if (normalizedType === 'sheep') {
      return calculateSheepLifeStage(ageInMonths, offspringCount, hasActiveAI);
    }

    return null;
  } catch (error) {
    console.error("Error in calculateLifeStage:", error);
    return null;
  }
}

/**
 * Infer life stage when birth date is unknown, using reproductive history
 */
function inferLifeStageWithoutBirthDate(
  livestockType: string, 
  offspringCount: number, 
  hasActiveAI: boolean
): string | null {
  // If has 2+ offspring, animal is mature
  if (offspringCount >= 2) {
    if (livestockType === 'cattle') return "Mature Cow";
    if (livestockType === 'carabao') return "Mature Carabao";
    if (livestockType === 'goat') return "Mature Doe";
    if (livestockType === 'sheep') return "Mature Ewe";
  }
  
  // If has exactly 1 offspring, first-time mother
  if (offspringCount === 1) {
    if (livestockType === 'cattle') return "First-Calf Heifer";
    if (livestockType === 'carabao') return "First-Time Mother";
    if (livestockType === 'goat') return "First Freshener";
    if (livestockType === 'sheep') return "First-Time Mother Ewe";
  }
  
  // No offspring - check for pregnancy (active AI)
  if (hasActiveAI) {
    if (livestockType === 'cattle') return "Pregnant Heifer";
    if (livestockType === 'carabao') return "Pregnant Carabao";
    if (livestockType === 'goat') return "Pregnant Doe";
    if (livestockType === 'sheep') return "Pregnant Ewe";
  }
  
  // Default: assume breeding age for adult females with unknown birth date
  if (livestockType === 'cattle') return "Breeding Heifer";
  if (livestockType === 'carabao') return "Breeding Carabao";
  if (livestockType === 'goat') return "Breeding Doe";
  if (livestockType === 'sheep') return "Breeding Ewe";
  
  return null;
}

// Helper function for cattle life stages (preserves existing detailed logic)
function calculateCattleLifeStage(ageInMonths: number, offspringCount: number, hasActiveAI: boolean): string {
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
}

// Helper function for carabao life stages
function calculateCarabaoLifeStage(ageInMonths: number, offspringCount: number, hasActiveAI: boolean): string {
  // Carabao Calf (0-12 months)
  if (ageInMonths < 12) return "Carabao Calf";
  
  // Young Carabao (12-18 months, no breeding yet)
  if (ageInMonths < 18 && offspringCount === 0 && !hasActiveAI) return "Young Carabao";
  
  // For animals 18+ months or younger with breeding activity
  if (offspringCount === 0) {
    // Pregnant Carabao (has AI record but no offspring)
    if (hasActiveAI) return "Pregnant Carabao";
    // Breeding Carabao (ready for breeding)
    return "Breeding Carabao";
  }
  
  // First-Time Mother (has exactly 1 offspring)
  if (offspringCount === 1) return "First-Time Mother";
  
  // Mature Carabao (has 2+ offspring)
  return "Mature Carabao";
}

// Helper function for goat life stages
function calculateGoatLifeStage(ageInMonths: number, offspringCount: number, hasActiveAI: boolean): string {
  // Kid (0-6 months)
  if (ageInMonths < 6) return "Kid";
  
  // Doeling (6-10 months, female kid)
  if (ageInMonths < 10 && offspringCount === 0 && !hasActiveAI) return "Doeling";
  
  // For animals 10+ months or younger with breeding activity
  if (offspringCount === 0) {
    // Pregnant Doe (has AI record but no offspring)
    if (hasActiveAI) return "Pregnant Doe";
    // Breeding Doe (ready for breeding)
    return "Breeding Doe";
  }
  
  // First Freshener (has exactly 1 offspring)
  if (offspringCount === 1) return "First Freshener";
  
  // Mature Doe (has 2+ offspring)
  return "Mature Doe";
}

// Helper function for sheep life stages
function calculateSheepLifeStage(ageInMonths: number, offspringCount: number, hasActiveAI: boolean): string {
  // Lamb (0-6 months)
  if (ageInMonths < 6) return "Lamb";
  
  // Ewe Lamb (6-12 months, female lamb)
  if (ageInMonths < 12 && offspringCount === 0 && !hasActiveAI) return "Ewe Lamb";
  
  // For animals 12+ months or younger with breeding activity
  if (offspringCount === 0) {
    // Pregnant Ewe (has AI record but no offspring)
    if (hasActiveAI) return "Pregnant Ewe";
    // Breeding Ewe (ready for breeding)
    return "Breeding Ewe";
  }
  
  // First-Time Mother Ewe (has exactly 1 offspring)
  if (offspringCount === 1) return "First-Time Mother Ewe";
  
  // Mature Ewe (has 2+ offspring)
  return "Mature Ewe";
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
  if (!stage) return "bg-gray-100 text-gray-800 border-gray-200";

  const stageColors: Record<string, string> = {
    // Cattle
    "Calf": "bg-pink-100 text-pink-800 border-pink-200",
    "Heifer Calf": "bg-blue-100 text-blue-800 border-blue-200",
    "Yearling Heifer": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "Breeding Heifer": "bg-purple-100 text-purple-800 border-purple-200",
    "Pregnant Heifer": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "First-Calf Heifer": "bg-green-100 text-green-800 border-green-200",
    "Mature Cow": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Bull Calf": "bg-blue-100 text-blue-800 border-blue-200",
    "Young Bull": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "Mature Bull": "bg-teal-100 text-teal-800 border-teal-200",
    
    // Carabao
    "Carabao Calf": "bg-pink-100 text-pink-800 border-pink-200",
    "Young Carabao": "bg-blue-100 text-blue-800 border-blue-200",
    "Breeding Carabao": "bg-purple-100 text-purple-800 border-purple-200",
    "Pregnant Carabao": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "First-Time Mother": "bg-green-100 text-green-800 border-green-200",
    "Mature Carabao": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Young Bull Carabao": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "Mature Bull Carabao": "bg-teal-100 text-teal-800 border-teal-200",
    
    // Goats
    "Kid": "bg-pink-100 text-pink-800 border-pink-200",
    "Buckling": "bg-blue-100 text-blue-800 border-blue-200",
    "Doeling": "bg-blue-100 text-blue-800 border-blue-200",
    "Young Doe": "bg-blue-100 text-blue-800 border-blue-200",
    "Breeding Doe": "bg-purple-100 text-purple-800 border-purple-200",
    "Pregnant Doe": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "First Freshener": "bg-green-100 text-green-800 border-green-200",
    "Mature Doe": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Young Buck": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "Buck": "bg-teal-100 text-teal-800 border-teal-200",
    
    // Sheep
    "Lamb": "bg-pink-100 text-pink-800 border-pink-200",
    "Ram Lamb": "bg-blue-100 text-blue-800 border-blue-200",
    "Ewe Lamb": "bg-blue-100 text-blue-800 border-blue-200",
    "Young Ewe": "bg-blue-100 text-blue-800 border-blue-200",
    "Breeding Ewe": "bg-purple-100 text-purple-800 border-purple-200",
    "Pregnant Ewe": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "First-Time Mother Ewe": "bg-green-100 text-green-800 border-green-200",
    "Mature Ewe": "bg-emerald-100 text-emerald-800 border-emerald-200",
    "Young Ram": "bg-cyan-100 text-cyan-800 border-cyan-200",
    "Mature Ram": "bg-teal-100 text-teal-800 border-teal-200",
  };

  return stageColors[stage] || "bg-gray-100 text-gray-800 border-gray-200";
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
    const { birthDate, gender, livestockType } = data;
    
    if (!birthDate || gender !== "Male" || !livestockType) return null;
    
    // Ensure birthDate is a valid date
    if (isNaN(birthDate.getTime())) return null;
    
    const ageInMonths = differenceInMonths(new Date(), birthDate);
    
    // Ensure ageInMonths is a valid number
    if (isNaN(ageInMonths) || ageInMonths < 0) return null;

    const normalizedType = livestockType.toLowerCase().trim();

    // Species-specific male stages
    if (normalizedType === 'cattle') {
      if (ageInMonths < 12) return "Bull Calf";
      if (ageInMonths < 24) return "Young Bull";
      return "Mature Bull";
    } else if (normalizedType === 'carabao') {
      if (ageInMonths < 12) return "Carabao Calf";
      if (ageInMonths < 24) return "Young Bull Carabao";
      return "Mature Bull Carabao";
    } else if (normalizedType === 'goat') {
      if (ageInMonths < 6) return "Kid";
      if (ageInMonths < 12) return "Young Buck";
      return "Buck";
    } else if (normalizedType === 'sheep') {
      if (ageInMonths < 6) return "Lamb";
      if (ageInMonths < 12) return "Young Ram";
      return "Mature Ram";
    }

    return null;
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

/**
 * Maps cattle-specific life stage terms to species-appropriate terms for display
 * 
 * DEPRECATED: This function is kept for backward compatibility with old carabao records
 * that still have cattle-specific terms in the database. Once all carabao records are
 * migrated to use carabao-specific terms, this function can be removed.
 * 
 * New calculations should use species-specific logic in calculateLifeStage() directly.
 * 
 * @param stage - The life stage from the database
 * @param livestockType - The type of livestock (cattle, carabao, goat, sheep)
 * @returns The species-appropriate stage name for display
 */
export function displayStageForSpecies(stage: string | null, livestockType: string | null): string | null {
  if (!stage || !livestockType) return stage;
  
  const normalizedType = livestockType.trim().toLowerCase();
  
  // Only map for carabao with legacy cattle terms - needed during migration period
  if (normalizedType === 'carabao') {
    const cattleToCarabaoMap: Record<string, string> = {
      'Mature Cow': 'Mature Carabao',
      'First-Calf Heifer': 'First-Time Mother',
      'Pregnant Heifer': 'Pregnant Carabao',
      'Breeding Heifer': 'Breeding Carabao',
      'Heifer Calf': 'Young Carabao',
      'Yearling Heifer': 'Young Carabao',
      'Calf': 'Carabao Calf',
      'Bull Calf': 'Carabao Calf',
      'Young Bull': 'Young Bull Carabao',
      'Mature Bull': 'Mature Bull Carabao',
    };
    
    return cattleToCarabaoMap[stage] || stage;
  }
  
  // For other species, return as-is
  return stage;
}
