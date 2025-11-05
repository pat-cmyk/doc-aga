/**
 * Feed type normalization utilities to ensure consistency across the system
 */

/**
 * Normalizes a feed type name to title case
 * Examples:
 * - "baled corn silage" → "Baled Corn Silage"
 * - "HAY" → "Hay"
 * - "fresh cut & carry" → "Fresh Cut & Carry"
 */
export function normalizeFeedType(feedType: string): string {
  if (!feedType) return "";
  
  return feedType
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      // Keep common short words lowercase (articles, conjunctions, prepositions)
      const lowercase = ['a', 'an', 'the', 'and', 'or', 'but', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'with'];
      
      // Always capitalize first word
      if (lowercase.includes(word) && word !== feedType.trim().toLowerCase().split(/\s+/)[0]) {
        return word;
      }
      
      // Capitalize first letter, keep rest as lowercase
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    // Handle special characters
    .replace(/\s+&\s+/g, ' & '); // Ensure proper spacing around &
}

/**
 * Gets unique normalized feed types from a list
 */
export function getUniqueFeedTypes(feedTypes: string[]): string[] {
  const normalized = feedTypes.map(normalizeFeedType);
  return Array.from(new Set(normalized)).sort();
}

/**
 * Finds the best match for a feed type from available inventory
 * Uses case-insensitive comparison
 */
export function findMatchingFeedType(
  inputType: string,
  availableTypes: string[]
): string | null {
  if (!inputType) return null;
  
  const normalizedInput = normalizeFeedType(inputType);
  
  // First try exact match (after normalization)
  const exactMatch = availableTypes.find(
    type => normalizeFeedType(type) === normalizedInput
  );
  
  if (exactMatch) return normalizeFeedType(exactMatch);
  
  // Then try partial match
  const partialMatch = availableTypes.find(
    type => normalizeFeedType(type).includes(normalizedInput) ||
            normalizedInput.includes(normalizeFeedType(type))
  );
  
  return partialMatch ? normalizeFeedType(partialMatch) : normalizedInput;
}
