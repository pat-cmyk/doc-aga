import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

console.log('[process-farmhand-activity] v2025-10-20-INV-ALL');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default weights for units when inventory lookup fails
const DEFAULT_WEIGHTS = {
  bales: 42,  // kg per bale (hay, silage)
  bags: 50,   // kg per bag (concentrates)
  barrels: 200, // kg per barrel/drum
};

// Rate limiting configuration
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60000; // 60 seconds

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  identifier: string, 
  maxRequests: number, 
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  // Clean up old entries periodically (prevent memory leak)
  if (rateLimitMap.size > 10000) {
    const cutoff = now - windowMs;
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.resetAt < cutoff) rateLimitMap.delete(key);
    }
  }
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  
  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  return { allowed: true };
}

// Validation schemas for data integrity
const milkingRecordSchema = z.object({
  quantity: z.number()
    .min(0.1, 'Milk quantity must be at least 0.1 liters')
    .max(100, 'Milk quantity cannot exceed 100 liters per session')
    .finite(),
  animal_identifier: z.string().optional(),
  notes: z.string().max(500, 'Notes must be under 500 characters').optional()
});

const feedingRecordSchema = z.object({
  feed_type: z.string()
    .min(2, 'Feed type must be at least 2 characters')
    .max(100, 'Feed type must be under 100 characters')
    .refine(val => val !== 'unknown', 'Feed type must be specified'),
  quantity: z.number()
    .min(0.1, 'Quantity must be at least 0.1')
    .max(10000, 'Quantity cannot exceed 10,000')
    .finite(),
  unit: z.enum(['bales', 'bags', 'barrels', 'kg', 'liters'])
    .optional(),
  notes: z.string().max(500, 'Notes must be under 500 characters').optional()
});

const healthRecordSchema = z.object({
  notes: z.string()
    .min(5, 'Health observation must be at least 5 characters')
    .max(500, 'Notes must be under 500 characters'),
  animal_identifier: z.string().optional()
});

const weightRecordSchema = z.object({
  quantity: z.number()
    .min(10, 'Weight must be at least 10 kg')
    .max(2000, 'Weight cannot exceed 2000 kg')
    .finite(),
  animal_identifier: z.string().optional(),
  notes: z.string().max(500, 'Notes must be under 500 characters').optional()
});

const injectionRecordSchema = z.object({
  medicine_name: z.string()
    .min(2, 'Medicine name must be at least 2 characters')
    .max(100, 'Medicine name must be under 100 characters'),
  dosage: z.string()
    .max(50, 'Dosage must be under 50 characters')
    .optional(),
  animal_identifier: z.string().optional(),
  notes: z.string().max(500, 'Notes must be under 500 characters').optional()
});

// Validate extracted activity data
function validateActivityData(activity: any): { valid: boolean; error?: string } {
  try {
    switch (activity.activity_type) {
      case 'milking':
        milkingRecordSchema.parse(activity);
        break;
      case 'feeding':
        feedingRecordSchema.parse(activity);
        break;
      case 'health_observation':
        healthRecordSchema.parse(activity);
        break;
      case 'weight_measurement':
        weightRecordSchema.parse(activity);
        break;
      case 'injection':
        injectionRecordSchema.parse(activity);
        break;
    }
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map(e => e.message).join('; ');
      return { 
        valid: false, 
        error: `Invalid data: ${issues} / Hindi valid ang data: ${issues}` 
      };
    }
    return { valid: false, error: 'Validation failed / Nabigo ang validation' };
  }
}

// Parse and validate date with Filipino language support
function parseAndValidateDate(dateReference: string | undefined): { 
  date: string, 
  datetime: string, 
  isValid: boolean, 
  error?: string 
} {
  const now = new Date();
  let targetDate = new Date();
  
  if (!dateReference) {
    return {
      date: now.toISOString().split('T')[0],
      datetime: now.toISOString(),
      isValid: true
    };
  }
  
  const ref = dateReference.toLowerCase();
  
  // Enhanced future detection (Filipino + English)
  const futureKeywords = [
    'tomorrow', 'later', 'next week', 'next month', 'will', 'going to',
    'in 2 days', 'in 3 days', 'in a week',
    'bukas', 'mamaya', 'sa susunod', 'mamayang gabi', 'bukas ng umaga',
    'ugma', 'sa sunod'
  ];
  
  if (futureKeywords.some(keyword => ref.includes(keyword))) {
    return {
      date: '',
      datetime: '',
      isValid: false,
      error: 'Hindi pwedeng mag-record ng activities sa hinaharap. Mag-record lang ng mga activities na tapos na o nangyayari ngayon. / Cannot record activities for future dates. Please only record activities that have already happened or are happening now.'
    };
  }
  
  // Enhanced retroactive date parsing (Filipino + English)
  if (ref.includes('yesterday') || ref.includes('kahapon') || ref.includes('gabie')) {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (ref.includes('kamakalawa') || ref.includes('2 days ago')) {
    targetDate.setDate(targetDate.getDate() - 2);
  } else if (ref.includes('3 days ago')) {
    targetDate.setDate(targetDate.getDate() - 3);
  } else if (ref.includes('noong isang araw') || ref.includes('the other day')) {
    targetDate.setDate(targetDate.getDate() - 2);
  } else if (ref.includes('last monday') || ref.includes('noong lunes')) {
    const daysSinceMonday = (targetDate.getDay() + 6) % 7;
    targetDate.setDate(targetDate.getDate() - daysSinceMonday);
  }
  
  // Validate not too old (30 days limit)
  const daysDiff = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 30) {
    return {
      date: '',
      datetime: '',
      isValid: false,
      error: 'Hindi pwedeng mag-record ng activities na mas luma sa 30 days. Makipag-ugnayan sa farm manager para sa lumang records. / Cannot record activities older than 30 days. Please contact your farm manager for historical records.'
    };
  }
  
  return {
    date: targetDate.toISOString().split('T')[0],
    datetime: targetDate.toISOString(),
    isValid: true
  };
}

