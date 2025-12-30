/**
 * Weight hints utility - provides contextual weight guidance based on animal type
 */

export interface WeightHint {
  label: string;
  range: { min: number; max: number };
  unit: string;
}

interface WeightRange {
  min: number;
  max: number;
}

// Birth weight ranges by livestock type (in kg)
const BIRTH_WEIGHT_RANGES: Record<string, WeightRange> = {
  cattle: { min: 25, max: 45 },
  goat: { min: 2, max: 4 },
  sheep: { min: 3, max: 5 },
  carabao: { min: 25, max: 35 },
};

// Entry/adult weight ranges by livestock type and gender (in kg)
const ENTRY_WEIGHT_RANGES: Record<string, Record<string, WeightRange>> = {
  cattle: {
    Female: { min: 350, max: 650 },
    Male: { min: 400, max: 800 },
    default: { min: 350, max: 700 },
  },
  goat: {
    Female: { min: 25, max: 60 },
    Male: { min: 35, max: 80 },
    default: { min: 25, max: 70 },
  },
  sheep: {
    Female: { min: 35, max: 80 },
    Male: { min: 45, max: 120 },
    default: { min: 35, max: 100 },
  },
  carabao: {
    Female: { min: 200, max: 500 },
    Male: { min: 250, max: 700 },
    default: { min: 200, max: 600 },
  },
};

// Current weight ranges by life stage
interface StageRanges {
  [stage: string]: WeightRange;
}

interface GenderRanges {
  Female: StageRanges;
  Male: StageRanges;
  default: WeightRange;
}

const CURRENT_WEIGHT_RANGES: Record<string, GenderRanges> = {
  cattle: {
    Female: {
      Calf: { min: 40, max: 120 },
      "Heifer Calf": { min: 120, max: 200 },
      "Breeding Heifer": { min: 200, max: 380 },
      "Pregnant Heifer": { min: 350, max: 450 },
      "First-Calf Heifer": { min: 400, max: 500 },
      "Mature Cow": { min: 450, max: 650 },
      default: { min: 350, max: 650 },
    },
    Male: {
      "Bull Calf": { min: 40, max: 180 },
      "Young Bull": { min: 180, max: 400 },
      "Mature Bull": { min: 400, max: 800 },
      default: { min: 400, max: 800 },
    },
    default: { min: 350, max: 700 },
  },
  goat: {
    Female: {
      Kid: { min: 5, max: 15 },
      "Young Doe": { min: 15, max: 30 },
      "Mature Doe": { min: 30, max: 60 },
      default: { min: 25, max: 60 },
    },
    Male: {
      Kid: { min: 5, max: 15 },
      "Young Buck": { min: 15, max: 40 },
      "Mature Buck": { min: 40, max: 80 },
      default: { min: 35, max: 80 },
    },
    default: { min: 25, max: 70 },
  },
  sheep: {
    Female: {
      Lamb: { min: 8, max: 20 },
      "Young Ewe": { min: 20, max: 40 },
      "Mature Ewe": { min: 40, max: 80 },
      default: { min: 35, max: 80 },
    },
    Male: {
      Lamb: { min: 8, max: 20 },
      "Young Ram": { min: 20, max: 50 },
      "Mature Ram": { min: 50, max: 120 },
      default: { min: 45, max: 120 },
    },
    default: { min: 35, max: 100 },
  },
  carabao: {
    Female: {
      Calf: { min: 20, max: 60 },
      "Young Female": { min: 60, max: 200 },
      "Mature Female": { min: 200, max: 500 },
      default: { min: 200, max: 500 },
    },
    Male: {
      Calf: { min: 20, max: 60 },
      "Young Bull": { min: 60, max: 250 },
      "Mature Bull": { min: 250, max: 700 },
      default: { min: 250, max: 700 },
    },
    default: { min: 200, max: 600 },
  },
};

// Livestock type labels
const LIVESTOCK_LABELS: Record<string, { singular: string; offspring: string }> = {
  cattle: { singular: "cattle", offspring: "calves" },
  goat: { singular: "goat", offspring: "kids" },
  sheep: { singular: "sheep", offspring: "lambs" },
  carabao: { singular: "carabao", offspring: "calves" },
};

/**
 * Get birth weight hint for offspring
 */
export function getBirthWeightHint(livestockType: string): WeightHint {
  const type = livestockType?.toLowerCase() || "cattle";
  const range = BIRTH_WEIGHT_RANGES[type] || BIRTH_WEIGHT_RANGES.cattle;
  const labels = LIVESTOCK_LABELS[type] || LIVESTOCK_LABELS.cattle;

  return {
    label: `Typical for ${labels.offspring}`,
    range,
    unit: "kg",
  };
}

/**
 * Get entry weight hint for new entrants (typically adults)
 */
export function getEntryWeightHint(livestockType: string, gender?: string | null): WeightHint {
  const type = livestockType?.toLowerCase() || "cattle";
  const ranges = ENTRY_WEIGHT_RANGES[type] || ENTRY_WEIGHT_RANGES.cattle;
  
  const genderKey = gender || "default";
  const range = ranges[genderKey] || ranges.default;
  const labels = LIVESTOCK_LABELS[type] || LIVESTOCK_LABELS.cattle;

  const genderLabel = gender ? ` (${gender.toLowerCase()})` : "";

  return {
    label: `Typical for adult ${labels.singular}${genderLabel}`,
    range,
    unit: "kg",
  };
}

/**
 * Get current weight hint based on life stage
 */
export function getCurrentWeightHint(
  livestockType: string,
  gender?: string | null,
  lifeStage?: string | null
): WeightHint {
  const type = livestockType?.toLowerCase() || "cattle";
  const typeRanges = CURRENT_WEIGHT_RANGES[type] || CURRENT_WEIGHT_RANGES.cattle;
  const labels = LIVESTOCK_LABELS[type] || LIVESTOCK_LABELS.cattle;

  let range: WeightRange;
  let stageLabel = "";

  if (gender === "Female" || gender === "Male") {
    const genderRanges = typeRanges[gender];
    if (lifeStage && genderRanges[lifeStage]) {
      range = genderRanges[lifeStage];
      stageLabel = ` (${lifeStage})`;
    } else {
      range = genderRanges.default || typeRanges.default;
    }
  } else {
    range = typeRanges.default;
  }

  return {
    label: `Typical for ${labels.singular}${stageLabel}`,
    range,
    unit: "kg",
  };
}

/**
 * Format hint as display string
 */
export function formatWeightHint(hint: WeightHint): string {
  return `${hint.label}: ${hint.range.min}-${hint.range.max} ${hint.unit}`;
}
