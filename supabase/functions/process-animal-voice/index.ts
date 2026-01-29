import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Import SSOT prompts from shared library
import { 
  ANIMAL_EXTRACTION_PROMPT,
  isLikelyAnimalRegistration 
} from "../_shared/stt-prompts.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation constants and schema
const MAX_TRANSCRIPTION_LENGTH = 5000;

const animalVoiceSchema = z.object({
  transcription: z.string()
    .trim()
    .min(1, 'Transcription cannot be empty')
    .max(MAX_TRANSCRIPTION_LENGTH, `Transcription must be under ${MAX_TRANSCRIPTION_LENGTH} characters`)
});

interface ExtractedAnimalData {
  livestock_type: 'cattle' | 'goat' | 'sheep' | 'carabao' | null;
  gender: 'Male' | 'Female' | null;
  ear_tag: string | null;
  name: string | null;
  is_lactating: boolean;
  entry_weight_kg: number | null;
  acquisition_type: 'purchased' | 'grant' | null;
  breed: string | null;
  confidence: 'high' | 'medium' | 'low';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input with Zod
    const rawBody = await req.json();
    const parseResult = animalVoiceSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('[process-animal-voice] Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: parseResult.error.errors[0]?.message || 'Invalid input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transcription } = parseResult.data;

    console.log('Processing animal voice transcription:', transcription);

    // Context validation: Check if this looks like animal registration
    if (!isLikelyAnimalRegistration(transcription)) {
      console.warn('[process-animal-voice] Input does not appear to be animal registration:', transcription.substring(0, 100));
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'INPUT_NOT_REGISTRATION',
          message: 'This appears to be a general farm update or milk recording. Please use the appropriate feature.',
          data: {
            livestock_type: null,
            gender: null,
            ear_tag: null,
            name: null,
            is_lactating: false,
            entry_weight_kg: null,
            acquisition_type: null,
            breed: null,
            confidence: 'low'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: ANIMAL_EXTRACTION_PROMPT },
          { role: 'user', content: `Extract animal data from this voice transcription:\n\n"${transcription}"` }
        ],
        temperature: 0.1, // Low temperature for consistent extraction
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI extraction response:', content);

    // Parse the JSON response, handling potential markdown code blocks
    let extractedData: ExtractedAnimalData;
    try {
      // Remove markdown code blocks if present
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3);
      }
      jsonContent = jsonContent.trim();
      
      extractedData = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return a default low-confidence result
      extractedData = {
        livestock_type: null,
        gender: null,
        ear_tag: null,
        name: null,
        is_lactating: false,
        entry_weight_kg: null,
        acquisition_type: null,
        breed: null,
        confidence: 'low'
      };
    }

    // Validate and normalize the extracted data
    const validLivestockTypes = ['cattle', 'goat', 'sheep', 'carabao'];
    const validGenders = ['Male', 'Female'];
    const validAcquisitionTypes = ['purchased', 'grant'];

    if (extractedData.livestock_type && !validLivestockTypes.includes(extractedData.livestock_type)) {
      extractedData.livestock_type = null;
    }
    if (extractedData.gender && !validGenders.includes(extractedData.gender)) {
      extractedData.gender = null;
    }
    if (extractedData.acquisition_type && !validAcquisitionTypes.includes(extractedData.acquisition_type)) {
      extractedData.acquisition_type = null;
    }

    // Calculate confidence based on extracted fields
    const extractedFieldCount = [
      extractedData.livestock_type,
      extractedData.gender,
      extractedData.ear_tag,
      extractedData.is_lactating,
      extractedData.entry_weight_kg,
      extractedData.breed,
    ].filter(Boolean).length;

    if (extractedFieldCount >= 3) {
      extractedData.confidence = 'high';
    } else if (extractedFieldCount >= 2) {
      extractedData.confidence = 'medium';
    } else {
      extractedData.confidence = 'low';
    }

    console.log('Final extracted data:', extractedData);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: extractedData,
        transcription: transcription
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing animal voice:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
