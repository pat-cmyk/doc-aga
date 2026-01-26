/**
 * Voice Form Extractors
 * 
 * Configurable extraction functions for parsing transcriptions
 * into structured form data for different use cases.
 * 
 * SSOT: This is the single source of truth for all voice data extraction logic.
 */

import { findBestMatch, normalizeEarTag } from './fuzzyMatch';

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
  animalSelection?: string;
  warnings?: string[];
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

// ==================== FEED EXTRACTOR ====================

/**
 * Extract feed recording data from transcription
 * 
 * Parses: kg/kilo, feed types, animal selections
 */
export function extractFeedData(
  transcription: string, 
  context?: ExtractorContext
): ExtractedFeedData {
  const result: ExtractedFeedData = {};
  const lowerText = transcription.toLowerCase();

  // Extract kilograms
  const kgPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilograms?|kilos)/i,
    /(\d+(?:\.\d+)?)\s*(?:na\s+)?(?:kilo|kg)/i,
  ];

  for (const pattern of kgPatterns) {
    const match = transcription.match(pattern);
    if (match) {
      result.totalKg = parseFloat(match[1]);
      break;
    }
  }

  // If no kg pattern matched, look for standalone numbers
  if (!result.totalKg) {
    const numberMatch = transcription.match(/\b(\d+(?:\.\d+)?)\b/);
    if (numberMatch) {
      const num = parseFloat(numberMatch[1]);
      // Reasonable kg amount (0.5 - 500)
      if (num >= 0.5 && num <= 500) {
        result.totalKg = num;
      }
    }
  }

  // Extract feed type
  const feedInventory = context?.feedInventory || [];
  
  // Check for Fresh Cut first
  if (lowerText.includes('fresh') || lowerText.includes('cut and carry') || 
      lowerText.includes('fresh cut') || lowerText.includes('sariwang damo')) {
    result.feedType = 'Fresh Cut and Carry';
  }
  // Check for common feed types
  else if (lowerText.includes('napier') || lowerText.includes('elephant grass')) {
    result.feedType = matchFeedFromInventory('Napier', feedInventory) || 'Napier Grass';
  }
  else if (lowerText.includes('hay') || lowerText.includes('dayami')) {
    result.feedType = matchFeedFromInventory('Hay', feedInventory) || 'Hay';
  }
  else if (lowerText.includes('concentrate') || lowerText.includes('feeds') || lowerText.includes('pellet')) {
    result.feedType = matchFeedFromInventory('Concentrate', feedInventory) || 'Concentrate Feed';
  }
  else if (lowerText.includes('corn') || lowerText.includes('mais')) {
    result.feedType = matchFeedFromInventory('Corn', feedInventory) || 'Corn Silage';
  }
  else if (lowerText.includes('rice bran') || lowerText.includes('darak')) {
    result.feedType = matchFeedFromInventory('Rice Bran', feedInventory) || 'Rice Bran';
  }
  // Try to match against inventory
  else if (feedInventory.length > 0) {
    for (const item of feedInventory) {
      const feedTypeLower = item.feed_type.toLowerCase();
      if (lowerText.includes(feedTypeLower)) {
        result.feedType = item.feed_type;
        break;
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

/**
 * Match a feed type keyword against inventory items
 */
function matchFeedFromInventory(keyword: string, inventory: FeedInventoryItem[]): string | undefined {
  const keywordLower = keyword.toLowerCase();
  const match = inventory.find(item => 
    item.feed_type.toLowerCase().includes(keywordLower)
  );
  return match?.feed_type;
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
