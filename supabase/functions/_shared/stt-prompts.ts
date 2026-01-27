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

// ==================== TAGALOG DISCOURSE MARKERS ====================

export const TAGALOG_DISCOURSE_MARKERS = `
=== TAGALOG DISCOURSE MARKERS & PARTICLES ===

CRITICAL: These particles affect meaning and should be PRESERVED in transcription
but may be STRIPPED during extraction depending on context.

=== EPISTEMIC/EVIDENTIAL MARKERS (Knowledge & Certainty) ===
- "pala" = realization/correction ("so it turns out", "I just realized")
  Example: "Ay pala, kahapon yung feeding" → "Oh wait, the feeding was yesterday"
  EXTRACTION IMPACT: May indicate a CORRECTION to previous statement

- "talaga" = emphasis/certainty ("really", "truly", "definitely")
  Example: "Talaga bang 50 liters?" → "Is it really 50 liters?"
  EXTRACTION IMPACT: Strengthens confidence in the number

- "daw/raw" = hearsay/reported speech ("they said", "apparently")
  Example: "30 kilos daw ang feed" → "They said the feed is 30 kilos"
  EXTRACTION IMPACT: May indicate secondhand information

- "yata" = uncertainty ("I think", "probably", "maybe")
  Example: "20 liters yata" → "I think it's 20 liters"
  EXTRACTION IMPACT: Lower confidence in extracted value

=== TEMPORAL MARKERS (Time & Sequence) ===
- "muna" = priority/first ("first", "for now")
  Example: "I-record muna ang milk" → "Record the milk first"
  EXTRACTION IMPACT: Indicates task prioritization

- "na" = already/now (completion or urging)
  Example: "Nag-feed na" → "Already fed" / "Fed now"
  EXTRACTION IMPACT: Confirms action is COMPLETED

- "pa" = still/yet (ongoing or addition)
  Example: "Nag-milk pa" → "Still milking" / "Milked more"
  EXTRACTION IMPACT: May indicate ADDITIONAL quantity

- "ulit" = again/repeat
  Example: "Pakibasa ulit" → "Please read again"
  EXTRACTION IMPACT: User wants repetition

- "agad" = immediately/right away
  Example: "Nag-inject agad" → "Injected immediately"
  EXTRACTION IMPACT: Indicates urgency

=== ADDITIVE/CONTRASTIVE MARKERS ===
- "din/rin" = also/too
  Example: "Yung kambing din" → "The goat too"
  EXTRACTION IMPACT: Indicates ADDITIONAL animals/items

- "lang" = only/just (limiter)
  Example: "10 liters lang" → "Only 10 liters"
  EXTRACTION IMPACT: Confirms exact amount, no more

- "naman" = on the other hand / for one's part / also
  Example: "Okay naman ang baka" → "The cow is fine though"
  EXTRACTION IMPACT: Often filler, may indicate contrast

- "kaya" = perhaps/that's why/can
  Example: "Kaya mababa ang milk" → "That's why the milk is low"
  EXTRACTION IMPACT: Indicates reasoning/cause

=== POLITENESS & RESPECT MARKERS ===
- "po/opo" = polite/respect markers
  Example: "30 liters po" → "30 liters (respectful)"
  EXTRACTION IMPACT: STRIP during extraction, doesn't affect data

- "ho" = informal polite marker
  Example: "Opo ho" → "Yes (polite)"
  EXTRACTION IMPACT: STRIP during extraction

=== QUESTION & FILLER PARTICLES ===
- "ba" = question marker
  Example: "Okay ba ang record?" → "Is the record okay?"
  EXTRACTION IMPACT: Indicates question, not statement

- "eh" = filler/hesitation
  Example: "Eh, mga 20 kilos" → "Uh, about 20 kilos"
  EXTRACTION IMPACT: STRIP during extraction

- "kasi" = because/you see
  Example: "Kasi maulan" → "Because it's rainy"
  EXTRACTION IMPACT: Indicates reason/explanation

=== APPROXIMATION MARKERS ===
- "mga" = approximately ("around", "about")
  Example: "Mga 40 liters" → "Around 40 liters"
  EXTRACTION IMPACT: Value is APPROXIMATE, not exact

- "halos" = almost/nearly
  Example: "Halos 50 liters" → "Almost 50 liters"
  EXTRACTION IMPACT: Value is slightly LESS than stated

- "mahigit" = more than/over
  Example: "Mahigit 30 kilos" → "Over 30 kilos"
  EXTRACTION IMPACT: Value is AT LEAST the stated amount
`.trim();

