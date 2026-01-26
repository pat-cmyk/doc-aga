/**
 * STT Shared Prompts Library
 * 
 * SSOT: Single Source of Truth for all agricultural/Filipino STT prompts
 * Used by: voice-to-text, process-farmhand-activity, process-animal-voice
 */

// ==================== AGRICULTURAL GLOSSARY ====================

export const AGRICULTURAL_GLOSSARY = `
=== AGRICULTURAL TERMS (English/Tagalog/Taglish) ===

LIVESTOCK TYPES:
- Cattle/Cow: baka, mga baka, dairy cow, guya (calf)
- Carabao/Buffalo: kalabaw, buffalo
- Goat: kambing
- Sheep: tupa

GENDER:
- Female: babae, female, cow, doe, ewe
- Male: lalaki, male, bull, buck, ram, toro

LIFE STAGES:
- Calf: guya, batang baka
- Heifer: dumalagang baka, dalaga
- Lactating: nagpapagatas, nagsususo, may gatas
- Pregnant: buntis
- Dry: tuyo, hindi nagpapagatas

ACTIVITIES:
- Feeding: pagpapakain, nag-feed
- Milking: paggatas, nag-milk, nag-gatas
- Weighing: pagtimbang, nag-weigh
- Health check: tsek sa kalusugan, nag-check
- Injection: iniksyon, bakuna, tinurukan, nag-inject
- Vaccination: bakuna, pagbakuna, nag-vaccinate
- AI (Artificial Insemination): AI, nag-AI
- Birth/Calving: panganganak, calving, nag-calve, nanganak

FEED TYPES:
- Concentrate: concentrates, pellets
- Napier Grass: napier, elephant grass
- Hay: hay, dayami (rice straw)
- Corn/Maize: mais, corn silage
- Rice Bran: darak
- Cassava: kamoteng kahoy
- Molasses: pulot

MEASUREMENTS:
- Liters: litro, L
- Kilograms: kilo, kg
- Bales: bigkis, bale, pakete
- Bags/Sacks: supot, sako, bag
- Buckets: balde
- Barrels/Drums: drum, bariles

VETERINARY TERMS:
- Mastitis, FMD (Foot and Mouth), Hemorrhagic Septicemia
- Heavy panting, labored breathing
- Swelling: namamaga
- Fever: lagnat
- Lameness: pilay
- Salivating: naglalaway

DAIRY TERMS:
- Days in Milk (DIM), Milking line
- Dry period, Close-up group
- Body Condition Score (BCS)
- Somatic Cell Count (SCC)
- CMT (California Mastitis Test)
`.trim();

// ==================== TAGLISH PATTERNS ====================

export const TAGLISH_PATTERNS = `
=== TAGLISH (Tagalog-English Code-Switching) PATTERNS ===

VERB PATTERNS (Tagalog prefix + English verb):
- nag-feed, nag-milk, nag-gatas, nag-weigh
- nag-inject, nag-check, nag-confirm
- nag-calve, nanganak, nag-dry off
- nag-heat, nag-init, nag-AI
- naka-schedule, na-check, na-confirm

MARKER WORDS:
- "yung" / "ang" = the
- "ng" = of/the (linker)
- "naman", "po", "daw", "kasi", "eh", "ba", "na", "pa", "lang"
- "opo" = yes (polite)

EXAMPLE PHRASES:
- "Nag-feed ako ng 10 bales" = I fed 10 bales
- "Nag-milk ako this morning" = I milked this morning
- "Yung guya ay medyo underweight" = The calf is a bit underweight
- "Meron tayong cow record" = We have a cow record
- "Parang may lagnat yung baka" = The cow seems to have fever

QUESTION PATTERNS:
- "Ano ba ang..." = What is...
- "Okay lang ba..." = Is it okay if...
- "Kelan ba ang..." = When is...
- "Magkano na..." = How much is...
- "Bakit kaya..." = Why is it that...
- "Pwede ba..." = Can I/we...

POLITE FORMS:
- "po", "opo" = respect markers
- "Gusto ko po..." = I would like... (polite)
- "Patulong po..." = Please help... (polite)
`.trim();

// ==================== NUMBER DISAMBIGUATION ====================

