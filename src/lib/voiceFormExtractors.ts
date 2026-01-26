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
  animalSelection?: string;
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

export type ExtractorType = 'milk' | 'feed' | 'text' | 'custom';

export type ExtractorContext = {
  feedInventory?: FeedInventoryItem[];
  [key: string]: any;
};

// ==================== MILK EXTRACTOR ====================

/**
 * Extract milk recording data from transcription
 * 
 * Parses: liters/litro, morning/umaga, evening/gabi
 */
export function extractMilkData(transcription: string): ExtractedMilkData {
  const result: ExtractedMilkData = {};
  const lowerText = transcription.toLowerCase();

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

  // Extract session (AM/PM)
  const morningKeywords = ['morning', 'umaga', 'am', 'a.m.', 'breakfast', 'early'];
  const eveningKeywords = ['evening', 'gabi', 'hapon', 'pm', 'p.m.', 'afternoon', 'night'];

  if (morningKeywords.some(kw => lowerText.includes(kw))) {
    result.session = 'AM';
  } else if (eveningKeywords.some(kw => lowerText.includes(kw))) {
    result.session = 'PM';
  }

  // Extract animal selection hints
  const allKeywords = ['lahat', 'all', 'everyone', 'everybody', 'all lactating'];
  if (allKeywords.some(kw => lowerText.includes(kw))) {
    result.animalSelection = 'all-lactating';
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
      return extractMilkData(transcription);
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