// FIFO: Get latest weight per unit from inventory (oldest stock first)
async function getLatestWeightPerUnit(
  supabase: any,
  farmId: string,
  feedType: string,
  unit: string
): Promise<number | null> {
  console.log(`Looking up weight per unit for: ${feedType}, unit: ${unit}`);
  
  const { data, error } = await supabase
    .from('feed_inventory')
    .select('weight_per_unit, quantity_kg, created_at, feed_type')
    .eq('farm_id', farmId)
    .ilike('feed_type', `%${feedType}%`)
    .eq('unit', unit)
    .gt('quantity_kg', 0)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching weight per unit:', error);
    return null;
  }

  if (!data || !data.weight_per_unit) {
    console.log('No matching inventory found');
    return null;
  }

  console.log(`Found weight per unit: ${data.weight_per_unit} kg from inventory item: ${data.feed_type}`);
  return Number(data.weight_per_unit);
}

// Normalize feed type for consistent matching
function normalizeFeedType(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Check if a feed type exists in farm inventory (with stock > 0)
async function feedTypeExistsInInventory(
  supabase: any,
  farmId: string,
  feedType: string
): Promise<boolean> {
  const normalized = normalizeFeedType(feedType);
  
  const { data, error } = await supabase
    .from('feed_inventory')
    .select('id, feed_type')
    .eq('farm_id', farmId)
    .ilike('feed_type', normalized)
    .gt('quantity_kg', 0)
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('Error checking feed inventory:', error);
    return false;
  }
  
  if (!data) {
    console.log(`❌ Feed type "${feedType}" (normalized: "${normalized}") not found in inventory`);
  }
  
  return data !== null;
}

