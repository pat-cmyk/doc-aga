import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default weights for units when inventory lookup fails
const DEFAULT_WEIGHTS = {
  bales: 42,  // kg per bale (hay, silage)
  bags: 50,   // kg per bag (concentrates)
  barrels: 200, // kg per barrel/drum
};

// Parse and validate date with Filipino language support
function parseAndValidateDate(dateReference: string | undefined): { 
  date: string, 
  datetime: string, 
  isValid: boolean, 
  error?: string 
} {
  const now = new Date();
  let targetDate = new Date();
  
  if (!dateReference) {
    return {
      date: now.toISOString().split('T')[0],
      datetime: now.toISOString(),
      isValid: true
    };
  }
  
  const ref = dateReference.toLowerCase();
  
  // Enhanced future detection (Filipino + English)
  const futureKeywords = [
    'tomorrow', 'later', 'next week', 'next month', 'will', 'going to',
    'in 2 days', 'in 3 days', 'in a week',
    'bukas', 'mamaya', 'sa susunod', 'mamayang gabi', 'bukas ng umaga',
    'ugma', 'sa sunod'
  ];
  
  if (futureKeywords.some(keyword => ref.includes(keyword))) {
    return {
      date: '',
      datetime: '',
      isValid: false,
      error: 'Hindi pwedeng mag-record ng activities sa hinaharap. Mag-record lang ng mga activities na tapos na o nangyayari ngayon. / Cannot record activities for future dates. Please only record activities that have already happened or are happening now.'
    };
  }
  
  // Enhanced retroactive date parsing (Filipino + English)
  if (ref.includes('yesterday') || ref.includes('kahapon') || ref.includes('gabie')) {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (ref.includes('kamakalawa') || ref.includes('2 days ago')) {
    targetDate.setDate(targetDate.getDate() - 2);
  } else if (ref.includes('3 days ago')) {
    targetDate.setDate(targetDate.getDate() - 3);
  } else if (ref.includes('noong isang araw') || ref.includes('the other day')) {
    targetDate.setDate(targetDate.getDate() - 2);
  } else if (ref.includes('last monday') || ref.includes('noong lunes')) {
    const daysSinceMonday = (targetDate.getDay() + 6) % 7;
    targetDate.setDate(targetDate.getDate() - daysSinceMonday);
  }
  
  // Validate not too old (30 days limit)
  const daysDiff = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 30) {
    return {
      date: '',
      datetime: '',
      isValid: false,
      error: 'Hindi pwedeng mag-record ng activities na mas luma sa 30 days. Makipag-ugnayan sa farm manager para sa lumang records. / Cannot record activities older than 30 days. Please contact your farm manager for historical records.'
    };
  }
  
  return {
    date: targetDate.toISOString().split('T')[0],
    datetime: targetDate.toISOString(),
    isValid: true
  };
}

// FIFO: Get latest weight per unit from inventory (oldest stock first)
async function getLatestWeightPerUnit(
  supabase: any,
  farmId: string,
  feedType: string,
  unit: string
): Promise<number | null> {
  console.log(`Looking up weight per unit for: ${feedType}, unit: ${unit}`);
  
  const { data, error } = await supabase
    .from('feed_inventory')
    .select('weight_per_unit, quantity_kg, created_at, feed_type')
    .eq('farm_id', farmId)
    .ilike('feed_type', `%${feedType}%`)
    .eq('unit', unit)
    .gt('quantity_kg', 0)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching weight per unit:', error);
    return null;
  }

  if (!data || !data.weight_per_unit) {
    console.log('No matching inventory found');
    return null;
  }

  console.log(`Found weight per unit: ${data.weight_per_unit} kg from inventory item: ${data.feed_type}`);
  return Number(data.weight_per_unit);
}

