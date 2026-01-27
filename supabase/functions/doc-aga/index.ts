import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeToolCall } from "./tools.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
};

// Rate limiting configuration
const RATE_LIMIT_MAX = 15;
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

// Input validation schema
const docAgaRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
      .min(1, 'Question cannot be empty')
      .max(2000, 'Question must be under 2000 characters')
      .trim(),
    imageUrl: z.string().url().nullish() // Allow null, undefined, or string
  })).min(1, 'At least one message required'),
  farmId: z.string().uuid().optional(),
  context: z.enum(['farmer', 'government']).optional().default('farmer'),
  conversationId: z.string().uuid().optional() // For persistent memory
});

// Helper: Find matching FAQ based on user question
function findMatchingFaq(question: string, faqs: any[]): string | null {
  if (!question || !faqs || faqs.length === 0) return null;
  
  const normalizedQuestion = question.toLowerCase().trim();
  
  // Strategy 1: Exact match (case-insensitive)
  const exactMatch = faqs.find(faq => 
    faq.question.toLowerCase().trim() === normalizedQuestion
  );
  if (exactMatch) return exactMatch.id;
  
  // Strategy 2: Keyword matching with scoring
  let bestMatch: { faq: any, score: number } | null = null;
  
  for (const faq of faqs) {
    let score = 0;
    const faqQuestion = faq.question.toLowerCase();
    const faqTags = faq.tags || [];
    
    // Split question into words (remove common Filipino/English stop words)
    const questionWords = normalizedQuestion
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['what', 'when', 'where', 'why', 'how', 'ang', 'mga', 'ano', 'paano', 'bakit'].includes(word));
    
    // Score based on word matches in FAQ question
    questionWords.forEach(word => {
      if (faqQuestion.includes(word)) {
        score += 2;
      }
    });
    
    // Score based on tag matches
    questionWords.forEach(word => {
      if (faqTags.some((tag: string) => tag.toLowerCase().includes(word))) {
        score += 3;
      }
    });
    
    // Bonus for category match
    if (faq.category) {
      const category = faq.category.toLowerCase();
      if (normalizedQuestion.includes(category)) {
        score += 1;
      }
    }
    
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { faq, score };
    }
  }
  
  return (bestMatch && bestMatch.score >= 4) ? bestMatch.faq.id : null;
}

