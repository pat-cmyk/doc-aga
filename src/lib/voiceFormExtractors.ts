/**
 * Voice Form Extractors
 * 
 * Configurable extraction functions for parsing transcriptions
 * into structured form data for different use cases.
 * 
 * SSOT: This is the single source of truth for all voice data extraction logic.
 */

import { findBestMatch, findAllMatches, normalizeEarTag } from './fuzzyMatch';

// ==================== TYPES ====================

export interface ExtractedMilkData {
  totalLiters?: number;
  session?: 'AM' | 'PM';
  animalSelection?: string; // 'all-lactating' | 'individual:<id>' | 'species:<type>'
  matchedAnimalName?: string; // For toast feedback
  recordDate?: Date; // Extracted date from voice input
  rawTranscription?: string; // For debugging/display
  warnings?: string[]; // Validation warnings for user review
}

export interface ExtractedFeedData {
  totalKg?: number;
  feedType?: string;
  feedInventoryId?: string; // For matching to inventory
  animalSelection?: string;
  recordDate?: Date; // For backdating
  warnings?: string[];
  suggestedFeeds?: Array<{ id: string; name: string; score: number }>; // Fuzzy match suggestions
  matchConfidence?: 'high' | 'low' | 'none'; // Confidence level for auto-pick
  rawSpokenFeed?: string; // Original spoken feed name for toast display
}

export interface ExtractedTextData {
  text: string;
}

export interface FeedInventoryItem {
  id: string;
  feed_type: string;
}

export interface AnimalItem {
  id: string;
  name: string | null;
  ear_tag: string | null;
}

export type ExtractorType = 'milk' | 'feed' | 'text' | 'custom';

export type ExtractorContext = {
  feedInventory?: FeedInventoryItem[];
  animals?: AnimalItem[];
  [key: string]: any;
};

// ==================== VALIDATION THRESHOLDS ====================

const MILK_VOLUME_THRESHOLDS = {
  singleAnimalMax: 50,      // Max realistic liters from one animal per session
  singleAnimalWarning: 35,  // Show warning above this
  farmTotalMax: 500,        // Max realistic farm total
  farmTotalWarning: 150,    // Show warning above this (was 200, lowered for safety)
};

// ==================== DATE EXTRACTION HELPERS ====================

const MONTH_MAP: Record<string, number> = {
  'january': 0, 'jan': 0,
  'february': 1, 'feb': 1,
  'march': 2, 'mar': 2,
  'april': 3, 'apr': 3,
  'may': 4,
  'june': 5, 'jun': 5,
  'july': 6, 'jul': 6,
  'august': 7, 'aug': 7,
  'september': 8, 'sep': 8, 'sept': 8,
  'october': 9, 'oct': 9,
  'november': 10, 'nov': 10,
  'december': 11, 'dec': 11,
};

/**
 * Extract date from transcription
 * Supports: "January 23, 2026", "23 January 2026", "01/23/2026", "kahapon", etc.
 */
function extractDateFromText(text: string): Date | undefined {
  const lowerText = text.toLowerCase();
  const today = new Date();
  
  // Check for relative dates first
  if (lowerText.includes('kahapon') || lowerText.includes('yesterday')) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  
  if (lowerText.includes('kanina') || lowerText.includes('earlier today') || lowerText.includes('this morning') || lowerText.includes('today')) {
    return today;
  }
  
  // Pattern 1: "January 23, 2026" or "January 23 2026" or "Jan 23, 2026"
  const monthFirstPattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/i;
  const monthFirstMatch = text.match(monthFirstPattern);
  if (monthFirstMatch) {
    const month = MONTH_MAP[monthFirstMatch[1].toLowerCase()];
    const day = parseInt(monthFirstMatch[2], 10);
    const year = parseInt(monthFirstMatch[3], 10);
    if (month !== undefined && day >= 1 && day <= 31 && year >= 2020 && year <= 2030) {
      return new Date(year, month, day);
    }
  }
  
  // Pattern 2: "23 January 2026" or "23rd of January 2026"
  const dayFirstPattern = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s*,?\s*(\d{4})\b/i;
  const dayFirstMatch = text.match(dayFirstPattern);
  if (dayFirstMatch) {
    const day = parseInt(dayFirstMatch[1], 10);
    const month = MONTH_MAP[dayFirstMatch[2].toLowerCase()];
    const year = parseInt(dayFirstMatch[3], 10);
    if (month !== undefined && day >= 1 && day <= 31 && year >= 2020 && year <= 2030) {
      return new Date(year, month, day);
    }
  }
  
  // Pattern 3: "01/23/2026" or "1-23-2026" (US format MM/DD/YYYY)
  const slashPattern = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/;
  const slashMatch = text.match(slashPattern);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1; // 0-indexed
    const day = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 2020 && year <= 2030) {
      return new Date(year, month, day);
    }
  }
  
  return undefined;
}