// Resolve feed type from inventory based on unit
async function resolveFeedTypeFromInventory(
  supabase: any,
  farmId: string,
  unit: string,
  specifiedFeedType?: string
): Promise<{ 
  feed_type: string | null, 
  needsClarification: boolean,
  availableOptions?: string[]
}> {
  
  // If feed type explicitly specified and not "unknown", use it
  if (specifiedFeedType && specifiedFeedType !== 'unknown') {
    return { feed_type: specifiedFeedType, needsClarification: false };
  }
  
  // Query inventory for feeds matching this unit
  const { data: inventory } = await supabase
    .from('feed_inventory')
    .select('feed_type')
    .eq('farm_id', farmId)
    .eq('unit', unit)
    .gt('quantity_kg', 0);
  
  if (!inventory || inventory.length === 0) {
    return { 
      feed_type: null, 
      needsClarification: true,
      availableOptions: []
    };
  }
  
  const uniqueFeedTypes: string[] = [...new Set(inventory.map((i: any) => i.feed_type))].filter((ft): ft is string => typeof ft === 'string');
  
  if (uniqueFeedTypes.length === 1) {
    // Only one option - use it
    const feedType: string = uniqueFeedTypes[0];
    console.log(`Auto-resolved unit "${unit}" to feed type: ${feedType}`);
    return { 
      feed_type: feedType, 
      needsClarification: false 
    };
  }
  
  // Multiple options - needs clarification
  console.log(`Multiple feed types found for unit "${unit}":`, uniqueFeedTypes);
  const options: string[] = uniqueFeedTypes;
  return { 
    feed_type: null, 
    needsClarification: true,
    availableOptions: options
  };
}

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

**FILIPINO LANGUAGE SUPPORT**:
You MUST recognize Filipino/Tagalog and Bisaya/Cebuano farming terms and extract the correct English equivalents:

Common Filipino/Tagalog Terms:
- Feed Types: "dayami"=rice straw, "mais"=corn, "darak"=rice bran, "concentrates"/"pellets"=concentrates, "pulot"=molasses, "napier"=napier grass
- Units: "supot"/"sako"=bag, "balde"=bucket, "bigkis"/"pakete"/"bale"=bale, "drum"/"bariles"=barrel
- Activities: "pagpapakain"=feeding, "paggatas"=milking, "pagbakunat"=vaccination, "pagturuk"=injection, "pagtimbang"=weighing
- Time: "ngayon"=now/today, "kahapon"=yesterday, "bukas"=tomorrow, "kanina"=earlier, "kamakalawa"=day before yesterday
- Animals: "baka"=cow, "toro"=bull, "guya"=dairy cow, "nagsususo"=lactating, "buntis"=pregnant

Bisaya/Cebuano: "gabie"=yesterday, "karon"=now, "ugma"=tomorrow, "papakaon"=feeding, "pagatas"=milking

**IMPORTANT - Unit Recognition (DO NOT convert manually)**:
- Extract COUNT and UNIT separately
- DO NOT multiply by weight - system will look up from inventory
- Extract: quantity (count), unit (type), and feed_type (name)

Examples:
- "Nagbigay ako ng 10 bigkis ng mais" → quantity: 10, unit: "bales", feed_type: "corn"
- "I fed 10 bales of corn silage" → quantity: 10, unit: "bales", feed_type: "corn silage"
- "5 sako ng concentrates" → quantity: 5, unit: "bags", feed_type: "concentrates"

Activity types: milking, feeding, health_observation, weight_measurement, injection, cleaning

Extract quantities when mentioned (liters for milk, kilograms for feed/weight).`
              : `You are an assistant helping farmhands log their daily activities. Extract structured information from voice transcriptions.

**FILIPINO LANGUAGE SUPPORT - COMPREHENSIVE VOCABULARY**:
You MUST recognize and correctly interpret Filipino/Tagalog and Bisaya farming terms:

Feed Types (dayami, mais, darak, etc.):
- "dayami"/"rice straw" = rice straw
- "mais"/"corn" = corn  
- "darak"/"rice bran" = rice bran
- "concentrates"/"pellets" = concentrates
- "pulot"/"molasses" = molasses
- "palay" = unhusked rice
- "kamoteng kahoy" = cassava
- "napier" = napier grass

Units/Containers:
- "supot"/"sako"/"bag" = bag/sack
- "balde"/"bucket" = bucket
- "bigkis"/"pakete"/"bale" = bundle/bale
- "kaserola"/"pot" = pot
- "drum"/"bariles" = barrel/drum

Activities:
- "pagpapakain"/"feeding" = feeding
- "paggatas"/"milking" = milking
- "pagbakunat"/"vaccination" = vaccination
- "pagbigay ng gamot"/"pagturuk" = medicine/injection
- "pagtimbang" = weighing