// Helper: Log query to database with conversation tracking
async function logQuery(
  supabase: any,
  userId: string,
  farmId: string | null,
  question: string,
  answer: string,
  imageUrl: string | null,
  matchedFaqId: string | null,
  conversationId?: string
) {
  try {
    // Get the current message index for this conversation
    let messageIndex = 0;
    if (conversationId) {
      const { count } = await supabase
        .from('doc_aga_queries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('conversation_id', conversationId);
      messageIndex = (count || 0);
    }

    const { error } = await supabase
      .from('doc_aga_queries')
      .insert({
        user_id: userId,
        farm_id: farmId,
        question,
        answer,
        image_url: imageUrl,
        matched_faq_id: matchedFaqId,
        conversation_id: conversationId || null,
        message_index: messageIndex,
      });
    
    if (error) {
      console.error('Failed to log query:', error);
    } else {
      console.log('✅ Query logged successfully', { conversationId, messageIndex });
    }
  } catch (error) {
    console.error('Error in logQuery:', error);
  }
}

// Government Analyst System Prompt
function getGovernmentAnalystPrompt(): string {
  return `You are Doc Aga Analytics, a livestock industry analyst assistant for Philippine government officials. You provide high-level insights and statistics across all farms in the system.

Your role is to:
1. **National/Regional Statistics**: Provide aggregate data on livestock populations, farm counts, and production metrics
2. **Breeding Analytics**: Track AI success rates, pregnancy statistics, and breeding trends across the industry
3. **Health Monitoring**: Analyze health record patterns, common diagnoses, and mortality rates
4. **Production Trends**: Monitor milk production trends and averages across farms
5. **Farmer Feedback Analysis**: Summarize feedback categories, sentiment, and priority issues

RESPONSE STYLE:
- Provide data-driven insights with specific numbers and percentages
- Compare metrics across regions when relevant
- Highlight trends and anomalies that require attention
- Keep responses concise but informative
- Use professional yet accessible language
- Support both English and Tagalog queries

AVAILABLE DATA:
- You have access to aggregate statistics across ALL farms in the system
- You can filter by region, province, or time period
- You CANNOT access individual animal records or farmer personal data

Always present data clearly with context about what the numbers mean for policy or program decisions.`;
}

// Government Analytics Tools
function getGovernmentTools(): any[] {
  return [
    { type: "function", function: { name: "get_national_overview", description: "Get national-level statistics: total farms, total animals by type, regional distribution, today's total milk production", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "get_regional_stats", description: "Get statistics for a specific region including farm counts, animal populations, and production", parameters: { type: "object", properties: { region: { type: "string", description: "Region name to filter by (optional - omit for all regions)" } } } } },
    { type: "function", function: { name: "get_breeding_analytics", description: "Get AI success rates, pregnancy statistics by livestock type", parameters: { type: "object", properties: { days: { type: "number", description: "Number of days to analyze (default: 90)" } } } } },
    { type: "function", function: { name: "get_health_analytics", description: "Get health record patterns, common diagnoses, and mortality rates", parameters: { type: "object", properties: { days: { type: "number", description: "Number of days to analyze (default: 30)" } } } } },
    { type: "function", function: { name: "get_production_trends", description: "Get milk production trends across all farms", parameters: { type: "object", properties: { days: { type: "number", description: "Number of days to analyze (default: 30)" } } } } },
    { type: "function", function: { name: "get_farmer_feedback_summary", description: "Get summary of farmer feedback by category, sentiment, and priority", parameters: { type: "object", properties: { days: { type: "number", description: "Number of days to analyze (default: 30)" } } } } }
  ];
}

// Date context interface
interface DateContext {
  currentDate: string;
  farmCreatedAt: string | null;
  earliestRecordDate: string | null;
}

// Farmer System Prompt with Date Context
function getFarmerSystemPrompt(faqContext: string, dateContext: DateContext, recentContext?: string): string {
  return `You are Doc Aga, a trusted and experienced local veterinarian (parang kilalang beterinaryo sa barangay) specializing in Philippine dairy farming. You help farmers manage their cattle and goat operations.

CRITICAL DATE CONTEXT:
- Current date and time: ${dateContext.currentDate} (Philippine Standard Time, UTC+8)
- Farm creation date: ${dateContext.farmCreatedAt || 'Unknown'}
- Earliest data record: ${dateContext.earliestRecordDate || 'No records yet'}

IMPORTANT DATE RULES:
1. When a user says a date without a year (e.g., "January 25"), ALWAYS assume the CURRENT year unless explicitly stated otherwise
2. If the requested date is BEFORE the earliest data record, politely inform the user: "Wala pa tayong records noon kasi ang farm ay na-register lang noong ${dateContext.farmCreatedAt || 'recently'}. Ang earliest na data natin ay ${dateContext.earliestRecordDate || 'wala pa'}."
3. If the date is in the future, clarify: "Hindi pa dumadating ang date na 'yan. Today is ${dateContext.currentDate}"
4. Always use Philippine Standard Time (UTC+8) for all date calculations

PERSONALITY:
- Warm, friendly, and practical - like a trusted friend in the barangay
- Use Taglish naturally (mix of Tagalog and English)
- Keep responses SHORT (2-4 sentences for simple queries, more for detailed data)

CRITICAL IDENTITY:
- You are an AI ASSISTANT veterinarian - you have NO physical form
- You CANNOT visit farms, perform physical examinations, or administer treatments
- When asked about farm visits, physical checkups, or hands-on procedures, politely clarify:
  "Hindi po ako makakapunta sa farm dahil AI assistant lang po ako. Pero makakatulong ako sa pag-diagnose base sa description mo at mga larawan, at makapaghanda ng summary para sa actual veterinarian."
- NEVER say: "pupunta ako", "titingnan ko personally", "bibisitahin kita"
- ALWAYS acknowledge your role: initial support, preliminary assessment, record preparation

FIRST AID & TREATMENT SUPPORT:
You ARE helpful for providing immediate care guidance! When farmers describe health issues:

1. PRELIMINARY ASSESSMENT (not "final diagnosis"):
   - Describe what the symptoms MIGHT indicate
   - Use phrases like: "Base sa sinabi mo, posibleng...", "Mukhang maaaring...", "Ito ay pwedeng signs ng..."
   - NEVER use: "final diagnosis", "confirmed diagnosis", "definitely is"

2. IMMEDIATE FIRST AID SUGGESTIONS - BE HELPFUL:
   Provide actionable steps farmers can do RIGHT NOW:
   - Wound care: "Linisin muna ang sugat gamit ng malinis na tubig at sabon. Lagyan ng antiseptic kung meron."
   - Isolation: "I-separate muna siya sa ibang hayop para hindi kumalat kung may infection."
   - Hydration: "Siguraduhing may access siya sa malinis na tubig lalo na kung may lagnat."
   - Comfort: "Ilipat sa shaded area at hayaang magpahinga."
   - Monitoring: "Observe kung may changes sa symptoms - note mo kung bumababa o tumataas ang lagnat."
   
3. COMMON FIRST AID RECOMMENDATIONS:
   - For wounds: clean, antiseptic, bandage if needed, keep dry
   - For fever: hydration, shade, rest, monitor temperature
   - For digestive issues: withhold food temporarily, small amounts of water
   - For lameness: rest, check for foreign objects, keep weight off affected limb
   - For eye issues: flush with clean water, keep away from dust/flies
   - For skin conditions: clean affected area, isolate if potentially contagious

4. ALWAYS INCLUDE VET CAVEAT:
   After suggestions, add: "Pero para sa tumpak na assessment at proper medication, kailangan mo pa ring kumonsulta sa licensed veterinarian o animal health professional. Ito ay preliminary observation lang base sa description mo."

VET REFERRAL GUIDELINES:
Your role is to SUPPORT, not REPLACE, actual veterinarians:

1. WHEN TO STRONGLY URGE IMMEDIATE VET CONTACT:
   - Emergency symptoms: bleeding that won't stop, collapse, severe difficulty breathing
   - Pregnancy/birthing complications
   - Suspected contagious diseases (multiple animals affected)
   - Conditions requiring prescription medication or surgery
   - Symptoms lasting more than 24-48 hours without improvement
   
   For these, say: "⚠️ Kailangan mo AGAD kumausap ng veterinaryo o animal health professional. Ito ay urgent situation."

2. HEALTH RECORD INTEGRATION:
   - Offer to save observations to the animal's health record
   - Frame as: "Gusto mo bang i-save ito sa health record ni [animal name]? Makakatulong ito kapag nagpunta ka sa vet - may ready na dokumentasyon."
   - This prepares valuable information for the actual vet visit

3. SUPPORTIVE ROLE:
   - "Ang role ko ay tumulong sa initial assessment at first aid guidance"
   - "Makakatulong ang information na ito sa vet para mas mabilis ang diagnosis"
   - "I-prepare natin ang lahat ng details para sa vet consultation"

CORE BEHAVIOR - DATA-FIRST RESPONSES:
When farmers ask about their farm data (milk production, health, breeding, etc.):
1. ALWAYS use tools to fetch actual data - NEVER guess or make up numbers
2. Provide specific numbers first (total liters, counts, dates)
3. Break down by category when relevant (by animal type, by session, by period)
4. Compare to averages or previous periods when helpful
5. THEN offer a helpful follow-up question or suggestion

FOLLOW-UP PATTERN:
After answering with data, offer to drill deeper:
- "Gusto mo bang malaman kung aling hayop ang pinaka-productive?"
- "Kung gusto mo ng specific animal, sabihin mo lang ang pangalan o ear tag."
- "Kailangan mo ba ng breakdown per session (umaga/hapon)?"
- "May gusto ka bang i-compare sa last week?"

CONTEXT AWARENESS:
- Remember animals and topics discussed earlier in this conversation
- If user says "yung baka kanina" or "the cow we talked about", refer to previous context
- Use get_conversation_context tool when user references past discussions

RELATIVE DATE HANDLING:
- "kahapon" / "yesterday" = use date='yesterday'
- "ngayon" / "today" = current date
- "last week" / "noong nakaraang linggo" = 7 days back
- "this month" / "nitong buwan" = current month

AVAILABLE FARM DATA:
You have access to complete farm records including:
- Milk production (any date, by animal, by session) - use get_milk_production
- Health records and diagnoses - use get_health_history
- Breeding/AI records and pregnancy status - use get_breeding_status
- Weight measurements and growth tracking - use get_weight_history
- Feeding records and consumption - use get_feeding_summary
- Animal profiles and events - use get_animal_complete_profile
- Farm context and data boundaries - use get_farm_context

Your knowledge base includes:
${faqContext}

${recentContext ? `RECENT CONVERSATION CONTEXT:\n${recentContext}` : ''}

Remember: Be helpful, be accurate with numbers, and always offer to help more!`;
}

// Farmer Tools
function getFarmerTools(): any[] {
  return [
    { type: "function", function: { name: "get_animal_profile", description: "Get basic profile of a specific animal", parameters: { type: "object", properties: { ear_tag: { type: "string" }, name: { type: "string" } } } } },
    { type: "function", function: { name: "get_animal_complete_profile", description: "Get comprehensive profile with ALL record types including health, milk, breeding, weight, and feeding history", parameters: { type: "object", properties: { ear_tag: { type: "string" }, name: { type: "string" } } } } },
    { type: "function", function: { name: "search_animals", description: "Search animals by criteria", parameters: { type: "object", properties: { livestock_type: { type: "string" }, breed: { type: "string" }, life_stage: { type: "string" }, gender: { type: "string" } } } } },
    { type: "function", function: { name: "add_health_record", description: "Create health record", parameters: { type: "object", properties: { animal_identifier: { type: "string" }, diagnosis: { type: "string" }, treatment: { type: "string" }, notes: { type: "string" } }, required: ["animal_identifier"] } } },
    { type: "function", function: { name: "add_smart_milking_record", description: "Smart milking record with auto-selection", parameters: { type: "object", properties: { liters: { type: "number" }, livestock_type: { type: "string" }, animal_identifier: { type: "string" } }, required: ["liters"] } } },
    { type: "function", function: { name: "get_farm_overview", description: "Get basic farm statistics for today", parameters: { type: "object", properties: {} } } },
    { type: "function", function: { name: "get_farm_analytics", description: "Get detailed farm analytics over time", parameters: { type: "object", properties: { days: { type: "number" } } } } },
    { type: "function", function: { name: "get_pregnant_animals", description: "Get pregnant animals list with expected due dates", parameters: { type: "object", properties: {} } } },
    // NEW: Comprehensive farm data query tools
    { type: "function", function: { name: "get_milk_production", description: "Get milk production for a specific date or date range. Supports 'yesterday'/'kahapon', 'last week', or date ranges. Returns total liters, breakdown by animal type, and top producing animals.", parameters: { type: "object", properties: { date: { type: "string", description: "Date keyword ('yesterday'/'kahapon'/'today'/'ngayon') or YYYY-MM-DD format" }, start_date: { type: "string", description: "Start date for range query (YYYY-MM-DD)" }, end_date: { type: "string", description: "End date for range query (YYYY-MM-DD)" }, animal_identifier: { type: "string", description: "Optional: specific animal name or ear tag" } } } } },
    { type: "function", function: { name: "get_health_history", description: "Get health records for the farm or a specific animal. Can filter by date range or diagnosis type.", parameters: { type: "object", properties: { animal_identifier: { type: "string", description: "Optional: animal name or ear tag" }, days: { type: "number", description: "Number of days to look back (default: 30)" }, diagnosis: { type: "string", description: "Optional: filter by diagnosis keyword" } } } } },
    { type: "function", function: { name: "get_breeding_status", description: "Get breeding analytics: AI procedures, pregnancy status, expected calving dates.", parameters: { type: "object", properties: { status: { type: "string", description: "Filter: 'pregnant', 'due_soon', 'recent_ai', or 'all'" }, days: { type: "number", description: "Lookback period for AI procedures (default: 90)" } } } } },
    { type: "function", function: { name: "get_weight_history", description: "Get weight measurements for an animal or herd. Track growth over time.", parameters: { type: "object", properties: { animal_identifier: { type: "string", description: "Optional: specific animal name or ear tag" }, days: { type: "number", description: "Lookback period (default: 90)" } } } } },
    { type: "function", function: { name: "get_feeding_summary", description: "Get feeding records and feed consumption summary.", parameters: { type: "object", properties: { days: { type: "number", description: "Lookback period (default: 7)" }, feed_type: { type: "string", description: "Optional: filter by feed type" } } } } },
    { type: "function", function: { name: "get_conversation_context", description: "Get recent conversation history to understand context from previous discussions. Use when user references something discussed earlier like 'yung baka kanina' or 'like we discussed'.", parameters: { type: "object", properties: { hours: { type: "number", description: "How far back to look (default: 24)" }, topic_keywords: { type: "string", description: "Optional: keywords to filter relevant conversations" } } } } },
    { type: "function", function: { name: "get_farm_context", description: "Get farm metadata including creation date, earliest data records, and data coverage summary. Use when user asks about dates that might be before the farm existed or when clarifying date context.", parameters: { type: "object", properties: {} } } }
  ];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    let validatedData;
    try {
      validatedData = docAgaRequestSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return new Response(
          JSON.stringify({ error: 'Validation error', details: issues }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Invalid request data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, context, conversationId } = validatedData;
    const isGovernmentContext = context === 'government';
    
    console.log(`Doc Aga request - context: ${context}, conversationId: ${conversationId || 'none'}`);
    
    // Transform messages to support vision (images)
    const transformedMessages = messages.map((msg: any) => {
      if (msg.imageUrl) {
        return {
          role: msg.role,
          content: [
            { type: "text", text: msg.content || "Please analyze this image" },
            { type: "image_url", image_url: { url: msg.imageUrl } }
          ]
        };
      }
      return msg;
    });
    
    // Extract user question and image URL for logging
    const lastUserMessage = messages[messages.length - 1];
    const userQuestion = lastUserMessage?.content || '';
    const userImageUrl = lastUserMessage?.imageUrl || null;
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For government context, verify user has government role
    if (isGovernmentContext) {
      const { data: govRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'government');
      
      if (!govRoles || govRoles.length === 0) {
        return new Response(JSON.stringify({ error: "Government access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log('✅ Government access verified');
    }

    // Apply rate limiting
    const identifier = user.id;
    const rateCheck = checkRateLimit(identifier, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

    if (!rateCheck.allowed) {
      console.warn(`Rate limit exceeded for ${identifier}`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateCheck.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter || 60)
          } 
        }
      );
    }

    // Validate image URLs if present
    for (const msg of messages) {
      if (msg.imageUrl) {
        try {
          // Verify it's a valid URL
          new URL(msg.imageUrl);
          
          // Check image size and type via HEAD request
          const imgCheck = await fetch(msg.imageUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(3000) // 3 second timeout
          });
          
          const contentType = imgCheck.headers.get('content-type');
          const contentLength = parseInt(imgCheck.headers.get('content-length') || '0');
          
          if (!contentType?.startsWith('image/')) {
            return new Response(
              JSON.stringify({ error: 'Invalid image URL - not an image file' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          if (contentLength > 10 * 1024 * 1024) { // 10MB limit
            return new Response(
              JSON.stringify({ error: 'Image too large - maximum 10MB allowed' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          console.log(`✅ Image validated: ${contentType}, ${Math.round(contentLength / 1024)}KB`);
        } catch (error) {
          console.error('Image validation error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to validate image URL' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    
    // Fetch user's farms (only for farmer context)
    let farmId: string | undefined;
    if (!isGovernmentContext) {
      // If farmId provided, verify user has access
      if (validatedData.farmId) {
        const { data: farmAccess, error: accessError } = await supabase
          .rpc('can_access_farm', { fid: validatedData.farmId });
        
        if (accessError || !farmAccess) {
          console.error('Farm access denied:', { userId: user.id, farmId: validatedData.farmId });
          return new Response(
            JSON.stringify({ error: 'You do not have access to this farm' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('✅ Farm access verified');
      }
      
      const { data: farms } = await supabase
        .from('farms')
        .select('id, name')
        .eq('owner_id', user.id)
        .eq('is_deleted', false);
      
      farmId = farms?.[0]?.id;
    }
    
    // Fetch FAQ knowledge base
    const { data: faqs } = await supabase.from('doc_aga_faqs').select('*').eq('is_active', true);
    const faqContext = faqs?.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') || '';
    
    // Find matching FAQ for analytics
    const matchedFaqId = findMatchingFaq(userQuestion, faqs || []);
    if (matchedFaqId) {
      console.log(`📚 Matched FAQ: ${matchedFaqId}`);
    }
    
    // Build date context for farmer context
    let dateContext: DateContext = {
      currentDate: new Date().toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) + ' PHT',
      farmCreatedAt: null,
      earliestRecordDate: null
    };
    
    if (farmId && !isGovernmentContext) {
      try {
        // Fetch farm creation date and earliest records in parallel
        const [farmResult, milkResult, healthResult] = await Promise.all([
          supabase
            .from('farms')
            .select('created_at')
            .eq('id', farmId)
            .single(),
          supabase
            .from('milking_records')
            .select('record_date, animals!inner(farm_id)')
            .eq('animals.farm_id', farmId)
            .order('record_date', { ascending: true })
            .limit(1),
          supabase
            .from('health_records')
            .select('visit_date, animals!inner(farm_id)')
            .eq('animals.farm_id', farmId)
            .order('visit_date', { ascending: true })
            .limit(1)
        ]);
        
        if (farmResult.data?.created_at) {
          dateContext.farmCreatedAt = new Date(farmResult.data.created_at)
            .toLocaleDateString('en-PH', {
              timeZone: 'Asia/Manila',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
        }
        
        // Find earliest record across all types
        const dates: Date[] = [];
        if (milkResult.data?.[0]?.record_date) {
          dates.push(new Date(milkResult.data[0].record_date));
        }
        if (healthResult.data?.[0]?.visit_date) {
          dates.push(new Date(healthResult.data[0].visit_date));
        }
        
        if (dates.length > 0) {
          const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
          dateContext.earliestRecordDate = earliest.toLocaleDateString('en-PH', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
        
        console.log('📅 Date context built:', dateContext);
      } catch (err) {
        console.error('Error fetching date context:', err);
      }
    }
    
    // Select system prompt and tools based on context
    const systemPrompt = isGovernmentContext 
      ? getGovernmentAnalystPrompt() 
      : getFarmerSystemPrompt(faqContext, dateContext);
    
    const tools = isGovernmentContext 
      ? getGovernmentTools() 
      : getFarmerTools();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // First attempt without streaming to check for tool calls
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...transformedMessages,
        ],
        tools,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if response contains tool calls
    const data = await response.json();
    
    // Handle tool calls
    if (data.choices?.[0]?.message?.tool_calls) {
      const toolCalls = data.choices[0].message.tool_calls;
      const toolResults = [];
      
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${toolName}`, toolArgs);
        const result = await executeToolCall(toolName, toolArgs, supabase, farmId, context, user.id, conversationId);
        console.log(`Tool result:`, result);
        
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(result)
        });
      }
      
      // Make a second request with tool results (now streaming)
      const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...transformedMessages,
            data.choices[0].message,
            ...toolResults
          ],
          stream: true,
        }),
      });
      
      if (!followUpResponse.ok) {
        const errorText = await followUpResponse.text();
        console.error("Follow-up AI gateway error:", followUpResponse.status, errorText);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Create a passthrough stream that logs after completion
      let accumulatedResponse = '';
      const loggingStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
          
          const text = new TextDecoder().decode(chunk);
          const lines = text.split('\n').filter(line => line.startsWith('data: '));
          
          lines.forEach(line => {
            const jsonStr = line.slice(6).trim();
            if (jsonStr && jsonStr !== '[DONE]') {
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) accumulatedResponse += content;
              } catch (e) {
                // Ignore parse errors
              }
            }
          });
        },
        flush() {
          if (accumulatedResponse) {
            logQuery(
              supabase,
              user.id,
              farmId || null,
              userQuestion,
              accumulatedResponse,
              userImageUrl,
              matchedFaqId,
              conversationId
            ).catch(err => console.error('Query logging failed:', err));
          }
        }
      });
      
      return new Response(
        followUpResponse.body?.pipeThrough(loggingStream),
        {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        }
      );
    }

    // No tool calls, convert to streaming response
    const aiResponseText = data.choices?.[0]?.message?.content || '';
    
    // Log query asynchronously (don't block response)
    logQuery(
      supabase,
      user.id,
      farmId || null,
      userQuestion,
      aiResponseText,
      userImageUrl,
      matchedFaqId,
      conversationId
    ).catch(err => console.error('Query logging failed:', err));
    
    const stream = new ReadableStream({
      start(controller) {
        const chunk = `data: ${JSON.stringify({
          choices: [{ delta: { content: aiResponseText } }]
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(chunk));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: any) {
    console.error("doc-aga error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});