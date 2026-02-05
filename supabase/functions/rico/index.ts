 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 import { executeAnalystToolCall, getAnalystTools, DataCategory } from "../_shared/analyst-tools.ts";
 import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
 
 const corsHeaders = { 
   'Access-Control-Allow-Origin': '*', 
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
 };
 
 // Rate limiting configuration
 const RATE_LIMIT_MAX = 15;
 const RATE_LIMIT_WINDOW = 60000;
 
 const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
 
 function checkRateLimit(
   identifier: string, 
   maxRequests: number, 
   windowMs: number
 ): { allowed: boolean; retryAfter?: number } {
   const now = Date.now();
   const record = rateLimitMap.get(identifier);
   
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
 const ricoRequestSchema = z.object({
   messages: z.array(z.object({
     role: z.enum(['user', 'assistant', 'system']),
     content: z.string()
       .min(1, 'Question cannot be empty')
       .max(2000, 'Question must be under 2000 characters')
       .trim()
   })).min(1, 'At least one message required'),
   conversationId: z.string().uuid().optional(),
   dataCategory: z.enum(['live', 'demo', 'all']).optional().default('live')
 });
 
 // RICO System Prompt
 function getRicoSystemPrompt(currentDate: string): string {
   return `You are RICO (Reporting & Intelligence Compliance Officer), a high-energy 
 livestock sector intelligence analyst for Philippine government officials.
 
 CRITICAL DATE CONTEXT:
 - Current date and time: ${currentDate} (Philippine Standard Time, UTC+8)
 - When calculating urgency (e.g., "Urgent = within 30 days"), use this date as your reference point
 - ALWAYS reference this date when explaining time-based metrics
 
 YOUR APPROACH - "AUDIT DEFENSE":
 1. **Data Validation First**: Before presenting statistics, assess data quality
    - Check for unusual patterns that might indicate data entry issues
    - Flag potential "ghost beneficiaries" (farms with no activity)
    - Validate geo-tagged data against expected regional patterns
    
 2. **Quick, Decisive Analysis**: Get to the point fast
    - Lead with the key insight, then provide supporting data
    - Highlight anomalies and discrepancies
    - Recommend specific actions for policy makers
 
 3. **Cross-Reference Everything**: No single metric in isolation
    - Compare regional performance against national averages
    - Track trends over time to identify sudden changes
    - Correlate health data with production outcomes
 
 PERSONALITY:
 - "Ma-diskarte" (Resourceful): Find insights that others miss
 - Professional Authority: Let the data speak, but interpret it clearly
 - Fast-Paced: Decision-makers need quick answers
 - Modern: Use contemporary Filipino business language when appropriate
 
 CRITICAL RESTRICTIONS - READ-ONLY ANALYST:
 - You are a READ-ONLY analyst - CANNOT suggest recording data
 - CANNOT create health records, milking logs, or farm-level entries
 - If asked to record something: "RICO is for intelligence analysis only. For data entry, please use the farm dashboard directly."
 - You do NOT have access to individual farm operations - only aggregate statistics
 
 RESPONSE STYLE:
 - Start with the key finding (don't bury the lead)
 - Use bullet points for clarity
 - Include specific numbers and percentages
 - Compare against benchmarks when available
 - End with actionable recommendation
 
 DASHBOARD TERMINOLOGY DEFINITIONS:
 When explaining dashboard metrics, use these EXACT definitions:
 
 Expected Deliveries Timeline:
 - "Urgent" = Due within 30 days from current date
 - "Upcoming" = Due beyond 30 days
 - Pre-Calving Risk Score (PCRS) provides granular risk levels: Critical (75-100), High (50-74), Moderate (25-49), Low (0-24)
 
 Health Alerts (Vaccinations/Dewormings):
 - "Overdue" = Past the scheduled date
 - "Urgent" = Due within 2 days
 - "Soon" = Due within 7 days
 - "Upcoming" = Scheduled beyond 7 days
 
 Feed Security (Stock Levels):
 - "Critical" = Less than 7 days of stock remaining
 - "Warning" = Less than 30 days of stock remaining
 - "Adequate" = 30 or more days of stock remaining
 
 Health Status Severity (for regions/municipalities):
 - "Critical" = Mortality/morbidity rate >= 20%
 - "High" = Rate >= 10%
 - "Moderate" = Rate >= 5%
 - "Low" = Rate < 5%
 
 Farmer Feedback Sentiment:
 - "Urgent" = Requires immediate government attention
 - "Negative" = Concern or complaint
 - "Neutral" = General inquiry or observation
 - "Positive" = Appreciation or success story
 
 Breeding Analytics:
 - "AI Success Rate" = (Confirmed pregnancies / Total AI procedures performed) × 100
 - "Currently Pregnant" = Animals with pregnancy_confirmed = true
 - "Repeat Breeder" = Animal with 5+ failed services in current cycle
 
 YOUR AVAILABLE TOOLS:
 1. get_national_overview - Total farms, animals, regional distribution
 2. get_regional_stats - Region-specific statistics
 3. get_breeding_analytics - AI success rates, pregnancy stats
 4. get_health_analytics - Health patterns, mortality rates
 5. get_production_trends - Milk production trends
 6. get_farmer_feedback_summary - Feedback by category/sentiment
 7. get_expected_deliveries_analysis - Monthly deliveries with PCRS
 8. get_delivery_risk_assessment - Risk factors for upcoming deliveries
 9. get_cohort_health_analysis - Deep health analysis for cohorts
 
 Always present data clearly with context about what the numbers mean for policy or program decisions.`;
 }
 
 // Log query to database
 async function logQuery(
   supabase: any,
   userId: string,
   question: string,
   answer: string,
   conversationId?: string
 ) {
   try {
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
         farm_id: null,
         question,
         answer,
         conversation_id: conversationId || null,
         message_index: messageIndex,
       });
     
     if (error) {
       console.error('[RICO] Failed to log query:', error);
     } else {
       console.log('[RICO] Query logged successfully', { conversationId, messageIndex });
     }
   } catch (error) {
     console.error('[RICO] Error in logQuery:', error);
   }
 }
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     // Validate authorization
     const authHeader = req.headers.get('Authorization');
     if (!authHeader?.startsWith('Bearer ')) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
         status: 401, 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
     }
 
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL')!,
       Deno.env.get('SUPABASE_ANON_KEY')!,
       { global: { headers: { Authorization: authHeader } } }
     );
 
     // Verify JWT and get user
     const token = authHeader.replace('Bearer ', '');
     const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
     
     if (claimsError || !claimsData?.user) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
         status: 401, 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
     }
 
     const userId = claimsData.user.id;
 
     // Rate limiting
     const rateCheck = checkRateLimit(userId, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
     if (!rateCheck.allowed) {
       return new Response(
         JSON.stringify({ error: `Rate limit exceeded. Retry in ${rateCheck.retryAfter}s.` }),
         { status: 429, headers: { ...corsHeaders, 'Retry-After': String(rateCheck.retryAfter) } }
       );
     }
 
     // Parse and validate request body
     const rawBody = await req.json();
     const parsed = ricoRequestSchema.safeParse(rawBody);
     
     if (!parsed.success) {
       console.error('[RICO] Validation error:', parsed.error.issues);
       return new Response(
         JSON.stringify({ error: 'Invalid request', details: parsed.error.issues }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const { messages, conversationId, dataCategory } = parsed.data;
     console.log('[RICO] Processing request:', { userId, dataCategory, messageCount: messages.length });
 
     // Get current Philippine time for date context
     const currentDate = new Date().toLocaleString('en-US', { 
       timeZone: 'Asia/Manila', 
       year: 'numeric', 
       month: 'long', 
       day: 'numeric',
       hour: '2-digit',
       minute: '2-digit'
     });
 
     // Build messages for AI with RICO system prompt
     const systemPrompt = getRicoSystemPrompt(currentDate);
     const aiMessages = [
       { role: "system", content: systemPrompt },
       ...messages.map(m => ({ role: m.role, content: m.content }))
     ];
 
     // Get AI API key
     const LOVABLE_AI_URL = Deno.env.get('LOVABLE_AI_URL') || "https://ai-gateway.lovable.ai";
     const LOVABLE_AI_KEY = Deno.env.get('LOVABLE_AI_KEY');
     
     if (!LOVABLE_AI_KEY) {
       console.error('[RICO] Missing LOVABLE_AI_KEY');
       return new Response(
         JSON.stringify({ error: 'AI service unavailable' }),
         { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const tools = getAnalystTools();
     let finalResponse = "";
     let toolIterations = 0;
     const MAX_TOOL_ITERATIONS = 5;
 
     // Create streaming response
     const stream = new TransformStream();
     const writer = stream.writable.getWriter();
     const encoder = new TextEncoder();
 
     const sendEvent = async (content: string) => {
       const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
       await writer.write(encoder.encode(chunk));
     };
 
     // Process AI with tool calling
     (async () => {
       try {
         while (toolIterations < MAX_TOOL_ITERATIONS) {
           const response = await fetch(`${LOVABLE_AI_URL}/chat/completions`, {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${LOVABLE_AI_KEY}`
             },
             body: JSON.stringify({
               model: "google/gemini-2.5-flash",
               messages: aiMessages,
               tools,
               tool_choice: "auto",
               stream: false
             })
           });
 
           if (!response.ok) {
             const errorText = await response.text();
             console.error('[RICO] AI API error:', response.status, errorText);
             await sendEvent("[Error: AI service unavailable]");
             break;
           }
 
           const data = await response.json();
           const choice = data.choices?.[0];
 
           if (!choice) {
             console.error('[RICO] No choice in response');
             break;
           }
 
           // Handle tool calls
           if (choice.message?.tool_calls?.length) {
             toolIterations++;
             console.log(`[RICO] Tool iteration ${toolIterations}, tools:`, choice.message.tool_calls.length);
 
             aiMessages.push(choice.message);
 
             for (const toolCall of choice.message.tool_calls) {
               const toolName = toolCall.function.name;
               let toolArgs = {};
               
               try {
                 toolArgs = JSON.parse(toolCall.function.arguments || "{}");
               } catch {
                 console.error('[RICO] Invalid tool arguments');
               }
 
               console.log(`[RICO] Calling tool: ${toolName}`, toolArgs);
               const toolResult = await executeAnalystToolCall(
                 toolName, 
                 toolArgs, 
                 supabase,
                 dataCategory as DataCategory
               );
 
               aiMessages.push({
                 role: "tool",
                 tool_call_id: toolCall.id,
                 content: JSON.stringify(toolResult)
               } as any);
             }
             continue;
           }
 
           // No more tool calls - stream the final response
           if (choice.message?.content) {
             finalResponse = choice.message.content;
             
             // Stream the response in chunks
             const chunks = finalResponse.match(/.{1,50}/gs) || [finalResponse];
             for (const chunk of chunks) {
               await sendEvent(chunk);
             }
           }
           break;
         }
 
         // Log the query
         const userQuestion = messages[messages.length - 1]?.content || '';
         await logQuery(supabase, userId, userQuestion, finalResponse, conversationId);
 
         await writer.write(encoder.encode("data: [DONE]\n\n"));
         await writer.close();
       } catch (error) {
         console.error('[RICO] Stream error:', error);
         try {
           await sendEvent(`[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`);
           await writer.close();
         } catch {}
       }
     })();
 
     return new Response(stream.readable, {
       headers: {
         ...corsHeaders,
         "Content-Type": "text/event-stream",
         "Cache-Control": "no-cache",
         "Connection": "keep-alive"
       }
     });
 
   } catch (error) {
     console.error('[RICO] Handler error:', error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });