import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnimalStageData {
  birth_date: string | null;
  gender: string | null;
  livestock_type: string | null;
  offspring_count: number;
  last_calving_date: string | null;
  has_active_ai: boolean;
  recent_milking: boolean;
}

interface ChangeRecord {
  animal_id: string;
  unique_code: string;
  old_life_stage: string | null;
  new_life_stage: string | null;
  old_milking_stage: string | null;
  new_milking_stage: string | null;
}

// Calculate life stage based on animal data
function calculateLifeStage(data: AnimalStageData): string | null {
  const { birth_date, gender, livestock_type, offspring_count, has_active_ai } = data;
  
  if (!birth_date || !gender || !livestock_type) return null;

  const normalizedType = livestock_type.toLowerCase().trim();
  const birthDate = new Date(birth_date);
  const today = new Date();
  const ageMonths = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));

  // Male animals
  if (gender.toLowerCase() === 'male') {
    return calculateMaleStage(data, ageMonths);
  }

  // Female animals - species-specific logic
  if (normalizedType === 'cattle') {
    if (ageMonths < 12) return 'Calf';
    if (offspring_count === 0 && !has_active_ai) return 'Heifer';
    if (has_active_ai && offspring_count === 0) return 'Pregnant Heifer';
    return 'Cow';
  } else if (normalizedType === 'carabao') {
    if (ageMonths < 12) return 'Carabao Calf';
    if (offspring_count === 0 && !has_active_ai) return 'Young Carabao';
    if (has_active_ai && offspring_count === 0) return 'Pregnant Carabao';
    return 'Mature Carabao';
  } else if (normalizedType === 'goat') {
    if (ageMonths < 6) return 'Kid';
    if (offspring_count === 0 && !has_active_ai) return 'Young Doe';
    if (has_active_ai && offspring_count === 0) return 'Pregnant Doe';
    return 'Doe';
  } else if (normalizedType === 'sheep') {
    if (ageMonths < 6) return 'Lamb';
    if (offspring_count === 0 && !has_active_ai) return 'Young Ewe';
    if (has_active_ai && offspring_count === 0) return 'Pregnant Ewe';
    return 'Ewe';
  }

  return null;
}

function calculateMaleStage(data: AnimalStageData, ageMonths: number): string | null {
  const { livestock_type } = data;
  if (!livestock_type) return null;

  const normalizedType = livestock_type.toLowerCase().trim();

  if (normalizedType === 'cattle') {
    if (ageMonths < 12) return 'Bull Calf';
    if (ageMonths < 24) return 'Young Bull';
    return 'Mature Bull';
  } else if (normalizedType === 'carabao') {
    if (ageMonths < 12) return 'Carabao Calf';
    if (ageMonths < 24) return 'Young Bull Carabao';
    return 'Mature Bull Carabao';
  } else if (normalizedType === 'goat') {
    if (ageMonths < 6) return 'Kid';
    if (ageMonths < 12) return 'Young Buck';
    return 'Buck';
  } else if (normalizedType === 'sheep') {
    if (ageMonths < 6) return 'Lamb';
    if (ageMonths < 12) return 'Young Ram';
    return 'Ram';
  }

  return null;
}

