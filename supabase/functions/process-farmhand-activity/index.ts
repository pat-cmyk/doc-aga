import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription, farmId } = await req.json();

    if (!transcription || !farmId) {
      throw new Error('Transcription and farmId are required');
    }

    console.log('Processing transcription:', transcription);

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
            content: `You are an assistant helping farmhands log their daily activities. Extract structured information from voice transcriptions.

Always identify which animal the activity is about by looking for:
- Ear tag numbers (e.g., "247", "number 247", "tag 247")
- Animal names

Activity types you can identify:
- milking: Recording milk production
- feeding: Recording feed given to animals
- health_observation: General health checks or observations
- weight_measurement: Recording animal weight
- injection: Medicine or vaccine administration
- cleaning: General cleaning tasks

Extract quantities when mentioned (liters for milk, kilograms for feed/weight).
`
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
                    description: 'Animal ear tag number or name mentioned'
                  },
                  quantity: {
                    type: 'number',
                    description: 'Quantity in liters (for milk) or kilograms (for feed/weight)'
                  },
                  feed_type: {
                    type: 'string',
                    description: 'Type of feed given (if feeding activity)'
                  },
                  medicine_name: {
                    type: 'string',
                    description: 'Name of medicine or vaccine (if injection activity)'
                  },
                  dosage: {
                    type: 'string',
                    description: 'Dosage amount (if injection activity)'
                  },
                  notes: {
                    type: 'string',
                    description: 'Additional observations or notes'
                  }
                },
                required: ['activity_type', 'animal_identifier']
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

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No activity data extracted from transcription');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted data:', extractedData);

    // Find the animal in the database
    let animalId = null;
    if (extractedData.animal_identifier) {
      const identifier = extractedData.animal_identifier.toLowerCase();
      
      // Try to find by ear tag or name
      const { data: animals } = await supabase
        .from('animals')
        .select('id, ear_tag, name')
        .eq('farm_id', farmId)
        .eq('is_deleted', false);

      const animal = animals?.find(a => 
        a.ear_tag?.toLowerCase().includes(identifier) ||
        a.name?.toLowerCase().includes(identifier) ||
        identifier.includes(a.ear_tag?.toLowerCase() || '') ||
        identifier.includes(a.name?.toLowerCase() || '')
      );

      if (animal) {
        animalId = animal.id;
        console.log('Found animal:', animal);
      } else {
        console.log('Animal not found for identifier:', identifier);
      }
    }

    return new Response(
      JSON.stringify({
        ...extractedData,
        animal_id: animalId
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
