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
  farmId: z.string().uuid().optional()
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

// Helper: Log query to database
async function logQuery(
  supabase: any,
  userId: string,
  farmId: string | null,
  question: string,
  answer: string,
  imageUrl: string | null,
  matchedFaqId: string | null
) {
  try {
    const { error } = await supabase
      .from('doc_aga_queries')
      .insert({
        user_id: userId,
        farm_id: farmId,
        question,
        answer,
        image_url: imageUrl,
        matched_faq_id: matchedFaqId,
      });
    
    if (error) {
      console.error('Failed to log query:', error);
    } else {
      console.log('✅ Query logged successfully');
    }
  } catch (error) {
    console.error('Error in logQuery:', error);
  }
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

    const { messages } = validatedData;
    
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
    
    // Fetch user's farms
    const { data: farms } = await supabase
      .from('farms')
      .select('id, name')
      .eq('owner_id', user.id)
      .eq('is_deleted', false);
    
    const farmId = farms?.[0]?.id;
    
    // Fetch FAQ knowledge base
    const { data: faqs } = await supabase.from('doc_aga_faqs').select('*').eq('is_active', true);
    const faqContext = faqs?.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') || '';
    
    // Find matching FAQ for analytics
    const matchedFaqId = findMatchingFaq(userQuestion, faqs || []);
    if (matchedFaqId) {
      console.log(`📚 Matched FAQ: ${matchedFaqId}`);
    }
    
    const systemPrompt = `You are Doc Aga, a trusted and experienced local veterinarian (parang kilalang beterinaryo sa barangay) specializing in Philippine dairy farming. You help farmers manage their cattle operations by:

1. **Answering Questions**: Provide advice on animal health, breeding, nutrition, and farm management based on the FAQ knowledge base and general veterinary practices
2. **Accessing Records**: Look up complete animal profiles including health, milking, AI, events, feeding, and injection records
3. **Logging Data**: Create health, milking, AI, event, feeding, and injection records
4. **Farm Analytics**: Provide detailed statistics, trends, and insights about farm performance
5. **Breeding Management**: Track pregnant animals, AI records, and breeding events
6. **Historical Data**: Access daily and monthly farm statistics for trend analysis

INTENT CLASSIFICATION:
Before responding, classify the user's intent as ONE of:
- "query" - Asking questions, seeking information, advice (e.g., "Paano mag-alaga ng pregnant na baka?")
- "instruction" - Recording activities like milking, feeding, health events (e.g., "Tinurukan ko si 001 ng antibiotics")
- "data_entry" - Adding structured data like expenses, weights, notes (e.g., "Gusto kong i-log ang timbang")
- "alert" - Creating reminders or notifications (e.g., "Paalala sa akin bukas ng tanghali")
- "analytics" - Requesting reports, insights, trends (e.g., "Anong trend ng milk production ngayong buwan?")

Include your classification in your first response using the format:
[INTENT: {intent_type}]

Examples:
- "Gaano karaming gatas ngayong araw?" → [INTENT: query]
- "Tinurukan ko si 001 ng antibiotics" → [INTENT: instruction]
- "Gusto ko malaman ang milk production trend" → [INTENT: analytics]
- "Paalala sa akin bukas na mag-deworm" → [INTENT: alert]

Your knowledge base includes:
${faqContext}

FILIPINO FARMING VOCABULARY (for better understanding):
Common terms you should recognize:
- Animals: "baka"=cow, "toro"=bull, "guya"=dairy cow, "nag gagatas"=milking/lactating, "buntis"=pregnant
- Feed: "dayami"=rice straw, "mais"=corn, "darak"=rice bran, "concentrates"=pellets, "pulot"=molasses
- Health: "may sakit"=sick, "lagnat"=fever, "ubo"=cough, "trangkaso"=flu, "pamamaga"=swelling
- Breeding: "buntis"=pregnant, "nanganak"=gave birth, "pagpapaanak"=calving, "AI"=artificial insemination
- Activities: "paggatas"=milking, "pagpapakain"=feeding, "pagturuk"=injection, "pagbakunat"=vaccination
- Time: "kahapon"=yesterday, "ngayon"=now/today, "kanina"=earlier, "kamakalawa"=2 days ago
- Bisaya: "gabie"=yesterday, "karon"=now, "papakaon"=feeding, "pagatas"=milking

PREFERRED TERMINOLOGY (use these consistently):
- Instead of "laktating cow" → always use "nag gagatas na baka"
- For nutrition topics → refer to experts as "Nutritionist" (not "livestock specialist")
- Keep language natural and accessible to Filipino farmers

When users use these Filipino terms, understand them correctly and respond naturally in Filipino.

CRITICAL LANGUAGE INSTRUCTIONS:
- **ALWAYS respond in Tagalog (Filipino) by default** - this is your primary language
- Match the language of the user's question - if they ask in Tagalog, respond in Tagalog; if in English, respond in English
- Use English only for technical terms that have no direct Tagalog translation (e.g., specific medical terms, scientific names)
- Keep explanations natural and conversational in Tagalog
- For mixed language questions, prioritize Tagalog in your response

VOICE & TONE (Critical - Follow This Always):
- Sound like a seasoned local vet the farmer has known for years—warm, patient, and respectful
- Treat farmers as valued partners, not just clients
- Magsalita ng simple at direkta, parang kausap mo ang kaibigan
- Use everyday language—avoid jargon unless absolutely necessary
- When you must use technical terms, immediately explain them simply (e.g., "mastitis o pamamaga ng utong")
- **Never over-promise or guarantee outcomes**—be realistic and honest about what's possible
- Kung hindi ka sigurado, sabihin mo—huwag mag-imbento ng sagot
- Para sa seryosong problema, i-recommend ang propesyonal na beterinaryo agad

RESPONSE STRUCTURE (Keep It SHORT & PRACTICAL):
- **ALWAYS keep responses SHORT and CONCISE**—aim for 2-4 sentences for simple questions
- Start with the most important action first: "Ito ang gagawin mo ngayon..."
- Break complex advice into numbered steps (1, 2, 3...) for clarity
- Avoid long paragraphs—use line breaks to make text easier to read
- Focus on "what to do now" rather than lengthy background explanations
- Example tone: "Mukhang may mastitis ang baka mo. Ito ang gagawin: 1) Linisin ang utong, 2) Huwag muna paggatasin, 3) Tumawag ng vet kung hindi gumaling sa 2 araw."

Guidelines:
- Use the FAQ knowledge base to answer common questions accurately
- When users report health issues or treatments, offer to create health records
- When users mention milk production, offer to log milking records
- For breeding-related queries, access AI records and pregnancy events
- Provide data-driven insights using farm analytics and historical trends
- All records are automatically timestamped with the current date in Philippine timezone - you don't need to ask for dates
- Provide clear, practical advice based on proven farming practices and actual farm data
- Remember the context of previous messages to maintain continuity`;

    const tools = [
      {
        type: "function",
        function: {
          name: "get_animal_profile",
          description: "Get basic profile of a specific animal with recent health and milking records only",
          parameters: {
            type: "object",
            properties: {
              ear_tag: { type: "string", description: "Animal ear tag number" },
              name: { type: "string", description: "Animal name (partial match supported)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_animal_complete_profile",
          description: "Get comprehensive profile with ALL record types: health, milking, AI, events, feeding, injections, and parentage info",
          parameters: {
            type: "object",
            properties: {
              ear_tag: { type: "string", description: "Animal ear tag number" },
              name: { type: "string", description: "Animal name (partial match supported)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_animals",
          description: "Search for animals by breed, stage, gender, or other criteria",
          parameters: {
            type: "object",
            properties: {
              breed: { type: "string", description: "Animal breed" },
              life_stage: { type: "string", description: "Life stage (calf, heifer, lactating, dry, etc.)" },
              milking_stage: { type: "string", description: "Milking stage" },
              gender: { type: "string", description: "Gender (male/female)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_health_record",
          description: "Create a new health record for an animal. The date is automatically set to current Philippine time.",
          parameters: {
            type: "object",
            properties: {
              animal_identifier: { type: "string", description: "Animal ear tag or name" },
              diagnosis: { type: "string", description: "Health diagnosis or condition" },
              treatment: { type: "string", description: "Treatment administered" },
              notes: { type: "string", description: "Additional notes" }
            },
            required: ["animal_identifier"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_milking_record",
          description: "Log milk production for an animal. The date is automatically set to current Philippine time.",
          parameters: {
            type: "object",
            properties: {
              animal_identifier: { type: "string", description: "Animal ear tag or name" },
              liters: { type: "number", description: "Liters of milk produced" }
            },
            required: ["animal_identifier", "liters"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_ai_record",
          description: "Create an artificial insemination (AI) record for an animal. Date is automatically set to current Philippine time.",
          parameters: {
            type: "object",
            properties: {
              animal_identifier: { type: "string", description: "Animal ear tag or name" },
              technician: { type: "string", description: "Name of AI technician" },
              notes: { type: "string", description: "Additional notes about the AI procedure" }
            },
            required: ["animal_identifier"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_animal_event",
          description: "Create an animal event (pregnancy_confirmed, calving, etc.). Date is automatically set to current Philippine time.",
          parameters: {
            type: "object",
            properties: {
              animal_identifier: { type: "string", description: "Animal ear tag or name" },
              event_type: { type: "string", enum: ["pregnancy_confirmed", "calving", "weaning", "heat_detected"], description: "Type of event" },
              notes: { type: "string", description: "Additional notes" }
            },
            required: ["animal_identifier", "event_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_feeding_record",
          description: "Create a feeding record for an animal. Time is automatically set to current Philippine time.",
          parameters: {
            type: "object",
            properties: {
              animal_identifier: { type: "string", description: "Animal ear tag or name" },
              feed_type: { type: "string", description: "Type of feed given" },
              kilograms: { type: "number", description: "Amount of feed in kilograms" },
              notes: { type: "string", description: "Additional notes" }
            },
            required: ["animal_identifier"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_injection_record",
          description: "Create an injection/vaccine record for an animal. Time is automatically set to current Philippine time.",
          parameters: {
            type: "object",
            properties: {
              animal_identifier: { type: "string", description: "Animal ear tag or name" },
              medicine_name: { type: "string", description: "Name of medicine or vaccine" },
              dosage: { type: "string", description: "Dosage administered" },
              instructions: { type: "string", description: "Special instructions or notes" }
            },
            required: ["animal_identifier"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_farm_overview",
          description: "Get basic farm statistics: animal counts by stage and today's milk production",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_farm_analytics",
          description: "Get detailed farm analytics including daily/monthly stats and milk production trends over a period",
          parameters: {
            type: "object",
            properties: {
              days: { type: "number", description: "Number of days to analyze (default: 30)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_pregnant_animals",
          description: "Get list of all currently pregnant animals (pregnancy confirmed but no calving yet)",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_recent_events",
          description: "Get recent farm events (calvings, pregnancies, heat detection, weaning)",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Maximum number of events to return (default: 20)" }
            }
          }
        }
      }
    ];

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
        const result = await executeToolCall(toolName, toolArgs, supabase, farmId);
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
              farms?.[0]?.id || null,
              userQuestion,
              accumulatedResponse,
              userImageUrl,
              matchedFaqId
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
      farms?.[0]?.id || null,
      userQuestion,
      aiResponseText,
      userImageUrl,
      matchedFaqId
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