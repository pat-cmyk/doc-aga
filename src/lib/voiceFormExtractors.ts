/**
 * Voice Form Extractors
 * 
 * Configurable extraction functions for parsing transcriptions
 * into structured form data for different use cases.
 */

// ==================== TYPES ====================

export interface ExtractedMilkData {
  totalLiters?: number;
  session?: 'AM' | 'PM';
  animalSelection?: string; // 'all-lactating' | 'individual:<id>' | 'species:<type>'
  matchedAnimalName?: string; // For toast feedback
  recordDate?: Date; // Extracted date from voice input
  rawTranscription?: string; // For debugging/display
}

export interface ExtractedFeedData {
  totalKg?: number;
  feedType?: string;
  animalSelection?: string;
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

  // Validate extracted liters - warn about unrealistic values
  if (result.totalLiters) {
    // For individual animals, 1-50L is realistic; for farm totals, 10-300L
    if (result.totalLiters > 200) {
      console.warn(`[VoiceExtractor] Unusually high milk volume: ${result.totalLiters}L - possible transcription error (heard "${transcription.substring(0, 50)}...")`);
    }
  }

  // Extract session (AM/PM)
  const morningKeywords = ['morning', 'umaga', 'am', 'a.m.', 'breakfast', 'early'];
  const eveningKeywords = ['evening', 'gabi', 'hapon', 'pm', 'p.m.', 'afternoon', 'night'];

  if (morningKeywords.some(kw => lowerText.includes(kw))) {
    result.session = 'AM';
  } else if (eveningKeywords.some(kw => lowerText.includes(kw))) {
    result.session = 'PM';
  }

  // Try to match individual animal by name or ear tag
  const animals = context?.animals || [];
  
  for (const animal of animals) {
    // Match by name (e.g., "Bessie", "Brownie")
    if (animal.name) {
      const nameLower = animal.name.toLowerCase();
      if (lowerText.includes(nameLower)) {
        result.animalSelection = `individual:${animal.id}`;
        result.matchedAnimalName = animal.name;
        break;
      }
    }
    
    // Match by ear tag (e.g., "G001", "C-42")
    if (animal.ear_tag) {
      // Handle different ear tag formats: "G001", "G-001", "G 001"
      const tagLower = animal.ear_tag.toLowerCase();
      const tagNormalized = tagLower.replace(/[-\s]/g, '');
      const textNormalized = lowerText.replace(/[-\s]/g, '');
      
      if (textNormalized.includes(tagNormalized)) {
        result.animalSelection = `individual:${animal.id}`;
        result.matchedAnimalName = animal.name || animal.ear_tag;
        break;
      }
    }
  }

  // Check for explicit "all" keywords only if no individual animal was matched
  if (!result.animalSelection) {
    const allKeywords = ['lahat', 'all', 'everyone', 'everybody', 'all lactating'];
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
