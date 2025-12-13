import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Security limits
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60000;
const MAX_AUDIO_SIZE_MB = 10;
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(id: string, max: number, window: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(id);
  if (rateLimitMap.size > 10000) {
    const cutoff = now - window;
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.resetAt < cutoff) rateLimitMap.delete(key);
    }
  }
  if (!record || now > record.resetAt) {
    rateLimitMap.set(id, { count: 1, resetAt: now + window });
    return { allowed: true };
  }
  if (record.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  record.count++;
  return { allowed: true };
}

// Philippine agricultural terminology glossary for Taglish support
const farmTermsPrompt = `
You are an expert audio transcription assistant specialized in Filipino agricultural and veterinary contexts. Your task is to accurately transcribe audio from Filipino farmers who frequently use Taglish (Tagalog-English code-switching).

=== TRANSCRIPTION GUIDELINES ===
1. Transcribe EXACTLY what is spoken - preserve Taglish naturally
2. Use correct spelling for technical terms (veterinary, dairy, farming)
3. Numbers should be transcribed as digits (e.g., "10 liters" not "ten liters")
4. Preserve Filipino particles like "po", "opo", "naman", "kasi", "yung"
5. Keep English words that are naturally mixed in (common in Filipino farm speech)

=== AGRICULTURAL TERMS (English/Tagalog/Taglish) ===
- Feeding: pagpapakain, nag-feed
- Milking: paggatas, nag-milk, nag-gatas
- Weight: timbang, nag-weigh
- Health check: tsek sa kalusugan, nag-check
- Injection: iniksyon, bakuna, tinurukan, nag-inject
- Medicine: gamot, medisina
- Calf: guya, batang baka
- Heifer: dumalagang baka
- Cow: baka, mga baka
- Bull: toro, lalaking baka
- Pregnant: buntis
- Artificial insemination: AI, nag-AI
- Birth: panganganak, calving, nag-calve, nanganak
- Feed types: concentrate, roughage, hay, grass, palay, dayami, darak, mais
- Liters: litro
- Kilograms: kilo
- Units: bales, bags, sako, supot

=== VETERINARY DISEASES & MEDICAL TERMS ===
- Hemosep, Hemorrhagic Septicemia, HS
- Pasteurella multocida
- FMD, Foot and Mouth Disease
- Blackleg, PPR, Anthrax, Mastitis
- Milk fever, hypocalcemia, Ketosis
- Displaced abomasum, Retained placenta, Metritis
- Heavy panting, labored breathing
- Serous nasal discharge
- Naglalaway (salivating/drooling)
- Petechiation, Lameness, pilay
- Swelling, namamaga, Fever, lagnat

=== DAIRY INDUSTRY TERMS ===
- Days in milk, DIM, Milking line
- Dry period, dry cow, Close-up group
- Lactating cows, mga nagpapagatas
- Dry matter intake, DMI, Silage
- Napier grass, Ipil-ipil, Forage
- TMR, Total Mixed Ration
- Body condition score, BCS
- Somatic cell count, SCC
- CMT, California Mastitis Test

=== TAGLISH VERB PATTERNS ===
- nag-feed, nag-milk, nag-gatas, nag-weigh
- nag-inject, nag-check, nag-confirm
- nag-calve, nanganak, nag-dry off
- nag-heat, nag-init, nag-AI
- naka-schedule, na-check, na-confirm

=== COMMON TAGLISH PHRASES ===
- "Nag-feed ako ng 10 bales"
- "Nag-milk ako this morning"
- "Yung guya ay medyo underweight"
- "Meron tayong cow record"
- "Grinu-group nila yung mga dry cows"
- "Ang baka is doing well today"

=== QUESTION PATTERNS ===
- "Ano ba ang...", "Okay lang ba..."
- "Kelan ba ang...", "Magkano na..."
- "Bakit kaya...", "Pwede ba..."

=== POLITE FORMS ===
- "po", "opo" (respect markers)
- "Gusto ko po...", "Patulong po..."

Output ONLY the transcription text, nothing else.
`.trim();

