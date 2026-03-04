/**
 * Standard revenue sources for farm financial tracking (SSOT)
 *
 * All revenue source names MUST reference these constants.
 * Never hardcode source strings — use REVENUE_SOURCES or REVENUE_SOURCE_KEYS.
 *
 * @constant
 */
export const REVENUE_SOURCES = [
  "Milk Sale",            // Dairy product sales
  "Animal Sale",          // Livestock sales
  "Government Subsidy",   // Government programs / subsidies
  "Breeding Service",     // Bull / AI service fees
  "Manure Sale",          // Fertilizer / manure sales
  "Other Income",         // Miscellaneous revenue
] as const;

/**
 * TypeScript type for revenue sources
 */
export type RevenueSource = (typeof REVENUE_SOURCES)[number];

/**
 * Named keys for programmatic access (avoids string literals in logic)
 */
export const REVENUE_SOURCE_KEYS = {
  MILK_SALE: "Milk Sale" as const,
  ANIMAL_SALE: "Animal Sale" as const,
  GOVERNMENT_SUBSIDY: "Government Subsidy" as const,
  BREEDING_SERVICE: "Breeding Service" as const,
  MANURE_SALE: "Manure Sale" as const,
  OTHER_INCOME: "Other Income" as const,
};

/**
 * Get the emoji icon for a given revenue source
 */
export function getRevenueSourceIcon(source: string): string {
  switch (source) {
    case REVENUE_SOURCE_KEYS.MILK_SALE:
      return "🥛";
    case REVENUE_SOURCE_KEYS.ANIMAL_SALE:
      return "🐄";
    case REVENUE_SOURCE_KEYS.GOVERNMENT_SUBSIDY:
      return "🏛️";
    case REVENUE_SOURCE_KEYS.BREEDING_SERVICE:
      return "🧬";
    case REVENUE_SOURCE_KEYS.MANURE_SALE:
      return "🌱";
    default:
      return "💰";
  }
}
