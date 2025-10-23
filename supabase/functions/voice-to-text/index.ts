import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Received audio data, processing...');

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    console.log(`Audio size: ${binaryAudio.length} bytes`);

    // Create blob from binary audio data
    const audioBlob = new Blob([binaryAudio], { type: 'audio/webm' });
    
    // Philippine agricultural terminology glossary for context
    const farmTermsPrompt = `
Agricultural terms (English/Tagalog):
- Feeding: pagpapakain, pagkain ng hayop
- Milking: paggatas, pagkagatas
- Weight: timbang, bigat
- Health check: tsek sa kalusugan
- Injection: iniksyon, bakuna
- Medicine: gamot, medisina
- Calf: guya, batang baka
- Heifer: dumalagang baka
- Cow: baka
- Bull: toro, lalaking baka
- Pregnant: buntis, nagdadalang-tao
- Artificial insemination: artipisyal na pagpapalihi, AI
- Birth: panganganak, pagsilang
- Feed types: concentrate, roughage, hay, grass, palay
- Liters: litro
- Kilograms: kilo
- Sick: may sakit
- Healthy: malusog
- Temperature: temperatura, lagnat
    `.trim();

    // Prepare form data for OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Primary language
    formData.append('prompt', farmTermsPrompt); // Context for better recognition

    // Send to OpenAI Whisper API
    console.log('Sending to OpenAI Whisper API...');
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
      const errorText = await response.text();
      console.error('OpenAI Whisper API error:', errorText);
      throw new Error(`OpenAI Whisper API error: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.text) {
      throw new Error('No transcription text returned');
    }

    const transcript = result.text;

    console.log('Transcription successful:', transcript);

    return new Response(
      JSON.stringify({ text: transcript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Voice-to-text error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