export const NUMBER_DISAMBIGUATION_RULES = `
=== CRITICAL: NUMBER TRANSCRIPTION (VERY IMPORTANT!) ===

Numbers are CRITICAL for farm records. Listen EXTREMELY carefully:

CONFUSING NUMBER PAIRS - Listen for exact syllables:
- "thirty-eight" (38) = TREY-tee-AYT → 2 syllables in "thirty", ends with "eight"
- "three fifty" (350) = THREE-FIF-tee → starts with single "three", then "fifty"
- "three hundred fifty" (350) = clearly has "hundred" in it

MORE CONFUSING PAIRS:
- "twenty-three" (23) vs "twenty-six" (26) - listen for "-three" vs "-six" ending
- "fifteen" (15) vs "fifty" (50) - "FIF-teen" vs "FIF-tee" (teen vs tee)
- "thirteen" (13) vs "thirty" (30) - "thir-TEEN" vs "THIR-tee"
- "eighteen" (18) vs "eighty" (80) - "eigh-TEEN" vs "EIGH-tee"

TAGALOG NUMBERS:
- "isa"=1, "dalawa"=2, "tatlo"=3, "apat"=4, "lima"=5
- "anim"=6, "pito"=7, "walo"=8, "siyam"=9, "sampu"=10
- "labinisa"=11, "labindalawa"=12, "labintatlo"=13
- "dalawampu"=20, "tatlumpu"=30, "apatnapu"=40, "limampu"=50
- CONVERT Tagalog numbers to digits for database storage!

REALISTIC VALUE CONTEXT (use to resolve ambiguity):
- Single animal milk per session: 5-30 liters (NEVER 350!)
- Small farm total milk: 20-100 liters typical
- Large farm total milk: 100-300 liters max
- If you hear something like "350 liters from one cow" → it's almost certainly "35" or "38"
- Animal weight: 50-800 kg typical for cattle/carabao
- Feed per animal per day: 5-30 kg typical

=== CRITICAL: DATE TRANSCRIPTION ===

CONFUSING DATE PAIRS:
- "twenty-third" (23rd) vs "twenty-sixth" (26th) - listen for "-third" vs "-sixth"
- "thirteenth" (13th) vs "thirtieth" (30th)
- "January" vs "June" vs "July" - different starting sounds

DATE FORMATS TO PRESERVE:
- Absolute: "January 23, 2026", "23 January 2026", "01/23/2026"
- Relative: "kahapon" (yesterday), "kanina" (earlier today), "noong [day]" (last [day])
- Time: "sa umaga"=morning, "sa hapon"=afternoon, "sa gabi"=evening

TAGALOG TIME REFERENCES:
- "ngayon" = now/today
- "kahapon" = yesterday
- "kamakalawa" = day before yesterday
- "bukas" = tomorrow (FUTURE - may need rejection!)
`.trim();

// ==================== TRANSCRIPTION SYSTEM PROMPT ====================

export const TRANSCRIPTION_SYSTEM_PROMPT = `
You are an expert audio transcription assistant specialized in Filipino agricultural and veterinary contexts. Your task is to accurately transcribe audio from Filipino farmers who frequently use Taglish (Tagalog-English code-switching).

=== TRANSCRIPTION GUIDELINES ===
1. Transcribe EXACTLY what is spoken - preserve Taglish naturally
2. Use correct spelling for technical terms (veterinary, dairy, farming)
3. Numbers should be transcribed as digits (e.g., "10 liters" not "ten liters")
4. Preserve Filipino particles like "po", "opo", "naman", "kasi", "yung"
5. Keep English words that are naturally mixed in (common in Filipino farm speech)

${NUMBER_DISAMBIGUATION_RULES}

${AGRICULTURAL_GLOSSARY}

${TAGLISH_PATTERNS}

Output ONLY the transcription text, nothing else.
`.trim();

// ==================== EXTRACTION SYSTEM PROMPTS ====================

export const ANIMAL_EXTRACTION_PROMPT = `
You are an AI assistant helping Filipino farmers register new animals on their farm using voice input.

TASK: Extract structured animal registration data from the transcription. Return ONLY valid JSON.

${AGRICULTURAL_GLOSSARY}

${TAGLISH_PATTERNS}

EXTRACTION RULES:
1. Extract ONLY what is explicitly mentioned in the transcription
2. Set null for fields not mentioned
3. ear_tag: Look for patterns like "A005", "ear tag A005", "tag A005", "tatak A005", "numero A005"
4. weight: Convert all weights to kg. If pounds mentioned, multiply by 0.453592
5. is_lactating: true if mentions "milking", "lactating", "nagpapagatas", "nagsususo", "may gatas"
6. For confidence: "high" if 3+ clear fields extracted, "medium" if 2 fields, "low" if only 1 field
7. name: Only extract if explicitly mentioned as animal name (e.g., "named Bessie", "pangalan Mura")

OUTPUT FORMAT (JSON only, no markdown):
{
  "livestock_type": "cattle" | "goat" | "sheep" | "carabao" | null,
  "gender": "Male" | "Female" | null,
  "ear_tag": string | null,
  "name": string | null,
  "is_lactating": boolean,
  "entry_weight_kg": number | null,
  "acquisition_type": "purchased" | "grant" | null,
  "breed": string | null,
  "confidence": "high" | "medium" | "low"
}
`.trim();

// ==================== ACTIVITY EXTRACTION PROMPT ====================

