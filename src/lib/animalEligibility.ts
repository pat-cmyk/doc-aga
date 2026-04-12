/**
 * Animal Eligibility — SSOT for recording restrictions based on life stage & breeding status
 *
 * Determines which recording actions (milk, heat, AI, calving) are allowed
 * for a given animal based on gender, age, life stage, and fertility status.
 *
 * Reuses constants from:
 *  - fertility.ts: MIN_BREEDING_AGE_MONTHS
 *  - animalQueries.ts: LACTATING_STAGES
 */

import { differenceInMonths } from "date-fns";
import { MIN_BREEDING_AGE_MONTHS } from "@/types/fertility";
import { LACTATING_STAGES } from "@/lib/animalQueries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EligibilityInput {
  gender: string | null;
  livestock_type: string | null;
  birth_date: string | Date | null;
  life_stage: string | null;
  milking_stage: string | null;
  fertility_status: string | null;
  is_currently_lactating: boolean | null;
  offspring_count: number;
}

export interface EligibilityResult {
  eligible: boolean;
  warning?: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Life stages that are definitively pre-breeding (too young for heat/AI/milk) */
const PRE_BREEDING_FEMALE_STAGES: readonly string[] = [
  // Cattle
  "Calf", "Heifer Calf", "Yearling Heifer",
  // Carabao
  "Carabao Calf", "Young Carabao",
  // Goat — Kid is always pre-breeding; Doeling needs age check (8-10m overlap)
  "Kid",
  // Sheep
  "Lamb", "Ewe Lamb",
];

/** Goat Doeling stage (6-10m) overlaps breeding age (8m) — needs special handling */
const DOELING_STAGE = "Doeling";

/** All male stages — always ineligible for female-specific recordings */
const MALE_STAGES: readonly string[] = [
  "Bull Calf", "Young Bull", "Mature Bull",
  "Carabao Calf", "Young Bull Carabao", "Mature Bull Carabao",
  "Kid", "Buckling", "Young Buck", "Buck",
  "Lamb", "Ram Lamb", "Young Ram", "Mature Ram",
];

/** Stages that indicate the animal has calved (can produce milk) */
const POST_CALVING_STAGES: readonly string[] = [
  // Cattle
  "First-Calf Heifer", "Mature Cow",
  // Carabao
  "First-Time Mother", "Mature Carabao",
  // Goat
  "First Freshener", "Mature Doe",
  // Sheep
  "First-Time Mother Ewe", "Mature Ewe",
];

/** Pregnant stages */
const PREGNANT_STAGES: readonly string[] = [
  "Pregnant Heifer", "Pregnant Carabao", "Pregnant Doe", "Pregnant Ewe",
];

/** Fertility statuses that indicate pregnancy */
const PREGNANT_FERTILITY_STATUSES: readonly string[] = [
  "confirmed_pregnant", "suspected_pregnant",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFemale(gender: string | null): boolean {
  return gender?.toLowerCase() === "female";
}

function isMale(gender: string | null): boolean {
  return gender?.toLowerCase() === "male";
}

function getAgeInMonths(birthDate: string | Date | null): number | null {
  if (!birthDate) return null;
  const d = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (isNaN(d.getTime())) return null;
  const months = differenceInMonths(new Date(), d);
  return months >= 0 ? months : null;
}

function getBreedingAge(livestockType: string | null): number | null {
  if (!livestockType) return null;
  const key = livestockType.toLowerCase().trim();
  return MIN_BREEDING_AGE_MONTHS[key] ?? null;
}

function isAtBreedingAge(
  birthDate: string | Date | null,
  livestockType: string | null
): { known: boolean; atAge: boolean } {
  const age = getAgeInMonths(birthDate);
  const minAge = getBreedingAge(livestockType);
  if (age === null || minAge === null) return { known: false, atAge: false };
  return { known: true, atAge: age >= minAge };
}

function isPreBreedingByStage(lifeStage: string | null): boolean {
  if (!lifeStage) return false;
  return PRE_BREEDING_FEMALE_STAGES.includes(lifeStage);
}

function isBreedingOrPostCalvingByStage(lifeStage: string | null): boolean {
  if (!lifeStage) return false;
  return (
    POST_CALVING_STAGES.includes(lifeStage) ||
    PREGNANT_STAGES.includes(lifeStage) ||
    lifeStage === "Breeding Heifer" ||
    lifeStage === "Breeding Carabao" ||
    lifeStage === "Breeding Doe" ||
    lifeStage === "Breeding Ewe"
  );
}

function isPregnant(
  fertilityStatus: string | null,
  lifeStage: string | null
): boolean {
  if (fertilityStatus && PREGNANT_FERTILITY_STATUSES.includes(fertilityStatus)) {
    return true;
  }
  if (lifeStage && PREGNANT_STAGES.includes(lifeStage)) {
    return true;
  }
  return false;
}

function isLactating(
  milkingStage: string | null,
  isCurrentlyLactating: boolean | null
): boolean {
  if (isCurrentlyLactating === true) return true;
  if (milkingStage && LACTATING_STAGES.includes(milkingStage)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Eligibility Functions
// ---------------------------------------------------------------------------

/**
 * Can this animal have a milk record?
 * Requires: Female + (has offspring OR is_currently_lactating OR in a lactating milking_stage)
 */
export function canRecordMilk(animal: EligibilityInput): EligibilityResult {
  // Gender check
  if (!animal.gender) {
    return { eligible: false, reason: "Hindi alam ang kasarian / Gender unknown" };
  }
  if (isMale(animal.gender)) {
    return { eligible: false, reason: "Lalaki — hindi maga-gatas / Male — cannot produce milk" };
  }
  if (!isFemale(animal.gender)) {
    return { eligible: false, reason: "Hindi alam ang kasarian / Gender unknown" };
  }

  // If currently lactating or in a lactating stage, allow
  if (isLactating(animal.milking_stage, animal.is_currently_lactating)) {
    if (animal.offspring_count === 0) {
      return {
        eligible: true,
        warning: true,
        reason: "Walang naka-record na offspring / No offspring recorded",
      };
    }
    return { eligible: true };
  }

  // If has offspring (post-calving), allow
  if (animal.offspring_count > 0) {
    return { eligible: true };
  }

  // If post-calving life stage, allow
  if (POST_CALVING_STAGES.includes(animal.life_stage || "")) {
    return { eligible: true };
  }

  // Pre-breeding stage — hard block
  if (isPreBreedingByStage(animal.life_stage) || animal.life_stage === DOELING_STAGE) {
    return {
      eligible: false,
      reason: "Masyadong bata para gatasin / Too young to produce milk",
    };
  }

  // Breeding stage but no offspring/lactation — block
  if (isBreedingOrPostCalvingByStage(animal.life_stage)) {
    return {
      eligible: false,
      reason: "Hindi pa nanganganak — walang gatas / Has not calved — no milk",
    };
  }

  // Pregnant but no offspring yet (first pregnancy) — block
  if (isPregnant(animal.fertility_status, animal.life_stage) && animal.offspring_count === 0) {
    return {
      eligible: false,
      reason: "Buntis pa — hindi pa nanganganak / Pregnant — has not calved yet",
    };
  }

  // No life stage, not lactating, no offspring — block
  return {
    eligible: false,
    reason: "Walang ebidensya ng gatas / No evidence of milk production",
  };
}

/**
 * Can this animal have a heat detection record?
 * Requires: Female + at breeding age
 */
export function canRecordHeat(animal: EligibilityInput): EligibilityResult {
  // Gender check
  if (!animal.gender) {
    return { eligible: false, reason: "Hindi alam ang kasarian / Gender unknown" };
  }
  if (isMale(animal.gender)) {
    return { eligible: false, reason: "Lalaki — walang heat cycle / Male — no heat cycle" };
  }
  if (!isFemale(animal.gender)) {
    return { eligible: false, reason: "Hindi alam ang kasarian / Gender unknown" };
  }

  // Try age-based check first
  const ageCheck = isAtBreedingAge(animal.birth_date, animal.livestock_type);
  if (ageCheck.known) {
    if (!ageCheck.atAge) {
      return {
        eligible: false,
        reason: "Masyadong bata para sa breeding / Too young for breeding",
      };
    }
    return { eligible: true };
  }

  // No birth_date — fall back to life stage
  if (animal.life_stage) {
    // Doeling special case: may be at breeding age (8-10m) but we can't confirm without birth_date
    if (animal.life_stage === DOELING_STAGE) {
      return {
        eligible: true,
        warning: true,
        reason: "Walang birth date — i-verify kung breeding age na / No birth date — verify if breeding age",
      };
    }

    if (isPreBreedingByStage(animal.life_stage)) {
      return {
        eligible: false,
        reason: "Masyadong bata para sa breeding / Too young for breeding",
      };
    }

    if (isBreedingOrPostCalvingByStage(animal.life_stage)) {
      return { eligible: true };
    }

    // Male stages
    if (MALE_STAGES.includes(animal.life_stage)) {
      return { eligible: false, reason: "Lalaki — walang heat cycle / Male — no heat cycle" };
    }
  }

  // No livestock_type — can't determine breeding age
  if (!animal.livestock_type) {
    return {
      eligible: false,
      reason: "Walang uri ng hayop — hindi ma-check ang breeding age / No livestock type — cannot check breeding age",
    };
  }

  // No birth_date AND no life_stage — allow with warning (likely an adult female)
  return {
    eligible: true,
    warning: true,
    reason: "Walang birth date — i-verify kung breeding age na / No birth date — verify if breeding age",
  };
}

/**
 * Can this animal be scheduled for AI?
 * Requires: Female + at breeding age + not currently pregnant
 */
export function canScheduleAI(animal: EligibilityInput): EligibilityResult {
  // First check breeding eligibility (same as heat)
  const heatResult = canRecordHeat(animal);
  if (!heatResult.eligible) {
    return heatResult;
  }

  // Check if already pregnant — block new AI
  if (isPregnant(animal.fertility_status, animal.life_stage)) {
    return {
      eligible: false,
      reason: "Buntis na — hindi pwede mag-AI / Already pregnant — cannot schedule AI",
    };
  }

  // Carry forward any warning from heat check
  return heatResult;
}

/**
 * Can this animal have a calving record?
 * Requires: Female + pregnant (or has active AI suggesting possible pregnancy)
 */
export function canRecordCalving(animal: EligibilityInput): EligibilityResult {
  // Gender check
  if (!animal.gender) {
    return { eligible: false, reason: "Hindi alam ang kasarian / Gender unknown" };
  }
  if (isMale(animal.gender)) {
    return { eligible: false, reason: "Lalaki — hindi manganganak / Male — cannot calve" };
  }
  if (!isFemale(animal.gender)) {
    return { eligible: false, reason: "Hindi alam ang kasarian / Gender unknown" };
  }

  // If confirmed/suspected pregnant, allow
  if (isPregnant(animal.fertility_status, animal.life_stage)) {
    return { eligible: true };
  }

  // If has bred_waiting status (AI performed, waiting for confirmation)
  if (animal.fertility_status === "bred_waiting") {
    return {
      eligible: true,
      warning: true,
      reason: "Hindi pa confirmed pregnant / Not yet confirmed pregnant",
    };
  }

  // If has offspring already (experienced mother might calve without tracked pregnancy)
  if (animal.offspring_count > 0) {
    return {
      eligible: true,
      warning: true,
      reason: "Hindi pa confirmed pregnant / Not yet confirmed pregnant",
    };
  }

  // Pre-breeding stages — hard block
  if (isPreBreedingByStage(animal.life_stage) || animal.life_stage === DOELING_STAGE) {
    return {
      eligible: false,
      reason: "Masyadong bata para manganak / Too young to calve",
    };
  }

  // Breeding-age but no pregnancy evidence
  if (animal.fertility_status === "open_cycling" || animal.fertility_status === "not_eligible") {
    return {
      eligible: false,
      reason: "Hindi buntis / Not pregnant",
    };
  }

  // No fertility_status at all + breeding-age — allow with warning
  // (farmer may not have tracked the pregnancy)
  if (!animal.fertility_status && isBreedingOrPostCalvingByStage(animal.life_stage)) {
    return {
      eligible: true,
      warning: true,
      reason: "Walang pregnancy record — i-verify kung buntis / No pregnancy record — verify if pregnant",
    };
  }

  // No life_stage AND no fertility_status — allow with warning for adult females
  if (!animal.life_stage && !animal.fertility_status) {
    return {
      eligible: true,
      warning: true,
      reason: "Walang pregnancy record — i-verify kung buntis / No pregnancy record — verify if pregnant",
    };
  }

  return {
    eligible: false,
    reason: "Hindi buntis / Not pregnant",
  };
}

// ---------------------------------------------------------------------------
// "More Actions" Eligibility — fertility-status-based gating
// ---------------------------------------------------------------------------

/**
 * Can this animal be marked as suspected pregnant (non-return)?
 * Requires: Female + bred_waiting status (AI performed, waiting for result)
 */
export function canMarkNonReturn(animal: EligibilityInput): EligibilityResult {
  if (!isFemale(animal.gender)) {
    return { eligible: false, reason: "Lalaki / Male" };
  }
  if (animal.fertility_status === 'bred_waiting') {
    return { eligible: true };
  }
  if (animal.fertility_status === 'suspected_pregnant' || animal.fertility_status === 'confirmed_pregnant') {
    return { eligible: false, reason: "Buntis na — hindi kailangan / Already pregnant" };
  }
  if (animal.fertility_status === 'fresh_postpartum') {
    return { eligible: false, reason: "Bagong panganak — recovery pa / Just calved — still recovering" };
  }
  return { eligible: false, reason: "Walang AI record — i-schedule muna / No AI performed — schedule AI first" };
}

/**
 * Can this animal's pregnancy be confirmed?
 * Requires: Female + suspected_pregnant status
 */
export function canConfirmPregnancy(animal: EligibilityInput): EligibilityResult {
  if (!isFemale(animal.gender)) {
    return { eligible: false, reason: "Lalaki / Male" };
  }
  if (animal.fertility_status === 'suspected_pregnant') {
    return { eligible: true };
  }
  if (animal.fertility_status === 'confirmed_pregnant') {
    return { eligible: false, reason: "Confirmed na / Already confirmed pregnant" };
  }
  if (animal.fertility_status === 'bred_waiting') {
    return { eligible: true, warning: true, reason: "Hindi pa suspected — i-mark muna as non-return / Not yet suspected — mark non-return first" };
  }
  if (animal.fertility_status === 'fresh_postpartum') {
    return { eligible: false, reason: "Bagong panganak — recovery pa / Just calved — still recovering" };
  }
  return { eligible: false, reason: "Hindi buntis / Not pregnant" };
}

/**
 * Can pregnancy failure be recorded for this animal?
 * Requires: Female + suspected_pregnant OR confirmed_pregnant
 */
export function canRecordPregnancyFailed(animal: EligibilityInput): EligibilityResult {
  if (!isFemale(animal.gender)) {
    return { eligible: false, reason: "Lalaki / Male" };
  }
  if (animal.fertility_status === 'suspected_pregnant' || animal.fertility_status === 'confirmed_pregnant') {
    return { eligible: true };
  }
  if (animal.fertility_status === 'fresh_postpartum') {
    return { eligible: false, reason: "Nanganak na / Already calved" };
  }
  return { eligible: false, reason: "Hindi buntis — walang pregnancy na i-fail / Not pregnant — no pregnancy to fail" };
}

/**
 * Can heat return be recorded for this animal?
 * Requires: Female + bred_waiting OR suspected_pregnant (returned to heat before confirmation)
 */
export function canRecordHeatReturn(animal: EligibilityInput): EligibilityResult {
  if (!isFemale(animal.gender)) {
    return { eligible: false, reason: "Lalaki / Male" };
  }
  if (animal.fertility_status === 'bred_waiting' || animal.fertility_status === 'suspected_pregnant') {
    return { eligible: true };
  }
  if (animal.fertility_status === 'confirmed_pregnant') {
    return { eligible: true, warning: true, reason: "Confirmed pregnant — i-verify kung talagang bumalik sa heat / Confirmed pregnant — verify heat return" };
  }
  if (animal.fertility_status === 'fresh_postpartum') {
    return { eligible: false, reason: "Bagong panganak — recovery pa / Just calved — still recovering" };
  }
  return { eligible: false, reason: "Hindi pa na-breed / Not yet bred" };
}

/**
 * Can VWP (voluntary waiting period) completion be recorded?
 * Requires: Female + fresh_postpartum status
 */
export function canCompleteVWP(animal: EligibilityInput): EligibilityResult {
  if (!isFemale(animal.gender)) {
    return { eligible: false, reason: "Lalaki / Male" };
  }
  if (animal.fertility_status === 'fresh_postpartum') {
    return { eligible: true };
  }
  if (animal.fertility_status === 'open_cycling') {
    return { eligible: false, reason: "Open cycling na / Already open cycling" };
  }
  return { eligible: false, reason: "Hindi postpartum / Not in postpartum period" };
}
