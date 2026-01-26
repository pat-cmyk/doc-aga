/**
 * Fuzzy Matching Utility
 * 
 * Implements Levenshtein distance-based fuzzy string matching
 * for voice transcription scenarios where exact matches may fail.
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0 to 1)
 */
export function similarityScore(a: string, b: string): number {
  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();
  
  if (normalizedA === normalizedB) return 1;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;
  
  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Find the best fuzzy match from a list of candidates
 */
export interface FuzzyMatchResult {
  match: string | null;
  score: number;
  index: number;
}

export function findBestMatch(
  query: string,
  candidates: string[],
  threshold: number = 0.75
): FuzzyMatchResult {
  if (!query || candidates.length === 0) {
    return { match: null, score: 0, index: -1 };
  }

  let bestMatch: string | null = null;
  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const score = similarityScore(query, candidate);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
      bestIndex = i;
    }
  }

  // Only return if above threshold
  if (bestScore >= threshold) {
    return { match: bestMatch, score: bestScore, index: bestIndex };
  }

  return { match: null, score: bestScore, index: -1 };
}

/**
 * Find all matches above a threshold, sorted by score
 */
export function findAllMatches(
  query: string,
  candidates: string[],
  threshold: number = 0.6
): Array<{ match: string; score: number; index: number }> {
  if (!query || candidates.length === 0) {
    return [];
  }

  const matches = candidates
    .map((candidate, index) => ({
      match: candidate,
      score: similarityScore(query, candidate),
      index,
    }))
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Normalize ear tag for matching (removes common prefixes/suffixes)
 */
export function normalizeEarTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/^(tag|ear\s*tag|tatak|numero|no\.?|#)\s*/i, '')
    .replace(/[^a-z0-9]/gi, '');
}

/**
 * Match ear tag from transcription against list of known tags
 * Uses exact normalized matching for precision
 */
export function matchEarTag(
  transcribedTag: string,
  knownTags: string[]
): string | null {
  const normalizedQuery = normalizeEarTag(transcribedTag);
  
  if (!normalizedQuery) return null;
  
  for (const tag of knownTags) {
    if (normalizeEarTag(tag) === normalizedQuery) {
      return tag;
    }
  }
  
  return null;
}
