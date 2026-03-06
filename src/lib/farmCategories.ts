/**
 * Farm Category System — SSOT for farm-level classification
 *
 * Farms are categorized at a higher level (ruminant, swine, poultry)
 * while individual animals retain their specific livestock_type
 * (cattle, goat, sheep, carabao).
 *
 * This file is the single source of truth for:
 * - Farm category definitions (with Taglish labels)
 * - Display label resolution for any farms.livestock_type value
 * - Default animal type mapping for breed dropdowns
 */

import type { LivestockType } from './livestockBreeds';

/** Farm-level category (stored in farms.livestock_type for new farms) */
export type FarmCategory = 'ruminant' | 'swine' | 'poultry';

export interface FarmCategoryConfig {
  value: FarmCategory;
  emoji: string;
  englishLabel: string;
  filipinoLabel: string;
  /** Species included, in Taglish — shown as subtitle on the card */
  speciesSubtitle: string;
  /** Whether this category is currently available */
  enabled: boolean;
}

/**
 * All farm categories with their configuration.
 * Only 'ruminant' is enabled. Swine and poultry are coming soon.
 */
export const FARM_CATEGORIES: readonly FarmCategoryConfig[] = [
  {
    value: 'ruminant',
    emoji: '🐄',
    englishLabel: 'Ruminant',
    filipinoLabel: 'Ruminante',
    speciesSubtitle: 'Baka, Kambing, Tupa, Kalabaw',
    enabled: true,
  },
  {
    value: 'swine',
    emoji: '🐖',
    englishLabel: 'Swine',
    filipinoLabel: 'Baboy',
    speciesSubtitle: 'Baboy',
    enabled: false,
  },
  {
    value: 'poultry',
    emoji: '🐔',
    englishLabel: 'Poultry',
    filipinoLabel: 'Manukan',
    speciesSubtitle: 'Manok, Itik, Pabo',
    enabled: false,
  },
] as const;

/**
 * Display-friendly label for any farms.livestock_type value.
 *
 * Handles both new category values ('ruminant') and legacy
 * species values ('cattle', 'goat', 'sheep', 'carabao').
 *
 * @example
 * getFarmCategoryLabel('ruminant')  // "Ruminant"
 * getFarmCategoryLabel('cattle')    // "Cattle"
 * getFarmCategoryLabel('goat')      // "Goat"
 */
export function getFarmCategoryLabel(livestockType: string | null | undefined): string {
  if (!livestockType) return 'N/A';

  // Check farm categories first
  const category = FARM_CATEGORIES.find(c => c.value === livestockType);
  if (category) return category.englishLabel;

  // Legacy species values — capitalize first letter
  return livestockType.charAt(0).toUpperCase() + livestockType.slice(1);
}

/**
 * Map farm-level livestock type to a default animal-level type.
 *
 * When a farm is 'ruminant', the default animal type is 'cattle'
 * (the most common ruminant in Philippine farms).
 * For legacy farm values ('cattle', 'goat', etc.), pass through as-is.
 *
 * Used by AdminAnimalDialog for breed dropdown fallback.
 */
export function getDefaultAnimalType(farmLivestockType: string | null | undefined): LivestockType {
  if (!farmLivestockType || farmLivestockType === 'ruminant') return 'cattle';
  return farmLivestockType as LivestockType;
}