Time References:
- "ngayon"/"now"/"today" = current time
- "kahapon"/"yesterday" = yesterday
- "bukas"/"tomorrow" = tomorrow (FUTURE - reject this!)
- "kanina"/"earlier" = earlier today
- "kamakalawa" = day before yesterday
- "sa umaga"/"morning" = morning
- "sa tanghali"/"noon" = noon
- "sa hapon"/"afternoon" = afternoon
- "sa gabi"/"night" = evening/night

Bisaya/Cebuano:
- Time: "gabie"=yesterday, "karon"=now, "ugma"=tomorrow (FUTURE)
- Activities: "papakaon"=feeding, "pagatas"=milking

Mixed Language (Taglish):
- "Nag-feed ako ng 10 bales" = I fed 10 bales
- "Pinakain ko ang 5 sako" = I fed 5 bags
- "Nag-milk ng 20 litro" = Milked 20 liters

CRITICAL: Extract correct English equivalents for database storage!

**IMPORTANT - Feeding Activity Logic**:
- If farmhand mentions SPECIFIC animals (ear tag, name), extract animal_identifier
- If says "lahat"/"all"/"everyone"/"herd", NO animal_identifier (proportional distribution)
- Proportional distribution divides feed by animal weights
- DO NOT extract "cat" (likely mishearing "cattle")

**CRITICAL - Feed Type vs Unit Distinction**:
For feeding activities, you MUST correctly distinguish between feed_type and unit:

FEED_TYPE = WHAT the feed is (the actual material/product name):
- Examples: "corn silage", "hay", "concentrates", "alfalfa", "barley", "grain"
- Common variations: "baled corn silage", "chopped hay", "dairy concentrates"
- If user explicitly mentions feed type, extract it exactly
- If user only mentions unit WITHOUT specifying content, set feed_type to "unknown"

UNIT = HOW it's packaged/measured:
- Examples: "bales", "bags", "barrels", "buckets", "kg", "drums"
- This describes the container or measurement, NOT the feed itself

EXTRACTION RULES:
1. "5 bales" alone → feed_type: "unknown", unit: "bales", quantity: 5
2. "5 bales of corn silage" → feed_type: "corn silage", unit: "bales", quantity: 5
3. "2 bags of concentrates" → feed_type: "concentrates", unit: "bags", quantity: 2
4. "8 bales of baled corn silage" → feed_type: "baled corn silage", unit: "bales", quantity: 8
5. "3 bags" alone → feed_type: "unknown", unit: "bags", quantity: 3

**CRITICAL**: System will check inventory to resolve "unknown" feed types automatically.
**NEVER use the unit name as the feed_type!**
**NEVER assume or default feed types - extract only what user explicitly says!**

**IMPORTANT - Unit Recognition (DO NOT convert manually)**:
- When farmhand mentions units like "bales", "bags", "barrels/drums", extract the COUNT and UNIT separately
- DO NOT multiply by weight - the system will look up the correct weight from inventory
- Extract: quantity (count), unit (type), and feed_type (name of the actual feed)

Examples:
- "I fed 10 bales of corn silage" → quantity: 10, unit: "bales", feed_type: "corn silage"
- "Opened 5 bags of concentrates" → quantity: 5, unit: "bags", feed_type: "concentrates"
- "Used 2 barrels of molasses" → quantity: 2, unit: "barrels", feed_type: "molasses"
- "Fed 8 bales" → quantity: 8, unit: "bales", feed_type: "hay"
- "Gave 3 bags" → quantity: 3, unit: "bags", feed_type: "concentrates"

