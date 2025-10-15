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
    const { transcription, farmId, animalId } = await req.json();

    if (!transcription || !farmId) {
      throw new Error('Transcription and farmId are required');
    }

    console.log('Processing transcription:', transcription);
    console.log('Animal context:', animalId || 'none');

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
            content: animalId 
              ? `You are an assistant helping farmhands log their daily activities. The farmhand is recording an activity for a SPECIFIC ANIMAL (ID: ${animalId}).

IMPORTANT: 
- The animal is already identified, so you DO NOT need to extract animal_identifier from the transcription unless the farmhand explicitly mentions a DIFFERENT animal
- Focus on extracting: activity type, quantity, and any additional notes
- If no animal is mentioned, assume they're talking about the current animal being viewed

**IMPORTANT - Unit Conversions**:
- When farmhand mentions "bales" of feed (hay, silage, etc.), convert to kilograms
- Use: 1 bale = 42 kg (average weight per bale)
- Store the total weight in kilograms in the quantity field
- Include original bale count in the notes field

Examples:
- "I fed 10 bales of corn silage" → quantity: 420, notes: "10 bales of corn silage"
- "Opened 5 bales of hay" → quantity: 210, notes: "5 bales of hay"

Activity types you can identify:
- milking: Recording milk production
- feeding: Recording feed given to animals
- health_observation: General health checks or observations
- weight_measurement: Recording animal weight
- injection: Medicine or vaccine administration
- cleaning: General cleaning tasks

Extract quantities when mentioned (liters for milk, kilograms for feed/weight).`
              : `You are an assistant helping farmhands log their daily activities. Extract structured information from voice transcriptions.

**IMPORTANT - Feeding Activity Logic**:
- If the farmhand mentions SPECIFIC animals (by ear tag, name, or says "cattle", "cow", etc. with a number), extract the animal_identifier
- If the farmhand says things like "I fed all animals", "fed the herd", "gave feed to everyone", or just mentions a quantity without specifying animals, DO NOT extract animal_identifier - this will be distributed proportionally across all animals
- Proportional distribution will divide the total feed based on animal weights
- DO NOT extract "cat" or similar words that are not actual animal identifiers - these are likely mishearing "cattle" or general terms

Always identify which animal the activity is about ONLY if explicitly mentioned:
- Ear tag numbers (e.g., "247", "number 247", "tag 247")
- Animal names (specific names given to animals)
- Specific animal references with identifiers

If NO specific animal is mentioned for feeding activities, leave animal_identifier empty - the system will handle proportional distribution.

**IMPORTANT - Unit Conversions**:
- When farmhand mentions "bales" of feed (hay, silage, corn silage, etc.), convert to kilograms
- Use: 1 bale = 42 kg (average weight per bale)
- Store the total weight in kilograms in the quantity field
- Include original bale count in the notes field

Examples:
- "I fed 10 bales of corn silage" → quantity: 420, notes: "10 bales of corn silage"
- "Opened 5 bales of hay" → quantity: 210, notes: "5 bales of hay"
- "Fed the cattle" → no animal_identifier (bulk feeding)

Activity types you can identify:
- feeding: Recording feed given to animals (can be bulk or specific)
- milking: Recording milk production (requires specific animal)
- health_observation: General health checks
- weight_measurement: Recording animal weight (requires specific animal)
- injection: Medicine or vaccine administration (requires specific animal)
- cleaning: General cleaning tasks

Extract quantities when mentioned (liters for milk, kilograms for feed/weight).`
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
                    description: animalId 
                      ? 'Optional - only if farmhand explicitly mentions a DIFFERENT animal'
                      : 'Animal ear tag number or name mentioned'
                  },
                  quantity: {
                    type: 'number',
                    description: 'Quantity in kilograms. If bales are mentioned, convert to kg (1 bale = 42 kg) and note original bale count in notes field. For milk use liters.'
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
                required: animalId ? ['activity_type'] : ['activity_type', 'animal_identifier']
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

    // Use provided animalId if available, otherwise look up from identifier
    let finalAnimalId = animalId;

    if (!animalId && extractedData.animal_identifier) {
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
        finalAnimalId = animal.id;
        console.log('Found animal:', animal);
      } else {
        console.log('Animal not found for identifier:', identifier);
      }
    }

    // Check if this is a bulk feeding scenario (feeding without specific animal found)
    if (extractedData.activity_type === 'feeding' && !finalAnimalId && extractedData.quantity) {
      console.log('Bulk feeding detected - calculating proportional distribution');
      
      // Fetch all active animals for the farm
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('id, name, ear_tag, current_weight_kg, life_stage')
        .eq('farm_id', farmId)
        .eq('is_deleted', false);

      if (animalsError) {
        console.error('Error fetching animals:', animalsError);
        throw new Error('Failed to fetch animals for distribution');
      }

      if (!animals || animals.length === 0) {
        throw new Error('No animals found in this farm');
      }

      console.log(`Found ${animals.length} animals for distribution`);

      // Calculate total weight
      const totalWeight = animals.reduce((sum, a) => sum + (a.current_weight_kg || 0), 0);
      console.log('Total weight:', totalWeight);

      // Calculate proportional distribution
      const distributions = animals.map(animal => {
        const weight = animal.current_weight_kg || 0;
        const proportion = totalWeight > 0 ? weight / totalWeight : 1 / animals.length;
        const feedAmount = extractedData.quantity * proportion;
        
        return {
          animal_id: animal.id,
          animal_name: animal.name || `Tag ${animal.ear_tag}`,
          ear_tag: animal.ear_tag,
          weight_kg: weight,
          proportion: proportion,
          feed_amount: feedAmount
        };
      });

      console.log('Distribution calculated:', distributions);

      return new Response(
        JSON.stringify({
          ...extractedData,
          is_bulk_feeding: true,
          total_animals: animals.length,
          total_weight_kg: totalWeight,
          distributions: distributions
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ...extractedData,
        animal_id: finalAnimalId
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