function calculateMilkingStage(data: AnimalStageData): string | null {
  const { gender, last_calving_date, recent_milking } = data;
  
  if (!gender || gender.toLowerCase() !== 'female') return null;
  if (!last_calving_date) return null;

  const lastCalving = new Date(last_calving_date);
  const today = new Date();
  const daysSinceCalving = Math.floor((today.getTime() - lastCalving.getTime()) / (1000 * 60 * 60 * 24));

  // If no recent milking activity, animal is in dry period
  if (!recent_milking) return 'Dry Period';

  // Lactation stages based on days since calving
  if (daysSinceCalving < 100) return 'Early Lactation';
  if (daysSinceCalving < 200) return 'Mid Lactation';
  if (daysSinceCalving < 305) return 'Late Lactation';
  
  return 'Dry Period';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify super admin status
    const { data: isSuperAdmin, error: adminError } = await supabase
      .rpc('is_super_admin', { _user_id: user.id });

    if (adminError || !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting bulk carabao stage recalculation...');

    // Cattle terms to look for in carabao animals
    const cattleTerms = ['Calf', 'Heifer', 'Pregnant Heifer', 'Cow', 'Bull Calf', 'Young Bull', 'Mature Bull', 'Mature Cow'];

    // Query all carabao animals with cattle terms
    const { data: carabaoAnimals, error: queryError } = await supabase
      .from('animals')
      .select('id, unique_code, birth_date, gender, livestock_type, life_stage, milking_stage')
      .eq('livestock_type', 'carabao')
      .in('life_stage', cattleTerms)
      .eq('is_deleted', false);

    if (queryError) {
      throw new Error(`Failed to query carabao animals: ${queryError.message}`);
    }

    console.log(`Found ${carabaoAnimals?.length || 0} carabao animals with cattle terms`);

    const changes: ChangeRecord[] = [];
    const errors: string[] = [];
    let updatedCount = 0;

    // Process each animal
    for (const animal of carabaoAnimals || []) {
      try {
        // Fetch offspring count
        const { count: offspringCount } = await supabase
          .from('animals')
          .select('id', { count: 'exact', head: true })
          .or(`mother_id.eq.${animal.id},father_id.eq.${animal.id}`)
          .eq('is_deleted', false);

        // Fetch last calving date (most recent offspring birth date as mother)
        const { data: lastOffspring } = await supabase
          .from('animals')
          .select('birth_date')
          .eq('mother_id', animal.id)
          .eq('is_deleted', false)
          .order('birth_date', { ascending: false })
          .limit(1)
          .single();

        // Check for active AI (scheduled but not performed)
        const { data: activeAI } = await supabase
          .from('ai_records')
          .select('id')
          .eq('animal_id', animal.id)
          .not('scheduled_date', 'is', null)
          .is('performed_date', null)
          .limit(1)
          .single();

        // Check for recent milking activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: recentMilking } = await supabase
          .from('milking_records')
          .select('id')
          .eq('animal_id', animal.id)
          .gte('record_date', thirtyDaysAgo.toISOString().split('T')[0])
          .limit(1)
          .single();

        const animalData: AnimalStageData = {
          birth_date: animal.birth_date,
          gender: animal.gender,
          livestock_type: animal.livestock_type,
          offspring_count: offspringCount || 0,
          last_calving_date: lastOffspring?.birth_date || null,
          has_active_ai: !!activeAI,
          recent_milking: !!recentMilking,
        };

        // Calculate new stages
        const newLifeStage = calculateLifeStage(animalData);
        const newMilkingStage = calculateMilkingStage(animalData);

        // Update if stages have changed
        if (newLifeStage !== animal.life_stage || newMilkingStage !== animal.milking_stage) {
          const { error: updateError } = await supabase
            .from('animals')
            .update({
              life_stage: newLifeStage,
              milking_stage: newMilkingStage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', animal.id);

          if (updateError) {
            errors.push(`${animal.unique_code}: ${updateError.message}`);
            console.error(`Failed to update ${animal.unique_code}:`, updateError);
          } else {
            changes.push({
              animal_id: animal.id,
              unique_code: animal.unique_code,
              old_life_stage: animal.life_stage,
              new_life_stage: newLifeStage,
              old_milking_stage: animal.milking_stage,
              new_milking_stage: newMilkingStage,
            });
            updatedCount++;
            console.log(`Updated ${animal.unique_code}: ${animal.life_stage} → ${newLifeStage}`);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${animal.unique_code}: ${errorMsg}`);
        console.error(`Error processing ${animal.unique_code}:`, error);
      }
    }

    console.log(`Bulk recalculation complete. Updated ${updatedCount} animals.`);

    return new Response(
      JSON.stringify({
        success: true,
        total_processed: carabaoAnimals?.length || 0,
        updated_count: updatedCount,
        changes,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in bulk-recalculate-carabao-stages:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