Activity types you can identify:
- feeding: Recording feed given to animals (can be bulk or specific) - ALWAYS requires feed_type
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
                    description: 'Quantity COUNT (number of units). For example: 10 bales, 5 bags, 2 barrels. Do NOT convert to kg.'
                  },
                  unit: {
                    type: 'string',
                    enum: ['bales', 'bags', 'barrels', 'kg', 'liters'],
                    description: 'Unit of measurement mentioned (bales, bags, barrels, kg, or liters)'
                  },
                  feed_type: {
                    type: 'string',
                    description: 'REQUIRED for feeding activities. Type of feed given (e.g., "corn silage", "hay", "concentrates", "molasses"). This is critical for inventory tracking.'
                  },
                  medicine_name: {
                    type: 'string',
                    description: 'Name of medicine or vaccine (if injection activity)'
                  },
                  dosage: {
                    type: 'string',
                    description: 'Dosage amount (if injection activity)'
                  },
                  date_reference: {
                    type: 'string',
                    description: `Date or time reference in ANY language:
- English: "today", "yesterday", "2 days ago", "last Monday", "this morning"
- Tagalog: "ngayon", "kahapon", "kanina", "kamakalawa", "noong isang araw", "sa umaga"
- Bisaya: "karon", "gabie"
- Time: "umaga"=morning, "tanghali"=noon, "hapon"=afternoon, "gabi"=night

CRITICAL: Flag future references: "bukas", "ugma", "tomorrow", "mamaya", "sa susunod"`
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

    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      throw new Error('No activity data extracted from transcription');
    }

    console.log(`Extracted ${toolCalls.length} tool call(s)`);
    
    // Parse all tool calls
    const extractedActivities = toolCalls.map((toolCall: any, index: number) => {
      const data = JSON.parse(toolCall.function.arguments);
      console.log(`Activity ${index + 1}:`, data);
      
      // CRITICAL VALIDATION: Ensure feed_type is present for feeding activities
      if (data.activity_type === 'feeding' && !data.feed_type) {
        console.error(`VALIDATION ERROR: feed_type is missing for feeding activity ${index + 1}`);
        throw new Error('Feed type must be specified for feeding activities. Please mention what type of feed was given (e.g., corn silage, hay, concentrates).');
      }
      
      if (data.activity_type === 'feeding') {
        console.log(`✓ Validation passed - feed_type: ${data.feed_type}`);
      }
      
      // Validate and parse date reference if provided
      if (data.date_reference) {
        const dateValidation = parseAndValidateDate(data.date_reference);
        if (!dateValidation.isValid) {
          throw new Error(dateValidation.error);
        }
        data.validated_date = dateValidation.date;
        data.validated_datetime = dateValidation.datetime;
        console.log(`✓ Date validated: ${data.date_reference} → ${data.validated_date}`);
      }
      
      return data;
    });
    
    // Check if we have multiple feeding activities
    const feedingActivities = extractedActivities.filter((a: any) => a.activity_type === 'feeding');
    const hasMultipleFeeds = feedingActivities.length > 1;
    
    // Resolve feed types from inventory for all feeding activities
    if (feedingActivities.length > 0) {
      for (const activity of feedingActivities) {
        if (activity.unit && (!activity.feed_type || activity.feed_type === 'unknown')) {
          console.log(`Resolving feed type for unit: ${activity.unit}`);
          const resolution = await resolveFeedTypeFromInventory(
            supabase,
            farmId,
            activity.unit,
            activity.feed_type
          );
          
          if (resolution.needsClarification) {
            return new Response(
              JSON.stringify({
                error: 'NEEDS_CLARIFICATION',
                message: `Please specify the type of feed for ${activity.quantity} ${activity.unit}`,
                unit: activity.unit,
                quantity: activity.quantity,
                availableOptions: resolution.availableOptions
              }),
              { 
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
          
          if (resolution.feed_type) {
            activity.feed_type = resolution.feed_type;
            console.log(`✓ Resolved to: ${resolution.feed_type}`);
          }
        }
      }
    }
    
    // Use the first activity for non-feeding logic or single feed
    const extractedData = extractedActivities[0];

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

    // Handle multiple feeding activities (bulk feeding with multiple feed types)
    if (hasMultipleFeeds && feedingActivities.every((a: any) => !a.animal_identifier)) {
      console.log(`Processing ${feedingActivities.length} different feed types for bulk feeding`);
      
      // Get all active animals for this farm (shared across all feeds)
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('id, name, ear_tag, current_weight_kg')
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .not('current_weight_kg', 'is', null);
      
      if (animalsError) {
        console.error('Error fetching animals:', animalsError);
        throw new Error('Failed to fetch farm animals');
      }
      
      console.log(`Found ${animals.length} animals for distribution`);
      
      // Calculate total weight of all animals (same for all feeds)
      const totalWeightKg = animals.reduce((sum, animal) => sum + (Number(animal.current_weight_kg) || 0), 0);
      console.log(`Total weight: ${totalWeightKg}`);
      
      // Process each feed type
      const feeds = [];
      for (const feedActivity of feedingActivities) {
        if (!feedActivity.quantity || !feedActivity.unit) {
          console.log(`Skipping feed without quantity/unit:`, feedActivity);
          continue;
        }
        
        console.log(`Processing feed: ${feedActivity.feed_type}, ${feedActivity.quantity} ${feedActivity.unit}`);
        
        // Convert units to kg using FIFO inventory lookup
        const weightPerUnit = await getLatestWeightPerUnit(
          supabase,
          farmId,
          feedActivity.feed_type,
          feedActivity.unit
        );
        
        let totalKg: number;
        if (weightPerUnit) {
          totalKg = feedActivity.quantity * weightPerUnit;
          console.log(`Converted ${feedActivity.quantity} ${feedActivity.unit} to ${totalKg} kg using inventory weight (${weightPerUnit} kg/unit)`);
        } else {
          // Fallback to default weights
          const defaultWeight = DEFAULT_WEIGHTS[feedActivity.unit as keyof typeof DEFAULT_WEIGHTS] || 1;
          totalKg = feedActivity.quantity * defaultWeight;
          console.log(`Using default weight: ${defaultWeight} kg per ${feedActivity.unit}. Total: ${totalKg} kg`);
        }
        
        // Calculate proportional distribution for this feed
        const distributions = animals.map(animal => {
          const animalWeight = Number(animal.current_weight_kg) || 0;
          const proportion = animalWeight / totalWeightKg;
          const feedAmount = totalKg * proportion;
          
          return {
            animal_id: animal.id,
            animal_name: animal.name,
            ear_tag: animal.ear_tag,
            weight_kg: animalWeight,
            proportion,
            feed_amount: feedAmount
          };
        });
        
        feeds.push({
          feed_type: feedActivity.feed_type,
          quantity: feedActivity.quantity,
          unit: feedActivity.unit,
          total_kg: totalKg,
          weight_per_unit: weightPerUnit || DEFAULT_WEIGHTS[feedActivity.unit as keyof typeof DEFAULT_WEIGHTS],
          distributions,
          notes: feedActivity.notes
        });
      }
      
      console.log(`✓ Returning bulk feeding data with ${feeds.length} feed types`);
      
      return new Response(
        JSON.stringify({
          activity_type: 'feeding',
          multiple_feeds: true,
          total_animals: animals.length,
          total_weight_kg: totalWeightKg,
          feeds
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a bulk feeding scenario (feeding without specific animal found)
    if (extractedData.activity_type === 'feeding' && !finalAnimalId && extractedData.quantity) {
      console.log('Bulk feeding detected - calculating proportional distribution');
      
      // Step 1: Convert units to kg using FIFO inventory lookup
      let totalKg = extractedData.quantity;
      let weightPerUnit = null;
      
      if (extractedData.unit && ['bales', 'bags', 'barrels'].includes(extractedData.unit)) {
        // Try to get weight per unit from inventory (FIFO)
        weightPerUnit = await getLatestWeightPerUnit(
          supabase,
          farmId,
          extractedData.feed_type || '',
          extractedData.unit
        );
        
        if (weightPerUnit) {
          totalKg = extractedData.quantity * weightPerUnit;
          console.log(`Converted ${extractedData.quantity} ${extractedData.unit} to ${totalKg} kg using inventory weight (${weightPerUnit} kg/unit)`);
        } else {
          // Fallback to default weights with type safety
          const unit = extractedData.unit as 'bales' | 'bags' | 'barrels';
          const defaultWeight = DEFAULT_WEIGHTS[unit] || 1;
          totalKg = extractedData.quantity * defaultWeight;
          console.log(`Using default weight: ${extractedData.quantity} ${extractedData.unit} = ${totalKg} kg (${defaultWeight} kg/unit)`);
        }
      }
      
      // Step 2: Fetch all active animals for the farm
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
        const feedAmount = totalKg * proportion;
        
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
      
      console.log('✓ Returning bulk feeding data with feed_type:', extractedData.feed_type);

      return new Response(
        JSON.stringify({
          ...extractedData,
          total_kg: totalKg,
          original_quantity: extractedData.quantity,
          original_unit: extractedData.unit || 'kg',
          weight_per_unit: weightPerUnit,
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