export function getActivityExtractionPrompt(animalInfo?: { name?: string; ear_tag?: string }, animalId?: string): string {
  const animalContext = animalInfo 
    ? `The farmhand is recording an activity for animal: ${animalInfo.name || 'Unknown'} (Ear Tag: ${animalInfo.ear_tag || 'N/A'}, ID: ${animalId}).
       IMPORTANT: The animal is already identified. DO NOT need to extract animal_identifier unless a DIFFERENT animal is mentioned.`
    : animalId
    ? `The farmhand is recording an activity for a SPECIFIC ANIMAL (ID: ${animalId}). The animal is already identified.`
    : 'Extract animal identifier if mentioned (ear tag, name, or description).';

  return `
You are an assistant helping farmhands log their daily activities. Extract structured information from voice transcriptions.

${animalContext}

${AGRICULTURAL_GLOSSARY}

${TAGLISH_PATTERNS}

${NUMBER_DISAMBIGUATION_RULES}

**ACTIVITY TYPES**:
- feeding: Recording feed given to animals (requires quantity, feed_type, unit)
- milking: Recording milk production (requires quantity in liters)
- health_observation: General health checks (requires notes)
- weight_measurement: Recording animal weight (requires quantity in kg)
- injection: Medicine or vaccine administration (requires medicine_name)
- cleaning: General cleaning tasks

**FEEDING LOGIC**:
- Extract: quantity (count), unit (bales/bags/barrels/kg), feed_type (what the feed is)
- DO NOT multiply by weight - system will look up from inventory
- If only unit mentioned without type, set feed_type to "unknown"

**MILKING LOGIC**:
- Extract livestock_type if mentioned: 'cattle', 'goat', 'carabao', 'sheep'
- Extract quantity in liters
- Detect session: AM (morning/umaga) or PM (afternoon/gabi/hapon)

**OUTPUT FORMAT** (JSON only):
{
  "activity_type": "feeding" | "milking" | "health_observation" | "weight_measurement" | "injection",
  "quantity": number | null,
  "unit": "bales" | "bags" | "barrels" | "kg" | "liters" | null,
  "feed_type": string | null,
  "livestock_type": "cattle" | "goat" | "carabao" | "sheep" | null,
  "animal_identifier": string | null,
  "date_reference": string | null,
  "notes": string | null,
  "medicine_name": string | null,
  "dosage": string | null,
  "session": "AM" | "PM" | null
}
`.trim();
}

// ==================== REGISTRATION CONTEXT DETECTION ====================

// Keywords that indicate animal registration context
export const REGISTRATION_KEYWORDS = [
  // English
  'new', 'add', 'register', 'bought', 'purchased', 'grant', 'donated',
  'ear tag', 'tag number', 'entry weight', 'birth weight',
  // Tagalog/Taglish
  'bago', 'bagong', 'binili', 'bigay', 'donasyon', 'tatak', 'numero',
  'timbang pagpasok', 'peso', 'acquisition'
];

// Keywords that indicate this is NOT animal registration
export const NON_REGISTRATION_KEYWORDS = [
  // Milk recording
  'milk', 'liters', 'litro', 'gatas', 'nag-milk', 'yield', 'production',
  'morning session', 'evening session', 'AM', 'PM',
  // Health updates
  'sick', 'sakit', 'injection', 'vaccine', 'treatment', 'mastitis',
  'namamaga', 'lagnat', 'fever', 'diagnosis',
  // General updates
  'update', 'report', 'total', 'kabuuan', 'herd', 'all animals',
  // Feeding
  'feed', 'feeding', 'bales', 'bags', 'concentrates'
];

/**
 * Check if transcription is likely about animal registration
 */
export function isLikelyAnimalRegistration(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  const hasRegistrationKeyword = REGISTRATION_KEYWORDS.some(kw => 
    lowerText.includes(kw.toLowerCase())
  );
  
  const hasNonRegistrationKeyword = NON_REGISTRATION_KEYWORDS.some(kw => 
    lowerText.includes(kw.toLowerCase())
  );
  
  // If it has non-registration keywords and no registration keywords, it's probably not registration
  if (hasNonRegistrationKeyword && !hasRegistrationKeyword) {
    return false;
  }
  
  return true;
}

// ==================== KEYTERM GENERATION ====================

/**
 * Generate keyterms for improved transcription accuracy
 * Pass farm-specific terms to STT for better recognition
 */
export function generateKeyterms(context: {
  animalNames?: string[];
  earTags?: string[];
  feedTypes?: string[];
  customTerms?: string[];
}): string[] {
  const keyterms: string[] = [];
  
  // Add animal names
  if (context.animalNames) {
    keyterms.push(...context.animalNames.filter(Boolean));
  }
  
  // Add ear tags
  if (context.earTags) {
    keyterms.push(...context.earTags.filter(Boolean));
  }
  
  // Add feed types
  if (context.feedTypes) {
    keyterms.push(...context.feedTypes.filter(Boolean));
  }
  
  // Add custom terms
  if (context.customTerms) {
    keyterms.push(...context.customTerms.filter(Boolean));
  }
  
  // Add common agricultural terms
  keyterms.push(
    'litro', 'liters', 'kilo', 'kilograms',
    'bales', 'bags', 'sako', 'bigkis',
    'napier', 'concentrates', 'hay', 'dayami',
    'AM', 'PM', 'umaga', 'gabi', 'hapon'
  );
  
  return [...new Set(keyterms)]; // Remove duplicates
}