// Helper function to log STT analytics (non-blocking)
async function logSTTAnalytics(
  supabaseUrl: string,
  serviceKey: string,
  data: {
    user_id: string;
    farm_id?: string;
    model_provider: string;
    model_version: string;
    latency_ms: number;
    audio_size_bytes: number;
    status: string;
    transcription_length?: number;
    error_message?: string;
  }
) {
  try {
    const serviceClient = createClient(supabaseUrl, serviceKey);
    await serviceClient.from('stt_analytics').insert([data]);
    console.log('[voice-to-text] Analytics logged successfully');
  } catch (error) {
    console.error('[voice-to-text] Failed to log analytics:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let userId: string | null = null;
  let audioSizeBytes = 0;

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('[voice-to-text] Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    userId = user.id;
    console.log(`[voice-to-text] Request from user: ${user.id}`)

    // Rate limiting by user ID
    const rateCheck = checkRateLimit(user.id, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)
    if (!rateCheck.allowed) {
      console.warn(`[voice-to-text] Rate limit exceeded for user: ${user.id}`)
      
      // Log rate limit event
      logSTTAnalytics(supabaseUrl, serviceKey, {
        user_id: user.id,
        model_provider: 'gemini',
        model_version: 'gemini-3-pro-preview',
        latency_ms: Date.now() - startTime,
        audio_size_bytes: 0,
        status: 'rate_limited',
        error_message: 'Rate limit exceeded'
      });
      
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter || 60)
          }
        }
      )
    }

    // Parse and validate audio data
    const { audio } = await req.json()
    
    if (!audio || typeof audio !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid audio data format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate base64 format
    if (!/^[A-Za-z0-9+/=]+$/.test(audio)) {
      return new Response(
        JSON.stringify({ error: 'Invalid audio encoding' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate audio size
    audioSizeBytes = (audio.length * 3) / 4 // Approximate decoded size
    if (audioSizeBytes > MAX_AUDIO_SIZE_BYTES) {
      console.warn(`[voice-to-text] Audio too large: ${(audioSizeBytes / 1024 / 1024).toFixed(2)}MB`)
      return new Response(
        JSON.stringify({ error: `Audio file too large. Maximum size is ${MAX_AUDIO_SIZE_MB}MB` }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[voice-to-text] Processing audio (${(audioSizeBytes / 1024).toFixed(2)}KB) with Gemini 3 Pro`)

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[voice-to-text] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Transcription service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare audio as base64 data URI for Gemini multimodal input
    const audioDataUri = `data:audio/webm;base64,${audio}`;

    // Send to Lovable AI Gateway with Gemini 3 Pro
    console.log('[voice-to-text] Sending to Lovable AI Gateway (Gemini 3 Pro)...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages: [
          { 
            role: 'system', 
            content: farmTermsPrompt 
          },
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: 'Please transcribe this audio recording from a Filipino farmer. Preserve the natural Taglish speech patterns.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:audio/webm;base64,${audio}`
                }
              }
            ]
          }
        ],
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[voice-to-text] Lovable AI error:', response.status, errorText)
      
      // Log error analytics
      logSTTAnalytics(supabaseUrl, serviceKey, {
        user_id: user.id,
        model_provider: 'gemini',
        model_version: 'gemini-3-pro-preview',
        latency_ms: latencyMs,
        audio_size_bytes: audioSizeBytes,
        status: 'error',
        error_message: `API error: ${response.status}`
      });
      
      // Handle rate limits
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Handle payment required
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service credits exhausted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Transcription service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json();
    
    // Extract transcription from Gemini response
    const transcription = result.choices?.[0]?.message?.content?.trim();
    
    if (!transcription || typeof transcription !== 'string') {
      console.error('[voice-to-text] Invalid response from Gemini:', result)
      
      // Log invalid response analytics
      logSTTAnalytics(supabaseUrl, serviceKey, {
        user_id: user.id,
        model_provider: 'gemini',
        model_version: 'gemini-3-pro-preview',
        latency_ms: latencyMs,
        audio_size_bytes: audioSizeBytes,
        status: 'error',
        error_message: 'Invalid response from model'
      });
      
      return new Response(
        JSON.stringify({ error: 'Transcription failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[voice-to-text] Success for user ${user.id}: ${transcription.substring(0, 50)}...`)

    // Log successful transcription analytics
    logSTTAnalytics(supabaseUrl, serviceKey, {
      user_id: user.id,
      model_provider: 'gemini',
      model_version: 'gemini-3-pro-preview',
      latency_ms: latencyMs,
      audio_size_bytes: audioSizeBytes,
      status: 'success',
      transcription_length: transcription.length
    });

    return new Response(
      JSON.stringify({ text: transcription }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[voice-to-text] Error:', error)
    
    const latencyMs = Date.now() - startTime;
    
    // Log error analytics if we have user context
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      logSTTAnalytics(supabaseUrl, serviceKey, {
        user_id: userId,
        model_provider: 'gemini',
        model_version: 'gemini-3-pro-preview',
        latency_ms: latencyMs,
        audio_size_bytes: audioSizeBytes,
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Sanitize errors - never expose internal details
    let errorMessage = 'An error occurred processing your request'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid audio')) {
        errorMessage = error.message
        statusCode = 400
      } else if (error.message.includes('Authentication')) {
        errorMessage = error.message
        statusCode = 401
      } else if (error.message.includes('Too many requests')) {
        errorMessage = error.message
        statusCode = 429
      }
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
});
