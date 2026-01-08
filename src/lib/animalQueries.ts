/**
 * Shared animal query utilities for consistent filtering across components
 */

export const LACTATING_STAGES = ['Early Lactation', 'Mid-Lactation', 'Late Lactation'];

/**
 * Returns the Supabase OR filter string for lactating animals.
 * Animals are considered lactating if:
 * 1. Their milking_stage is in LACTATING_STAGES, OR
 * 2. Their is_currently_lactating flag is true
 */
export function getLactatingAnimalsOrFilter(): string {
  const stagesFilter = LACTATING_STAGES.map(s => `"${s}"`).join(',');
  return `milking_stage.in.(${stagesFilter}),is_currently_lactating.eq.true`;
}