// ==================== TAGLISH PATTERNS ====================

export const TAGLISH_PATTERNS = `
=== TAGLISH (Tagalog-English Code-Switching) PATTERNS ===

VERB PATTERNS (Tagalog prefix + English verb):
- nag-feed, nag-milk, nag-gatas, nag-weigh
- nag-inject, nag-check, nag-confirm, nag-record
- nag-calve, nanganak, nag-dry off
- nag-heat, nag-init, nag-AI
- naka-schedule, na-check, na-confirm, na-record
- mag-save, mag-submit, mag-cancel

MARKER WORD COMBINATIONS (often appear together):
- "na po" = already (polite)
- "pa po" = still/more (polite)
- "din po" = also (polite)
- "lang po" = only (polite)
- "daw po" = they said (polite hearsay)

COMMON SENTENCE STARTERS:
- "Nag-[verb] ako..." = I [verb]ed...
- "Yung [noun]..." = The [noun]...
- "Meron [noun]..." = There is [noun]...
- "Gusto ko [verb]..." = I want to [verb]...
- "Pwede ba..." = Can I/we...
- "Paano ba..." = How do I...

CONFIRMATION PATTERNS:
- "Oo" / "Opo" / "Oo nga" = Yes
- "Hindi" / "Hindi po" = No
- "Sige" / "Sige po" = Okay/Go ahead
- "Tama" / "Tama po" = Correct
- "Mali" = Wrong/Incorrect

MARKER WORDS (single particles):
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
- "po", "opo" = respect markers (STRIP during extraction)
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
You are an audio transcription assistant. Your ONLY task is to transcribe the exact words spoken in the audio.

=== CRITICAL RULES - READ CAREFULLY ===
1. Transcribe ONLY the actual spoken words - NEVER invent or add content
2. If audio is unclear, silent, or too short, respond with EXACTLY: [UNCLEAR_AUDIO]
3. If you cannot understand a specific word, use [INAUDIBLE] as a placeholder
4. NEVER generate plausible-sounding content to fill gaps - this is STRICTLY FORBIDDEN
5. Accuracy is more important than completeness - gaps are better than fabrications
6. DO NOT assume what the speaker "probably meant" - transcribe only what you hear

=== OUTPUT FORMAT ===
- Clear audio: Output transcription text only
- Partially unclear: Include [INAUDIBLE] markers where words are unclear
- Completely unclear/silent: Respond with only: [UNCLEAR_AUDIO]

=== FORMATTING RULES ===
1. Numbers: Use digits (23, not twenty-three)
2. Preserve Filipino particles: po, opo, naman, kasi, yung
3. Keep Taglish code-switching natural (mixing Filipino and English)

=== CONTEXT FOR SPELLING ONLY (NOT for content generation) ===
The speaker may use terms like:
- Measurements: litro/liters, kilo/kg, bales, bags
- Time: umaga=morning, hapon=afternoon, gabi=evening
- Dates: January, kahapon=yesterday, ngayon=today

IMPORTANT: Use this context ONLY for proper spelling. 
DO NOT use it to invent content that was not spoken.

${NUMBER_DISAMBIGUATION_RULES}

Output ONLY what you hear. Nothing more.
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

// ==================== BISAYA/CEBUANO SUPPORT ====================

export const BISAYA_CEBUANO_TERMS = `
=== BISAYA/CEBUANO SUPPORT ===

CRITICAL: Recognize Bisaya/Cebuano terms commonly used in Visayas farms:

TIME REFERENCES:
- "gabie" = yesterday (NOT "yesterday evening")
- "karon" = now/today
- "ugma" = tomorrow (FUTURE - reject for activity recording!)
- "kagahapon" = yesterday
- "sunod adlaw" = next day (FUTURE)

ACTIVITIES:
- "papakaon" / "pagpakaon" = feeding
- "pagatas" / "pag-gatas" = milking
- "pagtimbang" = weighing
- "pagbakuna" = vaccination
- "pagturuk" = injection

ANIMALS:
- "baka" = cow/cattle
- "kanding" = goat
- "karnero" = sheep
- "kalabaw" = carabao

