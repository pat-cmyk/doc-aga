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

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    console.log(`[voice-to-text] Request from user: ${user.id}`)

    // Rate limiting by user ID
    const rateCheck = checkRateLimit(user.id, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)
    if (!rateCheck.allowed) {
      console.warn(`[voice-to-text] Rate limit exceeded for user: ${user.id}`)
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
    const audioSizeBytes = (audio.length * 3) / 4 // Approximate decoded size
    if (audioSizeBytes > MAX_AUDIO_SIZE_BYTES) {
      console.warn(`[voice-to-text] Audio too large: ${(audioSizeBytes / 1024 / 1024).toFixed(2)}MB`)
      return new Response(
        JSON.stringify({ error: `Audio file too large. Maximum size is ${MAX_AUDIO_SIZE_MB}MB` }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[voice-to-text] Processing audio (${(audioSizeBytes / 1024).toFixed(2)}KB)`)

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[voice-to-text] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Transcription service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);

    // Create blob from binary audio data
    const audioBlob = new Blob([binaryAudio], { type: 'audio/webm' });
    
    // Philippine agricultural terminology glossary for context with Taglish support
    const farmTermsPrompt = `
Agricultural terms (English/Tagalog/Taglish):
- Feeding: pagpapakain, pagkain ng hayop, nag-feed
- Milking: paggatas, pagkagatas, nag-milk, nag-gatas
- Weight: timbang, bigat, nag-weigh
- Health check: tsek sa kalusugan, nag-check
- Injection: iniksyon, bakuna, tinurukan, nag-inject
- Medicine: gamot, medisina
- Calf: guya, batang baka
- Heifer: dumalagang baka
- Cow: baka
- Bull: toro, lalaking baka
- Pregnant: buntis, nagdadalang-tao
- Artificial insemination: artipisyal na pagpapalihi, AI
- Birth: panganganak, pagsilang
- Feed types: concentrate, roughage, hay, grass, palay, dayami, darak, mais
- Liters: litro
- Kilograms: kilo
- Units: bales, bags, sako, supot, bigkis
- Numbers: isa (1), dalawa (2), tatlo (3), apat (4), lima (5), anim (6), pito (7), walo (8), siyam (9), sampu (10)
- Larger numbers: labinisa (11), labindalawa (12), dalawampu (20), tatlumpu (30), apatnapu (40), limampu (50)
- Sick: may sakit
- Healthy: malusog
- Temperature: temperatura, lagnat

TAGLISH (Code-Switching) Examples - Common in Filipino speech:
- "Nag-feed ako ng 10 bales" = I fed 10 bales
- "Check mo yung milk production" = Check the milk production
- "Ang baka is doing well today" = The cow is doing well today
- "Need natin mag-inject ng vaccine" = We need to inject vaccine
- "Nag-milk ako this morning" = I milked this morning
- "Yung guya ay medyo underweight" = The calf is a bit underweight
- "Pinakain ko sila ng 5 bags of concentrates" = I fed them 5 bags of concentrates
- "May lagnat yung cow, need ng check-up" = The cow has fever, needs check-up
- "Around 20 liters ang na-milk ko" = I milked around 20 liters
- "Nag-record ng weight, around 450 kilos" = Recorded weight, around 450 kilos
    `.trim();

    // Prepare form data for OpenAI Whisper API
    // Note: Remove language parameter to enable auto-detection for Taglish support
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    // Language auto-detect for Taglish/code-switching support
    formData.append('prompt', farmTermsPrompt); // Context for better recognition

    // Send to OpenAI Whisper API
    console.log('[voice-to-text] Sending to OpenAI Whisper API...');
    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[voice-to-text] OpenAI API error:', response.status, errorText)
      
      // Sanitize error for client
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable. Please try again.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: 'Transcription service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json();
    
    // Validate result
    if (!result.text || typeof result.text !== 'string') {
      console.error('[voice-to-text] Invalid response from OpenAI:', result)
      return new Response(
        JSON.stringify({ error: 'Transcription failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[voice-to-text] Success for user ${user.id}: ${result.text.substring(0, 50)}...`)

    return new Response(
      JSON.stringify({ text: result.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[voice-to-text] Error:', error)
    
    // Sanitize errors - never expose internal details
    let errorMessage = 'An error occurred processing your request'
    let statusCode = 500
    
    if (error instanceof Error) {
      // Only expose specific safe error messages
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