// ==================== MILK EXTRACTOR ====================

/**
 * Extract milk recording data from transcription
 * 
 * Parses: liters/litro, morning/umaga, evening/gabi, dates
 * Supports individual animal matching by name or ear tag
 */
export function extractMilkData(
  transcription: string,
  context?: ExtractorContext
): ExtractedMilkData {
  const result: ExtractedMilkData = {
    rawTranscription: transcription,
  };
  const lowerText = transcription.toLowerCase();

  // Extract date first
  const extractedDate = extractDateFromText(transcription);
  if (extractedDate) {
    result.recordDate = extractedDate;
  }

  // Extract liters - look for numbers followed by liters/litro/L
  const literPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:liters?|litro|l\b)/i,
    /(?:collected|pumitas|nakuha|kumuha)\s*(?:ng)?\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:na\s+)?(?:litro|liters?)/i,
  ];

  for (const pattern of literPatterns) {
    const match = transcription.match(pattern);
    if (match) {
      result.totalLiters = parseFloat(match[1]);
      break;
    }
  }

  // If no pattern matched, try to find any standalone number that could be liters
  if (!result.totalLiters) {
    const numberMatch = transcription.match(/\b(\d+(?:\.\d+)?)\b/);
    if (numberMatch) {
      const num = parseFloat(numberMatch[1]);
      // Only use if it's a reasonable liter amount (0.1 - 500)
      if (num >= 0.1 && num <= 500) {
        result.totalLiters = num;
      }
    }
  }

  // Validate extracted liters - add warnings about unrealistic values
  const warnings: string[] = [];
  if (result.totalLiters) {
    // Check if this is for individual animal (based on context hints)
    const hasIndividualKeywords = /\b(si|ni|kay|from|galing|kay|yung)\s+\w+/i.test(transcription);
    
    if (hasIndividualKeywords && result.totalLiters > MILK_VOLUME_THRESHOLDS.singleAnimalWarning) {
      warnings.push(`${result.totalLiters}L seems high for one animal. Please verify.`);
      console.warn(`[VoiceExtractor] High individual milk: ${result.totalLiters}L from "${transcription.substring(0, 60)}..."`);
    } else if (result.totalLiters > MILK_VOLUME_THRESHOLDS.farmTotalWarning) {
      warnings.push(`${result.totalLiters}L seems unusually high. Did you mean ${Math.round(result.totalLiters / 10)}L?`);
      console.warn(`[VoiceExtractor] High farm total milk: ${result.totalLiters}L from "${transcription.substring(0, 60)}..."`);
    }
  }
  
  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  // Extract session (AM/PM)
  const morningKeywords = ['morning', 'umaga', 'am', 'a.m.', 'breakfast', 'early'];
  const eveningKeywords = ['evening', 'gabi', 'hapon', 'pm', 'p.m.', 'afternoon', 'night'];

  if (morningKeywords.some(kw => lowerText.includes(kw))) {
    result.session = 'AM';
  } else if (eveningKeywords.some(kw => lowerText.includes(kw))) {
    result.session = 'PM';
  }

  // Try to match individual animal by name or ear tag using fuzzy matching
  const animals = context?.animals || [];
  const animalNames = animals.filter(a => a.name).map(a => a.name as string);
  
  // First, try fuzzy matching on animal names
  // Look for animal name patterns in transcription
  const namePatterns = [
    /(?:si|ni|kay|from|galing)\s+(\w+)/i,
    /(\w+)\s+(?:gave|gave|nagbigay|pumitas)/i,
    /(?:baka|cow|animal)\s+(?:na\s+)?(?:si\s+)?(\w+)/i,
  ];
  
  for (const pattern of namePatterns) {
    const match = transcription.match(pattern);
    if (match && match[1]) {
      const spokenName = match[1];
      const fuzzyResult = findBestMatch(spokenName, animalNames, 0.7);
      
      if (fuzzyResult.match) {
        const matchedAnimal = animals.find(a => a.name === fuzzyResult.match);
        if (matchedAnimal) {
          result.animalSelection = `individual:${matchedAnimal.id}`;
          result.matchedAnimalName = matchedAnimal.name || matchedAnimal.ear_tag || undefined;
          console.log(`[VoiceExtractor] Fuzzy matched "${spokenName}" → "${fuzzyResult.match}" (score: ${fuzzyResult.score.toFixed(2)})`);
          break;
        }
      }
    }
  }
  
  // If no fuzzy match, try exact matching (original logic)
  if (!result.animalSelection) {
    for (const animal of animals) {
      // Match by name (exact substring)
      if (animal.name) {
        const nameLower = animal.name.toLowerCase();
        if (lowerText.includes(nameLower)) {
          result.animalSelection = `individual:${animal.id}`;
          result.matchedAnimalName = animal.name;
          break;
        }
      }
      
      // Match by ear tag (normalized)
      if (animal.ear_tag) {
        const tagNormalized = normalizeEarTag(animal.ear_tag);
        // Look for ear tag patterns in text
        const earTagPatterns = [
          /(?:ear\s*tag|tag|tatak|numero|no\.?|#)\s*([a-z0-9]+)/i,
          /\b([a-z]\d{2,4})\b/i, // Common format like G001, C42
        ];
        
        for (const pattern of earTagPatterns) {
          const tagMatch = transcription.match(pattern);
          if (tagMatch) {
            const spokenTag = normalizeEarTag(tagMatch[1]);
            if (spokenTag === tagNormalized) {
              result.animalSelection = `individual:${animal.id}`;
              result.matchedAnimalName = animal.name || animal.ear_tag;
              break;
            }
          }
        }
        if (result.animalSelection) break;
      }
    }
  }

  // Check for explicit "all" keywords only if no individual animal was matched
  if (!result.animalSelection) {
    const allKeywords = ['lahat', 'all', 'everyone', 'everybody', 'all lactating', 'total', 'kabuuan'];
    if (allKeywords.some(kw => lowerText.includes(kw))) {
      result.animalSelection = 'all-lactating';
    }
  }

  // Default to 'all-lactating' when liters are extracted but no specific animal mentioned
  // This enables auto-submit for simple inputs like "40 liters morning"
  if (result.totalLiters && !result.animalSelection) {
    result.animalSelection = 'all-lactating';
  }

  return result;
}