QUANTITIES:
- "usa" = 1, "duha" = 2, "tulo" = 3, "upat" = 4, "lima" = 5
- "unom" = 6, "pito" = 7, "walo" = 8, "siyam" = 9, "napulo" = 10
`.trim();

// ==================== LIVESTOCK TYPE DETECTION ====================

export const LIVESTOCK_TYPE_DETECTION = `
=== LIVESTOCK TYPE DETECTION FOR MILKING ===

Detect livestock type from milk-related keywords in the transcription:

CATTLE:
- "cow milk" / "gatas ng baka" / "baka" / "cattle" → livestock_type: 'cattle'

GOAT:
- "goat milk" / "gatas ng kambing" / "kambing" / "kanding" → livestock_type: 'goat'

CARABAO:
- "carabao milk" / "gatas ng kalabaw" / "kalabaw" → livestock_type: 'carabao'

SHEEP:
- "sheep milk" / "gatas ng tupa" / "tupa" / "karnero" → livestock_type: 'sheep'

DEFAULT:
- No type mentioned → livestock_type: null (system will show all types for selection)

Examples:
- "Nag-gatas ako ng 20 liters ng goat milk" → livestock_type: 'goat'
- "I milked 20 liters" → livestock_type: null
- "Nakakuha ng 15 liters gatas ng baka" → livestock_type: 'cattle'
- "Gatas ng kambing, mga 10 liters" → livestock_type: 'goat'
`.trim();

// ==================== FEED TYPE VS UNIT RULES ====================

export const FEED_TYPE_UNIT_RULES = `
=== CRITICAL - Feed Type vs Unit Distinction ===

For feeding activities, you MUST correctly distinguish between feed_type and unit:

FEED_TYPE = WHAT the feed is (the actual material/product name):
- Examples: "corn silage", "hay", "concentrates", "alfalfa", "barley", "grain"
- Common variations: "baled corn silage", "chopped hay", "dairy concentrates"
- Filipino: "dayami"=rice straw, "mais"=corn, "darak"=rice bran, "pulot"=molasses
- If user explicitly mentions feed type, extract it exactly
- If user only mentions unit WITHOUT specifying content, set feed_type to null

UNIT = HOW it's packaged/measured:
- Examples: "bales", "bags", "barrels", "buckets", "kg", "drums"
- Filipino: "supot"/"sako"=bag, "bigkis"/"pakete"=bale, "balde"=bucket, "drum"/"bariles"=barrel
- This describes the container or measurement, NOT the feed itself

EXTRACTION RULES:
1. "5 bales" alone → feed_type: null, unit: "bales", quantity: 5
2. "5 bales of corn silage" → feed_type: "corn silage", unit: "bales", quantity: 5
3. "2 bags of concentrates" → feed_type: "concentrates", unit: "bags", quantity: 2
4. "8 bales of baled corn silage" → feed_type: "baled corn silage", unit: "bales", quantity: 8
5. "3 bags" alone → feed_type: null, unit: "bags", quantity: 3
6. "Lima sako ng darak" → feed_type: "rice bran", unit: "bags", quantity: 5
7. "10 bigkis ng mais" → feed_type: "corn", unit: "bales", quantity: 10

**CRITICAL**: System will check inventory to resolve null feed types automatically.
**NEVER use the unit name as the feed_type!**
**NEVER assume or default feed types - extract only what user explicitly says!**
**NEVER use "unknown" string - use null instead!**
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

${TAGALOG_DISCOURSE_MARKERS}

${TAGLISH_PATTERNS}

${NUMBER_DISAMBIGUATION_RULES}

${BISAYA_CEBUANO_TERMS}

${LIVESTOCK_TYPE_DETECTION}

${FEED_TYPE_UNIT_RULES}

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
- If only unit mentioned without type, set feed_type to null (NOT "unknown")

**MILKING LOGIC**:
- Extract livestock_type if mentioned: 'cattle', 'goat', 'carabao', 'sheep'
- Extract quantity in liters
- Detect session: AM (morning/umaga) or PM (afternoon/gabi/hapon)

**ANIMAL IDENTIFICATION**:
- If farmhand mentions SPECIFIC animals (ear tag, name), extract animal_identifier
- If says "lahat"/"all"/"everyone"/"herd", NO animal_identifier (proportional distribution)
- DO NOT extract "cat" (likely mishearing "cattle")

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
