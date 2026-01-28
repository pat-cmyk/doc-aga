import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Import SSOT prompts from shared library
import { getActivityExtractionPrompt } from "../_shared/stt-prompts.ts";

console.log('[process-farmhand-activity] v2025-10-20-SSOT');

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
    .nullable(),
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
function parseAndValidateDate(dateReference: string | undefined, maxBackdateDays: number = 7): { 
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
  
  // Validate not too old (use farm-specific limit)
  const daysDiff = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > maxBackdateDays) {
    return {
      date: '',
      datetime: '',
      isValid: false,
      error: `Hindi pwedeng mag-record ng activities na mas luma sa ${maxBackdateDays} days. Makipag-ugnayan sa farm manager para sa lumang records. / Cannot record activities older than ${maxBackdateDays} days. Please contact your farm manager for historical records.`
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

// Check if activity requires approval and queue it if needed
async function checkAndQueueForApproval(
  supabase: any,
  farmId: string,
  userId: string,
  activityType: string,
  activityData: any,
  animalIds: string[]
): Promise<{ needsApproval: boolean; autoApproveAt: string | null }> {
  console.log(`Checking if approval required for ${activityType}...`);
  
  // Check if this user/farm/activity combo requires approval
  const { data: requiresApproval, error: approvalError } = await supabase.rpc('requires_approval', {
    _farm_id: farmId,
    _user_id: userId,
    _activity_type: activityType
  });

  if (approvalError) {
    console.error('Error checking approval requirement:', approvalError);
    return { needsApproval: false, autoApproveAt: null };
  }

  if (!requiresApproval) {
    console.log('No approval required - user is owner/manager or approval disabled');
    return { needsApproval: false, autoApproveAt: null };
  }

  // Get auto-approval time
  const { data: autoApproveAt, error: timeError } = await supabase.rpc('calculate_auto_approve_time', {
    _farm_id: farmId
  });

  if (timeError) {
    console.error('Error calculating auto-approve time:', timeError);
  }

  console.log(`Approval required - queuing activity. Auto-approve at: ${autoApproveAt}`);

  // Queue for approval
  const { error: queueError } = await supabase
    .from('pending_activities')
    .insert({
      farm_id: farmId,
      submitted_by: userId,
      activity_type: activityType,
      activity_data: activityData,
      animal_ids: animalIds,
      status: 'pending',
      auto_approve_at: autoApproveAt
    });

  if (queueError) {
    console.error('Error queuing activity:', queueError);
    throw new Error('Failed to queue activity for approval');
  }

  return { needsApproval: true, autoApproveAt };
}

// Check if a feed type exists in farm inventory with fuzzy matching
async function feedTypeExistsInInventory(
  supabase: any,
  farmId: string,
  feedType: string
): Promise<{ exists: boolean; matchedType?: string }> {
  const normalized = normalizeFeedType(feedType);
  
  // Try exact match first (case-insensitive)
  let { data } = await supabase
    .from('feed_inventory')
    .select('feed_type')
    .eq('farm_id', farmId)
    .ilike('feed_type', normalized)
    .gt('quantity_kg', 0)
    .limit(1)
    .maybeSingle();
  
  if (data) {
    return { exists: true, matchedType: data.feed_type };
  }
  
  // Try without trailing 's' (singular/plural handling)
  const singular = normalized.replace(/s$/, '');
  ({ data } = await supabase
    .from('feed_inventory')
    .select('feed_type')
    .eq('farm_id', farmId)
    .ilike('feed_type', singular)
    .gt('quantity_kg', 0)
    .limit(1)
    .maybeSingle());
  
  if (data) {
    console.log(`✅ Fuzzy matched "${feedType}" to "${data.feed_type}" (plural handling)`);
    return { exists: true, matchedType: data.feed_type };
  }
  
  // Try partial match (feed_type contains or is contained by input)
  const { data: allInventory } = await supabase
    .from('feed_inventory')
    .select('feed_type')
    .eq('farm_id', farmId)
    .gt('quantity_kg', 0);
  
  const match = allInventory?.find((item: any) => {
    const itemNorm = item.feed_type.toLowerCase();
    return itemNorm.includes(normalized) || normalized.includes(itemNorm);
  });
  
  if (match) {
    console.log(`✅ Fuzzy matched "${feedType}" to "${match.feed_type}" (partial match)`);
    return { exists: true, matchedType: match.feed_type };
  }
  
  console.log(`❌ Feed type "${feedType}" (normalized: "${normalized}") not found in inventory`);
  return { exists: false };
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
            content: getActivityExtractionPrompt(
              animalId && animalInfo ? animalInfo : undefined,
              animalId
            )
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
                    nullable: true,
                    description: 'CRITICAL - REQUIRED for feeding activities. The ACTUAL FEED MATERIAL being given (e.g., "corn silage", "hay", "concentrates", "molasses"). If the user does NOT explicitly mention what the feed is, you MUST set this to null. NEVER use "unknown" - use null instead. Only extract what the user actually says. Valid values: specific feed names OR null.'
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
      
      // TIER 2: Soft validation log for feeding
      if (data.activity_type === 'feeding') {
        // Allow missing/null/"unknown" here; Tier 3 + inventory resolution will handle it.
        console.log(`Tier 2 feeding check - raw feed_type: ${data.feed_type ?? 'null'}`);
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
            return new Response(
              JSON.stringify({
                error: 'NEEDS_CLARIFICATION',
                message: 'Hindi ma-identify ang feed. Sabihin ang feed type o unit (e.g., "3 bags ng concentrates"). / Cannot identify feed. Please specify feed type or unit (e.g., "3 bags of concentrates").',
                availableOptions: []
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
            const options = resolution.availableOptions || [];
            const message = options.length > 0
              ? `Pakispecify kung anong feed para sa ${activity.quantity} ${activity.unit}. / Please specify the feed type for ${activity.quantity} ${activity.unit}.`
              : `Walang feed sa inventory para sa unit na "${activity.unit}". Magdagdag muna sa inventory. / No feed in inventory for unit "${activity.unit}". Please add to inventory first.`;
            
            return new Response(
              JSON.stringify({
                error: 'NEEDS_CLARIFICATION',
                message,
                availableOptions: options
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      const feedResult = await feedTypeExistsInInventory(supabase, farmId, activity.feed_type);
      
      if (!feedResult.exists) {
        console.log(`❌ Preflight failed: feed not in inventory`, { 
          feed_type: activity.feed_type, 
          unit: activity.unit 
        });
        
        // Get available options for this farm
        const { data: availableInventory } = await supabase
          .from('feed_inventory')
          .select('feed_type')
          .eq('farm_id', farmId)
          .gt('quantity_kg', 0);
        
        const availableOptions = [...new Set(availableInventory?.map((i: any) => i.feed_type) || [])];
        
        return new Response(
          JSON.stringify({
            error: 'FEED_TYPE_NOT_IN_INVENTORY',
            feed_type: activity.feed_type,
            available_options: availableOptions,
            message: `Ang "${activity.feed_type}" ay wala sa inyong feed inventory. Magdagdag muna bago mag-record. / "${activity.feed_type}" is not in your feed inventory. Please add it first before recording.`
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // If fuzzy matched, use the matched type
      if (feedResult.matchedType && feedResult.matchedType !== activity.feed_type) {
        console.log(`✅ Using fuzzy matched feed type: "${feedResult.matchedType}" instead of "${activity.feed_type}"`);
        activity.feed_type = feedResult.matchedType;
      }
    }
    console.log('✅ Preflight inventory check passed for all feed activities');
    
    // Use the first activity for non-feeding logic or single feed
    const extractedData = extractedActivities[0];

    // Use provided animalId if available, otherwise look up from identifier
    let finalAnimalId = animalId;

    if (!animalId && extractedData.animal_identifier) {
      const identifier = extractedData.animal_identifier.toLowerCase().trim();
      
      // Skip if identifier is too short to be reliable
      if (identifier.length < 2) {
        console.log('Animal identifier too short for reliable matching:', identifier);
      } else {
        // Try to find by ear tag or name with strict matching
        const { data: animals } = await supabase
          .from('animals')
          .select('id, ear_tag, name')
          .eq('farm_id', farmId)
          .eq('is_deleted', false);

        // Score-based matching: prioritize exact matches, then partial matches
        let bestMatch: { animal: { id: string; ear_tag: string | null; name: string | null }; score: number } | null = null;
        
        for (const animal of animals || []) {
          const earTag = animal.ear_tag?.toLowerCase() || '';
          const name = animal.name?.toLowerCase() || '';
          
          // Skip animals with no identifiable fields
          if (!earTag && !name) continue;
          
          let score = 0;
          
          // Exact match scores highest
          if (earTag === identifier || name === identifier) {
            score = 100;
          }
          // Ear tag is contained in identifier (e.g., "A002 Bessie" contains "A002")
          else if (earTag && identifier.includes(earTag) && earTag.length >= 2) {
            score = 80;
          }
          // Name is contained in identifier (e.g., "Tita Bessie" contains "Bessie")
          else if (name && identifier.includes(name) && name.length >= 2) {
            score = 70;
          }
          // Identifier is contained in ear tag (partial ear tag match)
          else if (earTag && earTag.includes(identifier) && identifier.length >= 2) {
            score = 60;
          }
          // Identifier is contained in name (partial name match)
          else if (name && name.includes(identifier) && identifier.length >= 2) {
            score = 50;
          }
          
          if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { animal, score };
          }
        }
        
        if (bestMatch && bestMatch.score >= 50) {
          finalAnimalId = bestMatch.animal.id;
          console.log('Found animal match:', {
            animal: bestMatch.animal,
            score: bestMatch.score,
            searchTerm: identifier
          });
        } else {
          console.log('No confident animal match for identifier:', identifier);
        }
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
      // Verify animal belongs to user's farm (security check) and get farm_entry_date
      const { data: animalCheck, error: animalError } = await supabase
        .from('animals')
        .select('farm_id, id, farm_entry_date')
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

      // Validate activity date against farm_entry_date
      const recordDate = extractedData.validated_date || new Date().toISOString().split('T')[0];
      if (animalCheck.farm_entry_date) {
        const entryDate = new Date(animalCheck.farm_entry_date);
        entryDate.setHours(0, 0, 0, 0);
        const activityDate = new Date(recordDate);
        activityDate.setHours(0, 0, 0, 0);
        
        if (activityDate < entryDate) {
          const formattedEntryDate = entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          console.error('❌ Activity date before farm entry date:', { recordDate, farmEntryDate: animalCheck.farm_entry_date });
          throw new Error(
            `Hindi pwede ang record date bago ang farm entry date (${formattedEntryDate}). / ` +
            `Record date cannot be before farm entry date (${formattedEntryDate}).`
          );
        }
      }

      // Check if this activity needs approval (farmhand submissions)
      const approvalCheck = await checkAndQueueForApproval(
        supabase,
        farmId,
        user.id,
        extractedData.activity_type,
        extractedData,
        [finalAnimalId]
      );

      if (approvalCheck.needsApproval) {
        console.log('Activity queued for manager approval');
        return new Response(
          JSON.stringify({
            success: true,
            queued: true,
            activity_type: extractedData.activity_type,
            message: 'Activity queued for manager approval',
            auto_approve_at: approvalCheck.autoApproveAt
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // recordDate already defined above for farm_entry_date validation
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
              const currentHour = new Date().getHours();
              const milkSession = currentHour < 12 ? 'AM' : 'PM';
              const { error: milkError } = await supabase.from('milking_records').insert({
                animal_id: finalAnimalId,
                record_date: recordDate,
                liters: extractedData.quantity,
                session: milkSession,
                created_by: user.id
              });
              
              if (milkError) throw milkError;
              console.log(`✓ Inserted milking record: ${extractedData.quantity} liters (${milkSession})`);
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

      // Calculate total weight of all animals FIRST (needed for all feeds)
      const totalWeightKg = animals.reduce((sum, animal) => sum + (Number(animal.current_weight_kg) || 0), 0);
      console.log(`Total weight: ${totalWeightKg}`);

      // Pre-calculate distributions for each feed type BEFORE approval check
      const preCalculatedFeeds = [];
      for (const feedActivity of feedingActivities) {
        if (!feedActivity.quantity || !feedActivity.unit) {
          console.log(`Skipping feed without quantity/unit:`, feedActivity);
          continue;
        }
        
        console.log(`Pre-calculating feed: ${feedActivity.feed_type}, ${feedActivity.quantity} ${feedActivity.unit}`);
        
        // Convert units to kg using FIFO inventory lookup
        const weightPerUnit = await getLatestWeightPerUnit(
          supabase,
          farmId,
          feedActivity.feed_type,
          feedActivity.unit
        );
        
        // Require inventory match for bulk feeding
        if (!weightPerUnit) {
          throw new Error(
            `❌ Walang inventory entry para sa "${feedActivity.feed_type}" na naka-${feedActivity.unit}. Magdagdag muna ng inventory entry bago mag-record ng bulk feeding. / ` +
            `❌ No inventory entry found for "${feedActivity.feed_type}" in ${feedActivity.unit}. Please add an inventory entry before recording bulk feeding activities.`
          );
        }
        const totalKg = feedActivity.quantity * weightPerUnit;
        console.log(`✅ Used inventory weight: ${feedActivity.quantity} ${feedActivity.unit} = ${totalKg} kg (${weightPerUnit} kg/unit)`);
        
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
        
        preCalculatedFeeds.push({
          feed_type: feedActivity.feed_type,
          quantity: feedActivity.quantity,
          unit: feedActivity.unit,
          total_kg: totalKg,
          weight_per_unit: weightPerUnit,
          distributions,
          notes: feedActivity.notes
        });
      }

      // Check if this bulk feeding needs approval (with pre-calculated distributions)
      const animalIds = animals.map(a => a.id);
      const approvalCheck = await checkAndQueueForApproval(
        supabase,
        farmId,
        user.id,
        'feeding',
        {
          ...extractedData,
          multiple_feeds: true,
          feeds: preCalculatedFeeds  // ✅ Now includes distributions!
        },
        animalIds
      );

      if (approvalCheck.needsApproval) {
        console.log('Bulk feeding activity queued for manager approval with distributions');
        return new Response(
          JSON.stringify({
            success: true,
            queued: true,
            activity_type: 'feeding',
            message: 'Bulk feeding activity queued for manager approval',
            auto_approve_at: approvalCheck.autoApproveAt
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Insert records using pre-calculated distributions
      for (const feed of preCalculatedFeeds) {
        console.log(`Inserting feeding records for ${feed.feed_type}`);
        
        const recordDatetime = feed.notes?.includes('validated_datetime') 
          ? extractedData.validated_datetime 
          : new Date().toISOString();
        
        const insertPromises = feed.distributions.map(dist => 
          supabase.from('feeding_records').insert({
            animal_id: dist.animal_id,
            record_datetime: recordDatetime,
            feed_type: feed.feed_type,
            kilograms: dist.feed_amount,
            notes: `Bulk feeding - ${feed.quantity} ${feed.unit} distributed proportionally${feed.notes ? ': ' + feed.notes : ''}`,
            created_by: user.id
          })
        );

        await Promise.all(insertPromises);
        console.log(`✓ Inserted ${feed.distributions.length} feeding records for ${feed.feed_type}`);
      }
      
      console.log(`✓ Returning bulk feeding data with ${preCalculatedFeeds.length} feed types and inserted records`);
      
      return new Response(
        JSON.stringify({
          activity_type: 'feeding',
          multiple_feeds: true,
          total_animals: animals.length,
          total_weight_kg: totalWeightKg,
          feeds: preCalculatedFeeds
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

      // Calculate total weight FIRST (needed for distributions)
      const totalWeight = animals.reduce((sum, a) => sum + (a.current_weight_kg || 0), 0);
      console.log('Total weight:', totalWeight);

      // Calculate proportional distribution BEFORE approval check
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

      // Check if this bulk feeding needs approval (with distributions included)
      const animalIds = animals.map(a => a.id);
      const approvalCheck = await checkAndQueueForApproval(
        supabase,
        farmId,
        user.id,
        'feeding',
        {
          ...extractedData,
          is_bulk_feeding: true,
          total_kg: totalKg,
          weight_per_unit: weightPerUnit,
          distributions  // ✅ Now included!
        },
        animalIds
      );

      if (approvalCheck.needsApproval) {
        console.log('Bulk feeding activity queued for manager approval with distributions');
        return new Response(
          JSON.stringify({
            success: true,
            queued: true,
            activity_type: 'feeding',
            message: 'Bulk feeding activity queued for manager approval',
            auto_approve_at: approvalCheck.autoApproveAt
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
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
