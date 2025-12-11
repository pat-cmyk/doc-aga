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
    // Enhanced based on real vet assessment transcript analysis
    const farmTermsPrompt = `
=== AGRICULTURAL TERMS (English/Tagalog/Taglish) ===
- Feeding: pagpapakain, pagkain ng hayop, nag-feed
- Milking: paggatas, pagkagatas, nag-milk, nag-gatas
- Weight: timbang, bigat, nag-weigh
- Health check: tsek sa kalusugan, nag-check
- Injection: iniksyon, bakuna, tinurukan, nag-inject
- Medicine: gamot, medisina
- Calf: guya, batang baka, mga guya
- Heifer: dumalagang baka
- Cow: baka, mga baka
- Bull: toro, lalaking baka
- Pregnant: buntis, nagdadalang-tao
- Artificial insemination: artipisyal na pagpapalihi, AI
- Birth: panganganak, pagsilang, calving, umaanak
- Feed types: concentrate, roughage, hay, grass, palay, dayami, darak, mais
- Liters: litro
- Kilograms: kilo
- Units: bales, bags, sako, supot, bigkis
- Numbers: isa (1), dalawa (2), tatlo (3), apat (4), lima (5), anim (6), pito (7), walo (8), siyam (9), sampu (10)
- Larger numbers: labinisa (11), labindalawa (12), dalawampu (20), tatlumpu (30), apatnapu (40), limampu (50)
- Sick: may sakit
- Healthy: malusog
- Temperature: temperatura, lagnat

=== VETERINARY DISEASES & MEDICAL TERMS ===
Philippine Diseases:
- Hemosep, Hemorrhagic Septicemia, HS
- Pasteurella multocida
- Clostridial diseases, clostridial
- FMD, Foot and Mouth Disease
- Blackleg
- PPR, Peste des Petits Ruminants
- Anthrax
- Mastitis

Metabolic Disorders:
- Milk fever, hypocalcemia
- Ketosis
- Displaced abomasum
- Retained placenta
- Metritis

Clinical Signs/Symptoms:
- Heavy panting, labored breathing
- Serous nasal discharge
- Naglalaway (salivating/drooling)
- Petechiation, petechial hemorrhages
- Lameness, pilay
- Swelling, namamaga
- Fever, lagnat, nagkakalagnat

Antibiotics/Medications:
- Tulathromycin, Draxxin
- Oxytetracycline
- Penicillin
- Dewormer, pampurga

=== TAGLISH VERB CONJUGATIONS ===
Filipino-ized English verbs (common in farm speech):
- nag-gra-grunt (grunting)
- nababuksan, nabubuksan (opening/opened)
- naglalaway (salivating)
- nagkakaroon (having/getting)
- grinu-group (grouping)
- nagsasalubong (meeting/clashing)
- namamaga (swelling)
- nagkakalagnat (having fever)
- nag-calve, nanganak (gave birth)
- nag-dry off (dried off/stopped milking)
- nag-heat, nag-init (in heat)
- nag-AI (artificially inseminated)
- naka-schedule (scheduled)
- na-check (checked)
- na-confirm (confirmed)

=== DAIRY INDUSTRY TECHNICAL TERMS ===
Production Metrics:
- Days in milk, DIM
- Milking line
- Dry period, dry cow
- Close-up group, close-up cows
- Far-off group, far-off cows
- Lactating cows, mga nagpapagatas
- Current production
- Peak milk

Feed & Nutrition:
- Dry matter, DM
- Dry matter intake, DMI
- Silage, corn silage
- Concentrates
- Spent grain
- Napier grass, elephant grass
- Ipil-ipil
- Forage
- Chop length
- TMR, Total Mixed Ration

Milk Quality:
- Milk fat
- Milk protein
- Somatic cell count, SCC
- Bacterial count
- CMT, California Mastitis Test

Body Condition:
- Body condition score, BCS
- Underweight
- Overconditioned
- Thin, payat
- Fat, mataba

=== TAGLISH CODE-SWITCHING EXAMPLES ===
Basic Patterns:
- "Nag-feed ako ng 10 bales" = I fed 10 bales
- "Check mo yung milk production" = Check the milk production
- "Ang baka is doing well today" = The cow is doing well today
- "Need natin mag-inject ng vaccine" = We need to inject vaccine
- "Nag-milk ako this morning" = I milked this morning
- "Yung guya ay medyo underweight" = The calf is a bit underweight

From Vet Assessments:
- "Meron tayong cow record" = We have cow records
- "Ay merong heavy panting" = Has heavy panting
- "Hindi pa nila nabubuksan yung animal" = They haven't opened the animal yet
- "Walang nakalagay" = Nothing is indicated
- "Grinu-group nila yung mga dry cows" = They are grouping the dry cows
- "Ayun yung current production" = That's the current production
- "Milk fever sa mga umaanak" = Milk fever in calving cows
- "Medyo may namamaga sa kanilang leeg" = There's some swelling in their neck
- "Ang pinaka-common na makita" = The most common thing seen
- "Yung mga baka nila" = Their cows
- "So far walang" = So far there's none
- "Sa past six months" = In the past six months
- "Around one thousand or so" = Around one thousand or so
- "Kung sakali" = In case/If ever
- "Based sa records nila" = Based on their records
- "Yung mortality rate nila" = Their mortality rate

=== ANIMAL IDENTIFICATION PATTERNS ===
- Cow number 69, cow number 33
- Si cow number X (personalized reference)
- Yung guya (the calf)
- Yung mga baka (the cows)
- Mga lactating cows
- Mga dry cows
- Ang mga heifers
- Yung bull nila

=== QUESTION PATTERNS ===
- "Ano ba ang..." = What is the...
- "Okay lang ba..." = Is it okay if...
- "Kelan ba ang..." = When is the...
- "Magkano na..." = How much is...
- "Bakit kaya..." = Why is it that...
- "Pwede ba..." = Can/Is it possible...
- "Meron ba kayong..." = Do you have...
- "Ilan na ang..." = How many are the...

=== POLITE FORMS (po/opo) ===
- "Gusto ko po..." = I want to... (polite)
- "Patulong po..." = Please help... (polite)
- "Pwede po bang..." = May I please... (polite)
- "Nagpa-bakuna po ako" = I had vaccinated (polite)
- "Meron po ba..." = Is there... (polite)

=== URGENCY/EMERGENCY ===
- "Emergency po!" = Emergency! (polite)
- "Urgent!" = Urgent!
- "Hindi na makatayo" = Can't stand anymore
- "Worried na ako" = I'm worried now
- "Please help po" = Please help (polite)
- "Sobrang init" = Very hot/high fever

=== CONVERSATIONAL FILLERS/CONNECTORS ===
- "Ay oo nga pala" = Oh by the way
- "So ayun" = So there/So that's it
- "Sige" = Okay/Alright
- "Tapos yung isa pa" = Then also the other one
- "Mga..." = Around/Approximately
- "Give or take" = More or less
- "Halos" = Almost/Nearly
- "Kasi" = Because
- "Kaya" = So/Therefore
- "Pero" = But
- "Tapos" = Then/And then
- "Actually" = Actually
- "So basically" = So basically

=== FINANCIAL TERMS ===
- "Gastos" = Expenses
- "Nag-earn" = Earned
- "Market price" = Market price
- "Pesos" = Pesos
- "Nabenta" = Sold
- "I-update" = Update
- "Per head" = Per head
- "Per liter" = Per liter
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