// Resolve feed type from inventory based on unit
async function resolveFeedTypeFromInventory(
  supabase: any,
  farmId: string,
  unit: string,
  specifiedFeedType?: string
): Promise<{ 
  feed_type: string | null, 
  needsClarification: boolean,
  availableOptions?: string[]
}> {
  
  // If feed type explicitly specified and not "unknown", use it
  if (specifiedFeedType && specifiedFeedType !== 'unknown') {
    return { feed_type: specifiedFeedType, needsClarification: false };
  }
  
  // Query inventory for feeds matching this unit
  const { data: inventory } = await supabase
    .from('feed_inventory')
    .select('feed_type')
    .eq('farm_id', farmId)
    .eq('unit', unit)
    .gt('quantity_kg', 0);
  
  if (!inventory || inventory.length === 0) {
    return { 
      feed_type: null, 
      needsClarification: true,
      availableOptions: []
    };
  }
  
  const uniqueFeedTypes: string[] = [...new Set(inventory.map((i: any) => i.feed_type))].filter((ft): ft is string => typeof ft === 'string');
  
  if (uniqueFeedTypes.length === 1) {
    // Only one option - use it
    const feedType: string = uniqueFeedTypes[0];
    console.log(`Auto-resolved unit "${unit}" to feed type: ${feedType}`);
    return { 
      feed_type: feedType, 
      needsClarification: false 
    };
  }
  
  // Multiple options - needs clarification
  console.log(`Multiple feed types found for unit "${unit}":`, uniqueFeedTypes);
  const options: string[] = uniqueFeedTypes;
  return { 
    feed_type: null, 
    needsClarification: true,
    availableOptions: options
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body robustly - handle nested body structure
    const raw = await req.json();
    const input = raw?.body && typeof raw.body === 'object' ? raw.body : raw;

    console.log('Incoming payload keys:', Object.keys(input || {}));

    // Accept alternate field names for flexibility
    const transcription = input?.transcription ?? input?.transcript ?? input?.text;
    const farmId = input?.farmId ?? input?.farm_id ?? input?.farm ?? input?.farmID;
    const animalId = input?.animalId ?? input?.animal_id;

    console.log('Has transcription?', !!transcription, 'Has farmId?', !!farmId);

    if (!transcription || !farmId) {
      return new Response(
        JSON.stringify({ error: 'Transcription and farmId are required' }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Processing transcription:', transcription);
    console.log('Animal context:', animalId || 'none');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Resolve animal info - use provided context or look up from database
    const animalContext = input?.animalContext;
    let animalInfo = null;

    if (animalId) {
      if (animalContext) {
        // Use provided context
        animalInfo = animalContext;
        console.log('Using provided animal context:', animalInfo);
      } else {
        // Fallback: look up from database
        console.log('No animal context provided, looking up from database...');
        const { data: animalData, error: animalError } = await supabase
          .from('animals')
          .select('name, ear_tag, gender, breed, birth_date, life_stage')
          .eq('id', animalId)
          .single();
        
        if (animalData && !animalError) {
          animalInfo = animalData;
          console.log('Retrieved animal info from database:', animalInfo);
        } else {
          console.error('Failed to retrieve animal info:', animalError);
        }
      }
    }

    // Use Lovable AI to extract structured data
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: animalId && animalInfo
              ? `You are an assistant helping farmhands log their daily activities. The farmhand is recording an activity for animal: ${animalInfo.name} (Ear Tag: ${animalInfo.ear_tag}, ID: ${animalId}).

IMPORTANT: 
- The animal is already identified (${animalInfo.name} - ${animalInfo.ear_tag})
- You DO NOT need to extract animal_identifier from the transcription unless the farmhand explicitly mentions a DIFFERENT animal
- Focus on extracting: activity type, quantity, and any additional notes
- If no animal is mentioned, assume they're talking about the current animal being viewed`
              : animalId
              ? `You are an assistant helping farmhands log their daily activities. The farmhand is recording an activity for a SPECIFIC ANIMAL (ID: ${animalId}).

IMPORTANT: 
- The animal is already identified, so you DO NOT need to extract animal_identifier from the transcription unless the farmhand explicitly mentions a DIFFERENT animal
- Focus on extracting: activity type, quantity, and any additional notes
- If no animal is mentioned, assume they're talking about the current animal being viewed

**FILIPINO LANGUAGE SUPPORT**:
You MUST recognize Filipino/Tagalog and Bisaya/Cebuano farming terms and extract the correct English equivalents:

Common Filipino/Tagalog Terms:
- Feed Types: "dayami"=rice straw, "mais"=corn, "darak"=rice bran, "concentrates"/"pellets"=concentrates, "pulot"=molasses, "napier"=napier grass
- Units: "supot"/"sako"=bag, "balde"=bucket, "bigkis"/"pakete"/"bale"=bale, "drum"/"bariles"=barrel
- Activities: "pagpapakain"=feeding, "paggatas"=milking, "pagbakunat"=vaccination, "pagturuk"=injection, "pagtimbang"=weighing
- Time: "ngayon"=now/today, "kahapon"=yesterday, "bukas"=tomorrow, "kanina"=earlier, "kamakalawa"=day before yesterday
- Animals: "baka"=cow, "toro"=bull, "guya"=dairy cow, "nagsususo"=lactating, "buntis"=pregnant

Bisaya/Cebuano: "gabie"=yesterday, "karon"=now, "ugma"=tomorrow, "papakaon"=feeding, "pagatas"=milking

**IMPORTANT - Unit Recognition (DO NOT convert manually)**:
- Extract COUNT and UNIT separately
- DO NOT multiply by weight - system will look up from inventory
- Extract: quantity (count), unit (type), and feed_type (name)

Examples:
- "Nagbigay ako ng 10 bigkis ng mais" → quantity: 10, unit: "bales", feed_type: "corn"
- "I fed 10 bales of corn silage" → quantity: 10, unit: "bales", feed_type: "corn silage"
- "5 sako ng concentrates" → quantity: 5, unit: "bags", feed_type: "concentrates"

Activity types: milking, feeding, health_observation, weight_measurement, injection, cleaning

Extract quantities when mentioned (liters for milk, kilograms for feed/weight).`
              : `You are an assistant helping farmhands log their daily activities. Extract structured information from voice transcriptions.

**FILIPINO LANGUAGE SUPPORT - COMPREHENSIVE VOCABULARY**:
You MUST recognize and correctly interpret Filipino/Tagalog and Bisaya farming terms:

Feed Types (dayami, mais, darak, etc.):
- "dayami"/"rice straw" = rice straw
- "mais"/"corn" = corn  
- "darak"/"rice bran" = rice bran
- "concentrates"/"pellets" = concentrates
- "pulot"/"molasses" = molasses
- "palay" = unhusked rice
- "kamoteng kahoy" = cassava
- "napier" = napier grass

Units/Containers:
- "supot"/"sako"/"bag" = bag/sack
- "balde"/"bucket" = bucket
- "bigkis"/"pakete"/"bale" = bundle/bale
- "kaserola"/"pot" = pot
- "drum"/"bariles" = barrel/drum

Activities:
- "pagpapakain"/"feeding" = feeding
- "paggatas"/"milking" = milking
- "pagbakunat"/"vaccination" = vaccination
- "pagbigay ng gamot"/"pagturuk" = medicine/injection
- "pagtimbang" = weighing

Time References:
- "ngayon"/"now"/"today" = current time
- "kahapon"/"yesterday" = yesterday
- "bukas"/"tomorrow" = tomorrow (FUTURE - reject this!)
- "kanina"/"earlier" = earlier today
- "kamakalawa" = day before yesterday
- "sa umaga"/"morning" = morning
- "sa tanghali"/"noon" = noon
- "sa hapon"/"afternoon" = afternoon
- "sa gabi"/"night" = evening/night

Bisaya/Cebuano:
- Time: "gabie"=yesterday, "karon"=now, "ugma"=tomorrow (FUTURE)
- Activities: "papakaon"=feeding, "pagatas"=milking

**LIVESTOCK TYPE DETECTION FOR MILKING**:
Detect livestock type from milk-related keywords:
- "goat milk"/"gatas ng kambing" → livestock_type: 'goat'
- "cow milk"/"gatas ng baka" → livestock_type: 'cattle'
- "carabao milk"/"gatas ng kalabaw" → livestock_type: 'carabao'
- "sheep milk"/"gatas ng tupa" → livestock_type: 'sheep'
- No type mentioned → livestock_type: null (will show all types for selection)

Examples:
- "Nag-gatas ako ng 20 liters ng goat milk" → livestock_type: 'goat'
- "I milked 20 liters" → livestock_type: null
- "Nakakuha ng 15 liters gatas ng baka" → livestock_type: 'cattle'

Numbers (Tagalog):
- "isa"=1, "dalawa"=2, "tatlo"=3, "apat"=4, "lima"=5
- "anim"=6, "pito"=7, "walo"=8, "siyam"=9, "sampu"=10
- "labinisa"=11, "labindalawa"=12, "labintatlo"=13, "labing-apat"=14, "labinlima"=15
- "dalawampu"=20, "tatlumpu"=30, "apatnapu"=40, "limampu"=50
- Examples: "lima litro"=5 liters, "sampu sako"=10 bags, "tatlo bigkis"=3 bales
- CRITICAL: Convert Tagalog numbers to digits for database storage!

Mixed Language (Taglish):
- "Nag-feed ako ng 10 bales" = I fed 10 bales
- "Pinakain ko ang 5 sako" = I fed 5 bags
- "Nag-milk ng 20 litro" = Milked 20 liters
- "Nag-milk ng dalawampu litro" = Milked 20 liters
- "Lima sako ng darak" = 5 bags of rice bran

CRITICAL: Extract correct English equivalents for database storage!

**IMPORTANT - Feeding Activity Logic**:
- If farmhand mentions SPECIFIC animals (ear tag, name), extract animal_identifier
- If says "lahat"/"all"/"everyone"/"herd", NO animal_identifier (proportional distribution)
- Proportional distribution divides feed by animal weights
- DO NOT extract "cat" (likely mishearing "cattle")

**CRITICAL - Feed Type vs Unit Distinction**:
For feeding activities, you MUST correctly distinguish between feed_type and unit:

FEED_TYPE = WHAT the feed is (the actual material/product name):
- Examples: "corn silage", "hay", "concentrates", "alfalfa", "barley", "grain"
- Common variations: "baled corn silage", "chopped hay", "dairy concentrates"
- If user explicitly mentions feed type, extract it exactly
- If user only mentions unit WITHOUT specifying content, set feed_type to "unknown"

UNIT = HOW it's packaged/measured:
- Examples: "bales", "bags", "barrels", "buckets", "kg", "drums"
- This describes the container or measurement, NOT the feed itself

EXTRACTION RULES:
1. "5 bales" alone → feed_type: "unknown", unit: "bales", quantity: 5
2. "5 bales of corn silage" → feed_type: "corn silage", unit: "bales", quantity: 5
3. "2 bags of concentrates" → feed_type: "concentrates", unit: "bags", quantity: 2
4. "8 bales of baled corn silage" → feed_type: "baled corn silage", unit: "bales", quantity: 8
5. "3 bags" alone → feed_type: "unknown", unit: "bags", quantity: 3

**CRITICAL**: System will check inventory to resolve "unknown" feed types automatically.
**NEVER use the unit name as the feed_type!**
**NEVER assume or default feed types - extract only what user explicitly says!**

**IMPORTANT - Unit Recognition (DO NOT convert manually)**:
- When farmhand mentions units like "bales", "bags", "barrels/drums", extract the COUNT and UNIT separately
- DO NOT multiply by weight - the system will look up the correct weight from inventory
- Extract: quantity (count), unit (type), and feed_type (name of the actual feed)

Examples:
- "I fed 10 bales of corn silage" → quantity: 10, unit: "bales", feed_type: "corn silage"
- "Opened 5 bags of concentrates" → quantity: 5, unit: "bags", feed_type: "concentrates"
- "Used 2 barrels of molasses" → quantity: 2, unit: "barrels", feed_type: "molasses"
- "Fed 8 bales" → quantity: 8, unit: "bales", feed_type: "hay"
- "Gave 3 bags" → quantity: 3, unit: "bags", feed_type: "concentrates"

Activity types you can identify:
- feeding: Recording feed given to animals (can be bulk or specific) - ALWAYS requires feed_type
- milking: Recording milk production (requires specific animal)
- health_observation: General health checks
- weight_measurement: Recording animal weight (requires specific animal)
- injection: Medicine or vaccine administration (requires specific animal)
- cleaning: General cleaning tasks

Extract quantities when mentioned (liters for milk, kilograms for feed/weight).`
          },
          {
            role: 'user',
            content: `Extract activity information from: "${transcription}"`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'log_activity',
              description: 'Log a farmhand activity with extracted details',
              parameters: {
                type: 'object',
                properties: {
                  activity_type: {
                    type: 'string',
                    enum: ['milking', 'feeding', 'health_observation', 'weight_measurement', 'injection', 'cleaning'],
                    description: 'Type of activity performed'
                  },
                  animal_identifier: {
                    type: 'string',
                    description: animalId 
                      ? 'Optional - only if farmhand explicitly mentions a DIFFERENT animal'
                      : 'Animal ear tag number or name mentioned'
                  },
                  quantity: {
                    type: 'number',
                    description: 'Quantity COUNT (number of units). For example: 10 bales, 5 bags, 2 barrels. Do NOT convert to kg.'
                  },
                  unit: {
                    type: 'string',
                    enum: ['bales', 'bags', 'barrels', 'kg', 'liters'],
                    description: 'Unit of measurement mentioned (bales, bags, barrels, kg, or liters)'
                  },
                  feed_type: {
                    type: 'string',
                    description: 'CRITICAL - REQUIRED for feeding activities. The ACTUAL FEED MATERIAL being given (e.g., "corn silage", "hay", "concentrates", "molasses"). If the user does NOT explicitly mention what the feed is, you MUST set this to null (not "unknown"). Only extract what the user actually says. Valid values: specific feed names OR null.'
                  },
                  medicine_name: {
                    type: 'string',
                    description: 'Name of medicine or vaccine (if injection activity)'
                  },
                  dosage: {
                    type: 'string',
                    description: 'Dosage amount (if injection activity)'
                  },
                  date_reference: {
                    type: 'string',
                    description: `Date or time reference in ANY language:
- English: "today", "yesterday", "2 days ago", "last Monday", "this morning"
- Tagalog: "ngayon", "kahapon", "kanina", "kamakalawa", "noong isang araw", "sa umaga"
- Bisaya: "karon", "gabie"
- Time: "umaga"=morning, "tanghali"=noon, "hapon"=afternoon, "gabi"=night

CRITICAL: Flag future references: "bukas", "ugma", "tomorrow", "mamaya", "sa susunod"`
                  },
                  livestock_type: {
                    type: 'string',
                    enum: ['cattle', 'goat', 'carabao', 'sheep'],
                    description: 'Livestock type detected from milk keywords (ONLY for milking activities). Extract ONLY if explicitly mentioned: "goat milk", "cow milk", "carabao milk", "sheep milk". Leave null if not mentioned.'
                  },
                  notes: {
                    type: 'string',
                    description: 'Additional observations or notes'
                  }
                },
                required: animalId ? ['activity_type'] : ['activity_type', 'animal_identifier']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'log_activity' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error('AI processing failed');
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData));

    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      throw new Error('No activity data extracted from transcription');
    }

    console.log(`Extracted ${toolCalls.length} tool call(s)`);
    
    // Parse all tool calls
    const extractedActivities = toolCalls.map((toolCall: any, index: number) => {
      const data = JSON.parse(toolCall.function.arguments);
      console.log(`Activity ${index + 1}:`, data);
      
      // TIER 2: CRITICAL VALIDATION - Feeding MUST have valid feed_type
      if (data.activity_type === 'feeding') {
        if (!data.feed_type || data.feed_type === 'unknown' || data.feed_type.trim() === '') {
          console.error(`❌ VALIDATION ERROR: feed_type missing or invalid for feeding activity ${index + 1}`);
          throw new Error(
            'Kulang ang information! Sabihin kung anong feed ang binigay (halimbawa: "corn silage", "hay", "concentrates"). / ' +
            'Feed type must be specified! Please mention what type of feed was given (e.g., corn silage, hay, concentrates).'
          );
        }
        console.log(`✅ Validation passed - feed_type: ${data.feed_type}`);
      }
      
      // Validate and parse date reference if provided
      if (data.date_reference) {
        const dateValidation = parseAndValidateDate(data.date_reference);
        if (!dateValidation.isValid) {
          throw new Error(dateValidation.error);
        }
        data.validated_date = dateValidation.date;
        data.validated_datetime = dateValidation.datetime;
        console.log(`✓ Date validated: ${data.date_reference} → ${data.validated_date}`);
      }
      
      return data;
    });
    
    // Check if we have multiple feeding activities
    const feedingActivities = extractedActivities.filter((a: any) => a.activity_type === 'feeding');
    const hasMultipleFeeds = feedingActivities.length > 1;

    // Validate all extracted activities
    for (let i = 0; i < extractedActivities.length; i++) {
      const activity = extractedActivities[i];
      const validation = validateActivityData(activity);
      
      if (!validation.valid) {
        console.error(`❌ Validation failed for activity ${i + 1}:`, validation.error);
        throw new Error(validation.error);
      }
      
      console.log(`✅ Validation passed for activity ${i + 1}: ${activity.activity_type}`);
    }
    
    // TIER 3: MANDATORY inventory resolution - Must succeed or fail with clear error
    if (feedingActivities.length > 0) {
      for (const activity of feedingActivities) {
        // If feed_type is missing or unknown, MUST resolve from inventory
        if (!activity.feed_type || activity.feed_type === 'unknown') {
          if (!activity.unit) {
            throw new Error(
              'Hindi ma-identify ang feed. Sabihin ang feed type o unit (e.g., "3 bags ng concentrates"). / ' +
              'Cannot identify feed. Please specify feed type or unit (e.g., "3 bags of concentrates").'
            );
          }
          
          console.log(`🔍 MANDATORY resolution for unit: ${activity.unit}`);
          const resolution = await resolveFeedTypeFromInventory(
            supabase,
            farmId,
            activity.unit,
            undefined  // Force fresh lookup
          );
          
          // MUST succeed or provide clear options
          if (resolution.needsClarification || !resolution.feed_type) {
            const options = resolution.availableOptions && resolution.availableOptions.length > 0
              ? `Available: ${resolution.availableOptions.join(', ')}`
              : 'Walang feed sa inventory para sa unit na ito. Magdagdag muna sa inventory. / No feed in inventory for this unit. Please add to inventory first.';
            
            throw new Error(
              `Pakispecify kung anong feed para sa ${activity.quantity} ${activity.unit}. ${options} / ` +
              `Please specify the feed type for ${activity.quantity} ${activity.unit}. ${options}`
            );
          }
          
          activity.feed_type = resolution.feed_type;
          console.log(`✅ MANDATORY resolution successful: ${resolution.feed_type}`);
        }
      }
    }
    
    // PREFLIGHT: Verify all feeding activities have feed_type in inventory
    console.log('🔍 Preflight: Checking all feed types exist in inventory...');
    for (const activity of feedingActivities) {
      const feedExists = await feedTypeExistsInInventory(supabase, farmId, activity.feed_type);
      if (!feedExists) {
        console.log(`❌ Preflight failed: feed not in inventory`, { 
          feed_type: activity.feed_type, 
          unit: activity.unit 
        });
        
        return new Response(
          JSON.stringify({
            error: 'FEED_TYPE_NOT_IN_INVENTORY',
            feed_type: activity.feed_type,
            message: `Ang "${activity.feed_type}" ay wala sa inyong feed inventory. Magdagdag muna bago mag-record. / "${activity.feed_type}" is not in your feed inventory. Please add it first before recording.`
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }
    console.log('✅ Preflight inventory check passed for all feed activities');
    
    // Use the first activity for non-feeding logic or single feed
    const extractedData = extractedActivities[0];

    // Use provided animalId if available, otherwise look up from identifier
    let finalAnimalId = animalId;

    if (!animalId && extractedData.animal_identifier) {
      const identifier = extractedData.animal_identifier.toLowerCase();
      
      // Try to find by ear tag or name
      const { data: animals } = await supabase
        .from('animals')
        .select('id, ear_tag, name')
        .eq('farm_id', farmId)
        .eq('is_deleted', false);

      const animal = animals?.find(a => 
        a.ear_tag?.toLowerCase().includes(identifier) ||
        a.name?.toLowerCase().includes(identifier) ||
        identifier.includes(a.ear_tag?.toLowerCase() || '') ||
        identifier.includes(a.name?.toLowerCase() || '')
      );

      if (animal) {
        finalAnimalId = animal.id;
        console.log('Found animal:', animal);
      } else {
        console.log('Animal not found for identifier:', identifier);
      }
    }

    // Check if activity requires animal but none was identified
    const requiresAnimal = ['weight_measurement', 'milking', 'health_observation', 'injection'].includes(extractedData.activity_type);
    
    if (requiresAnimal && !finalAnimalId && !hasMultipleFeeds) {
      console.log('Activity requires animal selection');
      return new Response(
        JSON.stringify({
          ...extractedData,
          needs_animal_selection: true,
          message: 'Please select which animal this activity is for'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert record for single animal activities
    if (finalAnimalId && extractedData.activity_type && !hasMultipleFeeds) {
      // Verify animal belongs to user's farm (security check)
      const { data: animalCheck, error: animalError } = await supabase
        .from('animals')
        .select('farm_id, id')
        .eq('id', finalAnimalId)
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .single();
      
      if (animalError || !animalCheck) {
        console.error('❌ Animal access denied:', { finalAnimalId, farmId });
        throw new Error(
          'Hindi kayo may access sa animal na ito. / You do not have access to this animal.'
        );
      }
      
      console.log('✅ Animal ownership verified');

      const recordDate = extractedData.validated_date || new Date().toISOString().split('T')[0];
      const recordDatetime = extractedData.validated_datetime || new Date().toISOString();
      
      try {
        switch (extractedData.activity_type) {
          case 'feeding':
            if (extractedData.quantity && extractedData.feed_type) {
              // TIER 4: FINAL SAFETY CHECK - Reject invalid feed_type
              if (extractedData.feed_type === 'unknown' || !extractedData.feed_type.trim()) {
                throw new Error(
                  '❌ Hindi pa rin ma-identify ang feed type. Subukan ulit at sabihin explicitly kung ano. / ' +
                  '❌ Feed type still unknown. Please try again and explicitly state the feed type.'
                );
              }
              
              // Convert to kg if needed
              let amountKg = extractedData.quantity;
              if (extractedData.unit && ['bales', 'bags', 'barrels'].includes(extractedData.unit)) {
                const weightPerUnit = await getLatestWeightPerUnit(supabase, farmId, extractedData.feed_type, extractedData.unit);
                if (!weightPerUnit) {
                  // ❌ NO INVENTORY MATCH - MUST ADD INVENTORY FIRST
                  throw new Error(
                    `❌ Walang inventory entry para sa "${extractedData.feed_type}" na naka-${extractedData.unit}. Magdagdag muna ng inventory entry bago mag-record ng feeding. / ` +
                    `❌ No inventory entry found for "${extractedData.feed_type}" in ${extractedData.unit}. Please add an inventory entry before recording feeding activities.`
                  );
                }
                amountKg = extractedData.quantity * weightPerUnit;
                console.log(`✅ Used inventory weight: ${weightPerUnit} kg per ${extractedData.unit} → ${amountKg} kg total`);
              }
              
              // TIER 4: FINAL SAFETY CHECK #2 - Reject zero or negative weight
              if (amountKg <= 0) {
                throw new Error(
                  '❌ Hindi ma-calculate ang weight (0 kg). Siguraduhin na may inventory entry para sa feed type. / ' +
                  '❌ Cannot calculate weight (0 kg). Ensure inventory entry exists for this feed type.'
                );
              }
              
              console.log(`✅ Final validation passed: ${amountKg} kg of ${extractedData.feed_type}`);
              
              const { error: feedError } = await supabase.from('feeding_records').insert({
                animal_id: finalAnimalId,
                record_datetime: recordDatetime,
                feed_type: extractedData.feed_type,
                kilograms: amountKg,
                notes: extractedData.notes,
                created_by: user.id
              });
              
              if (feedError) throw feedError;
              console.log(`✓ Inserted feeding record: ${amountKg} kg of ${extractedData.feed_type}`);
            }
            break;
            
          case 'weight_measurement':
            if (extractedData.quantity) {
              const { error: weightError } = await supabase.from('weight_records').insert({
                animal_id: finalAnimalId,
                weight_kg: extractedData.quantity,
                measurement_date: recordDate,
                recorded_by: user.id,
                notes: extractedData.notes
              });
              
              if (weightError) throw weightError;
              console.log(`✓ Inserted weight record: ${extractedData.quantity} kg`);
            }
            break;
            
          case 'milking':
            if (extractedData.quantity) {
              const { error: milkError } = await supabase.from('milking_records').insert({
                animal_id: finalAnimalId,
                record_date: recordDate,
                liters: extractedData.quantity,
                created_by: user.id
              });
              
              if (milkError) throw milkError;
              console.log(`✓ Inserted milking record: ${extractedData.quantity} liters`);
            }
            break;
            
          case 'injection':
            const { error: injectionError } = await supabase.from('injection_records').insert({
              animal_id: finalAnimalId,
              record_datetime: recordDatetime,
              medicine_name: extractedData.medicine_name,
              dosage: extractedData.dosage,
              instructions: extractedData.notes,
              created_by: user.id
            });
            
            if (injectionError) throw injectionError;
            console.log(`✓ Inserted injection record: ${extractedData.medicine_name}`);
            break;
            
          case 'health_observation':
            const { error: healthError } = await supabase.from('health_records').insert({
              animal_id: finalAnimalId,
              visit_date: recordDate,
              notes: extractedData.notes,
              created_by: user.id
            });
            
            if (healthError) throw healthError;
            console.log(`✓ Inserted health record`);
            break;
        }
      } catch (dbError) {
        console.error('Database insertion error:', dbError);
        throw new Error(`Failed to save ${extractedData.activity_type} record: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
    }

    // Handle multiple feeding activities (bulk feeding with multiple feed types)
    if (hasMultipleFeeds && feedingActivities.every((a: any) => !a.animal_identifier)) {
      console.log(`Processing ${feedingActivities.length} different feed types for bulk feeding`);
      
      // Get all active animals for this farm (shared across all feeds)
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('id, name, ear_tag, current_weight_kg')
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .not('current_weight_kg', 'is', null);
      
      if (animalsError) {
        console.error('Error fetching animals:', animalsError);
        throw new Error('Failed to fetch farm animals');
      }
      
      console.log(`Found ${animals.length} animals for distribution`);
      
      // Calculate total weight of all animals (same for all feeds)
      const totalWeightKg = animals.reduce((sum, animal) => sum + (Number(animal.current_weight_kg) || 0), 0);
      console.log(`Total weight: ${totalWeightKg}`);
      
      // Process each feed type
      const feeds = [];
      for (const feedActivity of feedingActivities) {
        if (!feedActivity.quantity || !feedActivity.unit) {
          console.log(`Skipping feed without quantity/unit:`, feedActivity);
          continue;
        }
        
        console.log(`Processing feed: ${feedActivity.feed_type}, ${feedActivity.quantity} ${feedActivity.unit}`);
        
        console.log(`Processing feed: ${feedActivity.feed_type}, ${feedActivity.quantity} ${feedActivity.unit}`);
        
        // Convert units to kg using FIFO inventory lookup
        const weightPerUnit = await getLatestWeightPerUnit(
          supabase,
          farmId,
          feedActivity.feed_type,
          feedActivity.unit
        );
        
        // Require inventory match for bulk feeding
        if (!weightPerUnit) {
          // ❌ NO INVENTORY MATCH FOR BULK FEEDING - MUST ADD INVENTORY FIRST
          throw new Error(
            `❌ Walang inventory entry para sa "${feedActivity.feed_type}" na naka-${feedActivity.unit}. Magdagdag muna ng inventory entry bago mag-record ng bulk feeding. / ` +
            `❌ No inventory entry found for "${feedActivity.feed_type}" in ${feedActivity.unit}. Please add an inventory entry before recording bulk feeding activities.`
          );
        }
        const totalKg = feedActivity.quantity * weightPerUnit;
        console.log(`✅ Used inventory weight for bulk feeding: ${feedActivity.quantity} ${feedActivity.unit} = ${totalKg} kg (${weightPerUnit} kg/unit)`);
        
        // Calculate proportional distribution for this feed
        const distributions = animals.map(animal => {
          const animalWeight = Number(animal.current_weight_kg) || 0;
          const proportion = animalWeight / totalWeightKg;
          const feedAmount = totalKg * proportion;
          
          return {
            animal_id: animal.id,
            animal_name: animal.name,
            ear_tag: animal.ear_tag,
            weight_kg: animalWeight,
            proportion,
            feed_amount: feedAmount
          };
        });
        
        // Insert feeding records for each animal for this feed type
        const recordDatetime = feedActivity.validated_datetime || new Date().toISOString();
        const insertPromises = distributions.map(dist => 
          supabase.from('feeding_records').insert({
            animal_id: dist.animal_id,
            record_datetime: recordDatetime,
            feed_type: feedActivity.feed_type,
            kilograms: dist.feed_amount,
            notes: `Bulk feeding - ${feedActivity.quantity} ${feedActivity.unit} distributed proportionally${feedActivity.notes ? ': ' + feedActivity.notes : ''}`,
            created_by: user.id
          })
        );

        await Promise.all(insertPromises);
        console.log(`✓ Inserted ${distributions.length} feeding records for ${feedActivity.feed_type}`);
        
        feeds.push({
          feed_type: feedActivity.feed_type,
          quantity: feedActivity.quantity,
          unit: feedActivity.unit,
          total_kg: totalKg,
          weight_per_unit: weightPerUnit || DEFAULT_WEIGHTS[feedActivity.unit as keyof typeof DEFAULT_WEIGHTS],
          distributions,
          notes: feedActivity.notes
        });
      }
      
      console.log(`✓ Returning bulk feeding data with ${feeds.length} feed types and inserted records`);
      
      return new Response(
        JSON.stringify({
          activity_type: 'feeding',
          multiple_feeds: true,
          total_animals: animals.length,
          total_weight_kg: totalWeightKg,
          feeds
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a bulk feeding scenario (feeding without specific animal found)
    if (extractedData.activity_type === 'feeding' && !finalAnimalId && extractedData.quantity) {
      console.log('Bulk feeding detected - calculating proportional distribution');
      
      // Step 1: Convert units to kg using FIFO inventory lookup
      let totalKg = extractedData.quantity;
      let weightPerUnit = null;
      
      if (extractedData.unit && ['bales', 'bags', 'barrels'].includes(extractedData.unit)) {
        // Try to get weight per unit from inventory (FIFO)
        weightPerUnit = await getLatestWeightPerUnit(
          supabase,
          farmId,
          extractedData.feed_type || '',
          extractedData.unit
        );
        
        if (weightPerUnit) {
          totalKg = extractedData.quantity * weightPerUnit;
          console.log(`Converted ${extractedData.quantity} ${extractedData.unit} to ${totalKg} kg using inventory weight (${weightPerUnit} kg/unit)`);
        } else {
          // Fallback to default weights with type safety
          const unit = extractedData.unit as 'bales' | 'bags' | 'barrels';
          const defaultWeight = DEFAULT_WEIGHTS[unit] || 1;
          totalKg = extractedData.quantity * defaultWeight;
          console.log(`Using default weight: ${extractedData.quantity} ${extractedData.unit} = ${totalKg} kg (${defaultWeight} kg/unit)`);
        }
      }
      
      // Step 2: Fetch all active animals for the farm
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('id, name, ear_tag, current_weight_kg, life_stage')
        .eq('farm_id', farmId)
        .eq('is_deleted', false);

      if (animalsError) {
        console.error('Error fetching animals:', animalsError);
        throw new Error('Failed to fetch animals for distribution');
      }

      if (!animals || animals.length === 0) {
        throw new Error('No animals found in this farm');
      }

      console.log(`Found ${animals.length} animals for distribution`);

      // Calculate total weight
      const totalWeight = animals.reduce((sum, a) => sum + (a.current_weight_kg || 0), 0);
      console.log('Total weight:', totalWeight);

      // Calculate proportional distribution
      const distributions = animals.map(animal => {
        const weight = animal.current_weight_kg || 0;
        const proportion = totalWeight > 0 ? weight / totalWeight : 1 / animals.length;
        const feedAmount = totalKg * proportion;
        
        return {
          animal_id: animal.id,
          animal_name: animal.name || `Tag ${animal.ear_tag}`,
          ear_tag: animal.ear_tag,
          weight_kg: weight,
          proportion: proportion,
          feed_amount: feedAmount
        };
      });

      console.log('Distribution calculated:', distributions);
      
      // Insert feeding records for each animal
      const recordDatetime = extractedData.validated_datetime || new Date().toISOString();
      const insertPromises = distributions.map(dist => 
        supabase.from('feeding_records').insert({
          animal_id: dist.animal_id,
          record_datetime: recordDatetime,
          feed_type: extractedData.feed_type,
          kilograms: dist.feed_amount,
          notes: `Bulk feeding - ${extractedData.quantity} ${extractedData.unit} distributed proportionally${extractedData.notes ? ': ' + extractedData.notes : ''}`,
          created_by: user.id
        })
      );

      await Promise.all(insertPromises);
      console.log(`✓ Inserted ${distributions.length} bulk feeding records`);
      
      console.log('✓ Returning bulk feeding data with feed_type:', extractedData.feed_type);

      return new Response(
        JSON.stringify({
          ...extractedData,
          total_kg: totalKg,
          original_quantity: extractedData.quantity,
          original_unit: extractedData.unit || 'kg',
          weight_per_unit: weightPerUnit,
          is_bulk_feeding: true,
          total_animals: animals.length,
          total_weight_kg: totalWeight,
          distributions: distributions
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        activity_type: extractedData.activity_type,
        animal_id: finalAnimalId,
        message: 'Activity recorded successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
