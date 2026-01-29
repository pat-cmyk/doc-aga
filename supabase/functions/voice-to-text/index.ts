import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Import SSOT prompts from shared library
import { TRANSCRIPTION_SYSTEM_PROMPT } from "../_shared/stt-prompts.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Security limits
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60000;
const MAX_AUDIO_SIZE_MB = 10;
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;
const MAX_BASE64_LENGTH = 15_000_000; // ~10MB decoded

// Input validation schema
const voiceToTextSchema = z.object({
  audio: z.string()
    .min(100, 'Audio data too short')
    .max(MAX_BASE64_LENGTH, 'Audio data exceeds maximum size')
    .regex(/^[A-Za-z0-9+/=]+$/, 'Invalid base64 encoding')
});

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

// ElevenLabs Scribe v2 Batch Transcription (Primary)
async function transcribeWithElevenLabs(audioBase64: string): Promise<string> {
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  // Decode base64 to binary
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create form data with audio file
  const formData = new FormData();
  const audioBlob = new Blob([bytes], { type: 'audio/webm' });
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model_id', 'scribe_v2');
  // Auto-detect language for Taglish support (omit language_code)

  console.log('[voice-to-text] Sending to ElevenLabs Scribe v2...');
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[voice-to-text] ElevenLabs error:', response.status, errorText);
    throw new Error(`ElevenLabs error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.text || typeof result.text !== 'string') {
    throw new Error('Invalid response from ElevenLabs: no text field');
  }

  return result.text.trim();
}

// Gemini 3 Pro Transcription (Fallback)
async function transcribeWithGemini(audioBase64: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

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
          content: TRANSCRIPTION_SYSTEM_PROMPT
        },
        { 
          role: 'user', 
          content: [
            {
              type: 'text',
              text: 'Please transcribe this audio recording from a Filipino farmer. Preserve the natural Taglish speech patterns.'
            },
            {
              type: 'inline_data',
              inline_data: {
                mime_type: 'audio/webm',
                data: audioBase64
              }
            }
          ]
        }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[voice-to-text] Gemini error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limits exceeded');
    }
    if (response.status === 402) {
      throw new Error('Service credits exhausted');
    }
    throw new Error(`Gemini error: ${response.status}`);
  }

  const result = await response.json();
  const transcription = result.choices?.[0]?.message?.content?.trim();
  
  if (!transcription || typeof transcription !== 'string') {
    throw new Error('Invalid response from Gemini: no transcription');
  }

  return transcription;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let userId: string | null = null;
  let audioSizeBytes = 0;
  let provider = 'elevenlabs';
  let modelVersion = 'scribe_v2';

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
      
      logSTTAnalytics(supabaseUrl, serviceKey, {
        user_id: user.id,
        model_provider: 'rate_limited',
        model_version: 'n/a',
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

    // Parse and validate audio data with Zod
    const rawBody = await req.json();
    const parseResult = voiceToTextSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('[voice-to-text] Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0]?.message || 'Invalid audio data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { audio } = parseResult.data;

    // Validate audio size (decoded size estimation)
    audioSizeBytes = (audio.length * 3) / 4 // Approximate decoded size
    if (audioSizeBytes > MAX_AUDIO_SIZE_BYTES) {
      console.warn(`[voice-to-text] Audio too large: ${(audioSizeBytes / 1024 / 1024).toFixed(2)}MB`)
      return new Response(
        JSON.stringify({ error: `Audio file too large. Maximum size is ${MAX_AUDIO_SIZE_MB}MB` }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[voice-to-text] Processing audio (${(audioSizeBytes / 1024).toFixed(2)}KB)`)

    // === FALLBACK CHAIN: ElevenLabs Primary → Gemini Fallback ===
    let transcription: string | null = null;

    try {
      // Try ElevenLabs Scribe v2 first (Primary)
      console.log('[voice-to-text] Trying ElevenLabs Scribe v2 (Primary)...');
      transcription = await transcribeWithElevenLabs(audio);
      provider = 'elevenlabs';
      modelVersion = 'scribe_v2';
      console.log('[voice-to-text] ElevenLabs success');
    } catch (elevenLabsError) {
      // ElevenLabs failed, fall back to Gemini
      console.warn('[voice-to-text] ElevenLabs failed, falling back to Gemini:', elevenLabsError);
      
      try {
        console.log('[voice-to-text] Trying Gemini 3 Pro (Fallback)...');
        transcription = await transcribeWithGemini(audio);
        provider = 'gemini';
        modelVersion = 'gemini-3-pro-preview';
        console.log('[voice-to-text] Gemini fallback success');
      } catch (geminiError) {
        // Both providers failed
        console.error('[voice-to-text] Both providers failed:', geminiError);
        
        const latencyMs = Date.now() - startTime;
        logSTTAnalytics(supabaseUrl, serviceKey, {
          user_id: user.id,
          model_provider: 'both_failed',
          model_version: 'n/a',
          latency_ms: latencyMs,
          audio_size_bytes: audioSizeBytes,
          status: 'error',
          error_message: `ElevenLabs: ${elevenLabsError}; Gemini: ${geminiError}`
        });

        // Handle specific Gemini errors for user-friendly messages
        if (geminiError instanceof Error) {
          if (geminiError.message.includes('Rate limits')) {
            return new Response(
              JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (geminiError.message.includes('credits exhausted')) {
            return new Response(
              JSON.stringify({ error: 'Service credits exhausted. Please contact support.' }),
              { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ error: 'Transcription service error. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[voice-to-text] Success for user ${user.id} via ${provider}: ${transcription.substring(0, 50)}...`)

    // Log successful transcription analytics
    logSTTAnalytics(supabaseUrl, serviceKey, {
      user_id: user.id,
      model_provider: provider,
      model_version: modelVersion,
      latency_ms: latencyMs,
      audio_size_bytes: audioSizeBytes,
      status: 'success',
      transcription_length: transcription.length
    });

    return new Response(
      JSON.stringify({ text: transcription, provider }),
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
        model_provider: provider,
        model_version: modelVersion,
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