// ==================== SPOKEN NUMBER PARSER ====================

/**
 * Number word mappings for English and Filipino
 */
const NUMBER_WORDS: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  // Filipino
  isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9,
  sampu: 10, dalawampu: 20, tatlumpu: 30, apatnapu: 40, limampu: 50,
  animnapu: 60, pitumpu: 70, walumpu: 80, siyamnapu: 90,
  // Filipino compound prefixes (labing- = 10+)
  labingisa: 11, labingdalawa: 12, labingtatlo: 13, labingapat: 14, labing: 10,
};

// Create regex pattern from number words for direct matching
const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS).join('|');

/**
 * Parse spoken numbers (English or Filipino) to digits
 * Examples: "forty-seven" → 47, "apatnapu't pito" → 47, "ten" → 10
 */
function parseSpokenNumber(text: string): number | undefined {
  // First try to find digits directly
  const digitMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
  if (digitMatch) return parseFloat(digitMatch[1]);
  
  // Parse compound spoken numbers: "forty-seven", "forty seven", "apatnapu't pito"
  const lowerText = text.toLowerCase().replace(/['\-t]/g, ' ');
  let total = 0;
  
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    const value = NUMBER_WORDS[word];
    if (value !== undefined) {
      if (value >= 100) {
        // Handle "hundred" as multiplier
        total = (total || 1) * value;
      } else {
        total += value;
      }
    }
  }
  
  return total > 0 ? total : undefined;
}

/**
 * Extract spoken number directly before kilo/kg units
 * Handles: "ten kilos", "na ten kilos", "ng twenty kilo"
 */
function extractSpokenKilograms(text: string): number | undefined {
  const lowerText = text.toLowerCase();
  
  // Pattern 1: Direct number word before kilo/kg (e.g., "ten kilos")
  const directPattern = new RegExp(
    `\\b(${NUMBER_WORD_PATTERN})\\s*(?:kilo|kg|kilos|kilograms?)\\b`,
    'i'
  );
  const directMatch = lowerText.match(directPattern);
  if (directMatch) {
    const parsed = parseSpokenNumber(directMatch[1]);
    if (parsed && parsed >= 0.5 && parsed <= 500) {
      console.log(`[VoiceExtractor] Direct number word match: "${directMatch[1]}" → ${parsed}`);
      return parsed;
    }
  }
  
  // Pattern 2: Tagalog article before number (e.g., "na ten kilos", "ng twenty kilo")
  const tagalogPattern = new RegExp(
    `(?:na|ng|of)\\s+(${NUMBER_WORD_PATTERN})\\s*(?:kilo|kg|kilos|kilograms?)\\b`,
    'i'
  );
  const tagalogMatch = lowerText.match(tagalogPattern);
  if (tagalogMatch) {
    const parsed = parseSpokenNumber(tagalogMatch[1]);
    if (parsed && parsed >= 0.5 && parsed <= 500) {
      console.log(`[VoiceExtractor] Tagalog article number match: "${tagalogMatch[1]}" → ${parsed}`);
      return parsed;
    }
  }
  
  // Pattern 3: Compound numbers like "forty-seven kilos" or "twenty five kg"
  const compoundPattern = new RegExp(
    `((?:${NUMBER_WORD_PATTERN})(?:[\\s\\-'t]+(?:${NUMBER_WORD_PATTERN}))?)\\s*(?:kilo|kg|kilos|kilograms?)\\b`,
    'i'
  );
  const compoundMatch = lowerText.match(compoundPattern);
  if (compoundMatch) {
    const parsed = parseSpokenNumber(compoundMatch[1]);
    if (parsed && parsed >= 0.5 && parsed <= 500) {
      console.log(`[VoiceExtractor] Compound number match: "${compoundMatch[1]}" → ${parsed}`);
      return parsed;
    }
  }
  
  return undefined;
}

// ==================== FEED EXTRACTOR ====================

/**
 * Match a feed type keyword against inventory items
 * Returns both ID and name for proper form population
 */
function matchFeedFromInventory(
  keyword: string, 
  inventory: FeedInventoryItem[]
): { id: string; name: string } | undefined {
  const keywordLower = keyword.toLowerCase();
  const match = inventory.find(item => 
    item.feed_type.toLowerCase().includes(keywordLower)
  );
  return match ? { id: match.id, name: match.feed_type } : undefined;
}

/**
 * Extract potential feed name from transcription
 * Looks for patterns like "ng [feedname] na" or "[feedname] feeds/feed"
 */
function extractFeedNameFromText(text: string): string | null {
  const patterns = [
    // "ng RumSol Feeds na" -> "RumSol Feeds"
    /(?:ng|of)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?(?:\s+feeds?)?)\s+(?:na|that|ng)/i,
    // "[Brand] Feeds" standalone
    /\b([A-Za-z]+\s+(?:feeds?|pellets?|grower|concentrate|bran))\b/i,
    // "[Something] Silage"
    /\b([A-Za-z]+\s+silage)\b/i,
    // Generic brand + product pattern: "Rumsol Feeds Cattle"
    /\b([A-Za-z]+\s+feeds?\s+[A-Za-z]+)\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Fuzzy match feed name against inventory with confidence scoring
 */
function fuzzyMatchFeedType(
  spokenFeed: string,
  inventory: FeedInventoryItem[]
): { 
  bestMatch: { id: string; name: string } | null;
  confidence: 'high' | 'low' | 'none';
  suggestions: Array<{ id: string; name: string; score: number }>;
} {
  if (!spokenFeed || inventory.length === 0) {
    return { bestMatch: null, confidence: 'none', suggestions: [] };
  }

  const inventoryNames = inventory.map(i => i.feed_type);
  const allMatches = findAllMatches(spokenFeed, inventoryNames, 0.35);
  
  if (allMatches.length === 0) {
    return { bestMatch: null, confidence: 'none', suggestions: [] };
  }
  
  const best = allMatches[0];
  const matchedInventory = inventory.find(i => i.feed_type === best.match);
  
  const suggestions = allMatches.slice(0, 3).map(m => ({
    id: inventory.find(i => i.feed_type === m.match)?.id || '',
    name: m.match,
    score: m.score
  }));
  
  if (best.score >= 0.65) {
    console.log(`[VoiceExtractor] High confidence match: "${spokenFeed}" → "${best.match}" (score: ${best.score.toFixed(2)})`);
    return {
      bestMatch: matchedInventory ? { id: matchedInventory.id, name: matchedInventory.feed_type } : null,
      confidence: 'high',
      suggestions
    };
  }
  
  console.log(`[VoiceExtractor] Low confidence match: "${spokenFeed}" → suggestions: ${suggestions.map(s => s.name).join(', ')}`);
  return {
    bestMatch: matchedInventory ? { id: matchedInventory.id, name: matchedInventory.feed_type } : null,
    confidence: 'low',
    suggestions
  };
}

/**
 * Extract feed recording data from transcription
 * 
 * Parses: kg/kilo (digits or spoken), feed types with fuzzy matching, animal selections, dates
 */
export function extractFeedData(
  transcription: string, 
  context?: ExtractorContext
): ExtractedFeedData {
  const result: ExtractedFeedData = {};
  const lowerText = transcription.toLowerCase();

  // Extract date (same logic as milk extractor)
  const extractedDate = extractDateFromText(transcription);
  if (extractedDate) {
    result.recordDate = extractedDate;
  }

  // Extract kilograms - check digit patterns first
  const kgPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilograms?|kilos)/i,
    /(\d+(?:\.\d+)?)\s*(?:na\s+)?(?:kilo|kg)/i,
    /(?:ng|of)\s*(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilograms?|kilos)/i,
  ];

  for (const pattern of kgPatterns) {
    const match = transcription.match(pattern);
    if (match) {
      result.totalKg = parseFloat(match[1]);
      break;
    }
  }

  // If no digit pattern, try spoken numbers with improved extraction
  if (!result.totalKg) {
    const spokenKg = extractSpokenKilograms(transcription);
    if (spokenKg) {
      result.totalKg = spokenKg;
    }
  }
  
  // Fallback: any standalone number in text (likely the kg amount)
  if (!result.totalKg) {
    const numberMatch = transcription.match(/\b(\d+(?:\.\d+)?)\b/);
    if (numberMatch) {
      const num = parseFloat(numberMatch[1]);
      if (num >= 0.5 && num <= 500) {
        result.totalKg = num;
      }
    }
  }

  // Extract feed type with inventory ID matching
  const feedInventory = context?.feedInventory || [];
  
  // Check for Fresh Cut first
  if (lowerText.includes('fresh') || lowerText.includes('cut and carry') || 
      lowerText.includes('fresh cut') || lowerText.includes('sariwang damo')) {
    result.feedType = 'Fresh Cut and Carry';
    result.matchConfidence = 'high';
  }
  // Check for common feed types (hardcoded keywords)
  else if (lowerText.includes('napier') || lowerText.includes('elephant grass')) {
    const matched = matchFeedFromInventory('Napier', feedInventory);
    if (matched) {
      result.feedType = matched.name;
      result.feedInventoryId = matched.id;
      result.matchConfidence = 'high';
    } else {
      result.feedType = 'Napier Grass';
    }
  }
  else if (lowerText.includes('hay') || lowerText.includes('dayami')) {
    const matched = matchFeedFromInventory('Hay', feedInventory);
    if (matched) {
      result.feedType = matched.name;
      result.feedInventoryId = matched.id;
      result.matchConfidence = 'high';
    } else {
      result.feedType = 'Hay';
    }
  }
  else if (lowerText.includes('corn') || lowerText.includes('mais') || lowerText.includes('silage')) {
    const matched = matchFeedFromInventory('Corn', feedInventory);
    if (matched) {
      result.feedType = matched.name;
      result.feedInventoryId = matched.id;
      result.matchConfidence = 'high';
    } else {
      result.feedType = 'Corn Silage';
    }
  }
  else if (lowerText.includes('rice bran') || lowerText.includes('darak')) {
    const matched = matchFeedFromInventory('Rice Bran', feedInventory);
    if (matched) {
      result.feedType = matched.name;
      result.feedInventoryId = matched.id;
      result.matchConfidence = 'high';
    } else {
      result.feedType = 'Rice Bran';
    }
  }
  // Try exact substring match against inventory
  else if (feedInventory.length > 0) {
    let exactMatch = false;
    for (const item of feedInventory) {
      const feedTypeLower = item.feed_type.toLowerCase();
      if (lowerText.includes(feedTypeLower)) {
        result.feedType = item.feed_type;
        result.feedInventoryId = item.id;
        result.matchConfidence = 'high';
        exactMatch = true;
        break;
      }
    }
    
    // No exact match - try fuzzy matching
    if (!exactMatch) {
      const spokenFeed = extractFeedNameFromText(transcription);
      if (spokenFeed) {
        result.rawSpokenFeed = spokenFeed;
        const fuzzyResult = fuzzyMatchFeedType(spokenFeed, feedInventory);
        
        if (fuzzyResult.bestMatch) {
          result.feedType = fuzzyResult.bestMatch.name;
          result.feedInventoryId = fuzzyResult.bestMatch.id;
        }
        result.matchConfidence = fuzzyResult.confidence;
        result.suggestedFeeds = fuzzyResult.suggestions;
      } else {
        // No feed name extracted - provide all inventory as suggestions
        result.matchConfidence = 'none';
        result.suggestedFeeds = feedInventory.slice(0, 5).map(f => ({
          id: f.id,
          name: f.feed_type,
          score: 0
        }));
      }
    }
  }

  // Extract animal selection
  if (lowerText.includes('goat') || lowerText.includes('kambing')) {
    result.animalSelection = 'goat';
  } else if (lowerText.includes('cattle') || lowerText.includes('baka') || lowerText.includes('cow')) {
    result.animalSelection = 'cattle';
  } else if (lowerText.includes('carabao') || lowerText.includes('kalabaw')) {
    result.animalSelection = 'carabao';
  } else if (lowerText.includes('lahat') || lowerText.includes('all')) {
    result.animalSelection = 'all';
  } else if (lowerText.includes('lactating') || lowerText.includes('milking')) {
    result.animalSelection = 'lactating';
  }

  return result;
}

// ==================== TEXT EXTRACTOR ====================

/**
 * Simple pass-through extractor for notes/text fields
 */
export function extractTextData(transcription: string): ExtractedTextData {
  return { text: transcription };
}

// ==================== MAIN EXTRACTOR FUNCTION ====================

export type ExtractedData = ExtractedMilkData | ExtractedFeedData | ExtractedTextData | Record<string, any>;

/**
 * Run the appropriate extractor based on type
 */
export function runExtractor(
  transcription: string,
  extractorType: ExtractorType,
  context?: ExtractorContext,
  customExtractor?: (transcription: string, context?: ExtractorContext) => ExtractedData
): ExtractedData {
  switch (extractorType) {
    case 'milk':
      return extractMilkData(transcription, context);
    case 'feed':
      return extractFeedData(transcription, context);
    case 'text':
      return extractTextData(transcription);
    case 'custom':
      if (customExtractor) {
        return customExtractor(transcription, context);
      }
      return extractTextData(transcription);
    default:
      return extractTextData(transcription);
  }
}
