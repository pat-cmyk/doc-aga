import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnimalStageData {
  birth_date: string | null;
  gender: string | null;
  offspring_count: number;
  last_calving_date: string | null;
  has_recent_milking: boolean;
  has_active_ai: boolean;
  livestock_type: string;
}

function calculateLifeStage(data: AnimalStageData): string | null {
  if (!data.birth_date || !data.gender) return null;
  
  const birthDate = new Date(data.birth_date);
  const today = new Date();
  const ageMonths = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  
  const isMale = data.gender.toLowerCase() === 'male';
  const isFemale = data.gender.toLowerCase() === 'female';
  
  if (isMale) {
    return calculateMaleStage(data, ageMonths);
  }
  
  if (!isFemale) return null;

  // Species-specific logic for females
  switch (data.livestock_type) {
    case 'cattle':
      if (ageMonths < 6) return 'Calf';
      if (data.offspring_count === 0) return 'Heifer';
      return 'Cow';
      
    case 'carabao':
      if (ageMonths < 6) return 'Calf';
      if (data.offspring_count === 0) return 'Breeding Carabao';
      return 'Mature Carabao';
      
    case 'goat':
      if (ageMonths < 6) return 'Kid';
      if (data.offspring_count === 0) return 'Doeling';
      return 'Doe';
      
    case 'sheep':
      if (ageMonths < 6) return 'Lamb';
      if (data.offspring_count === 0) return 'Ewe Lamb';
      return 'Ewe';
      
    default:
      if (ageMonths < 6) return 'Calf';
      if (data.offspring_count === 0) return 'Heifer';
      return 'Cow';
  }
}

function calculateMaleStage(data: AnimalStageData, ageMonths: number): string | null {
  switch (data.livestock_type) {
    case 'cattle':
      if (ageMonths < 6) return 'Calf';
      if (ageMonths < 24) return 'Young Bull';
      return 'Bull';
      
    case 'carabao':
      if (ageMonths < 6) return 'Calf';
      if (ageMonths < 24) return 'Young Bull';
      return 'Bull Carabao';
      
    case 'goat':
      if (ageMonths < 6) return 'Kid';
      if (ageMonths < 12) return 'Buckling';
      return 'Buck';
      
    case 'sheep':
      if (ageMonths < 6) return 'Lamb';
      if (ageMonths < 12) return 'Ram Lamb';
      return 'Ram';
      
    default:
      if (ageMonths < 6) return 'Calf';
      if (ageMonths < 24) return 'Young Bull';
      return 'Bull';
  }
}

function calculateMilkingStage(data: AnimalStageData): string | null {
  if (!data.last_calving_date || data.gender?.toLowerCase() !== 'female') {
    return null;
  }

  const lastCalving = new Date(data.last_calving_date);
  const today = new Date();
  const daysSinceCalving = Math.floor((today.getTime() - lastCalving.getTime()) / (1000 * 60 * 60 * 24));

  if (data.has_recent_milking) {
    if (daysSinceCalving <= 100) return 'Early Lactation';
    if (daysSinceCalving <= 200) return 'Mid-Lactation';
    return 'Late Lactation';
  }

  if (daysSinceCalving > 60) {
    return 'Dry Period';
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: isAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { animalId } = await req.json();
    
    if (!animalId) {
      return new Response(JSON.stringify({ error: 'Animal ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Recalculating stages for animal: ${animalId}`);

    // Fetch animal with related data
    const { data: animal, error: fetchError } = await supabase
      .from('animals')
      .select(`
        id,
        birth_date,
        gender,
        livestock_type,
        life_stage,
        milking_stage,
        unique_code
      `)
      .eq('id', animalId)
      .single();

    if (fetchError || !animal) {
      console.error('[recalculate-animal] Animal not found:', animalId, fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Animal not found',
          details: fetchError?.message 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[recalculate-animal] Fetched animal:', {
      id: animal.id,
      unique_code: animal.unique_code,
      livestock_type: animal.livestock_type,
      gender: animal.gender,
      birth_date: animal.birth_date,
      current_life_stage: animal.life_stage,
      current_milking_stage: animal.milking_stage
    });

    // Count offspring using correct column names (mother_id/father_id)
    const { count: offspringCount } = await supabase
      .from('animals')
      .select('id', { count: 'exact', head: true })
      .or(`mother_id.eq.${animalId},father_id.eq.${animalId}`)
      .eq('is_deleted', false);

    console.log('[recalculate-animal] Offspring count:', offspringCount || 0);

    // Get last calving date from latest offspring birth_date
    const { data: latestOffspring } = await supabase
      .from('animals')
      .select('birth_date')
      .or(`mother_id.eq.${animalId},father_id.eq.${animalId}`)
      .eq('is_deleted', false)
      .order('birth_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastCalvingDate = latestOffspring?.birth_date || null;
    console.log('[recalculate-animal] Last calving date:', lastCalvingDate);

    // Check for active AI records
    const { data: activeAI } = await supabase
      .from('ai_records')
      .select('id')
      .eq('animal_id', animalId)
      .eq('pregnancy_confirmed', false)
      .is('performed_date', null)
      .limit(1)
      .maybeSingle();

    const hasActiveAI = !!activeAI;
    console.log('[recalculate-animal] Has active AI:', hasActiveAI);

    // Check for recent milking (within 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentMilking } = await supabase
      .from('milking_records')
      .select('id')
      .eq('animal_id', animalId)
      .gte('record_date', thirtyDaysAgo.toISOString().split('T')[0])
      .limit(1)
      .maybeSingle();

    const hasRecentMilking = !!recentMilking;
    console.log('[recalculate-animal] Has recent milking:', hasRecentMilking);

    // Prepare stage data with normalized livestock type
    const normalizedType = animal.livestock_type?.trim().toLowerCase() || 'cattle';
    const stageData: AnimalStageData = {
      birth_date: animal.birth_date,
      gender: animal.gender,
      offspring_count: offspringCount || 0,
      last_calving_date: lastCalvingDate,
      has_recent_milking: hasRecentMilking,
      has_active_ai: hasActiveAI,
      livestock_type: normalizedType
    };

    const newLifeStage = calculateLifeStage(stageData);
    const newMilkingStage = calculateMilkingStage(stageData);

    const oldLifeStage = animal.life_stage;
    const oldMilkingStage = animal.milking_stage;

    // Update animal
    const { error: updateError } = await supabase
      .from('animals')
      .update({
        life_stage: newLifeStage,
        milking_stage: newMilkingStage,
      })
      .eq('id', animal.id);

    if (updateError) {
      console.error(`Failed to update animal ${animal.unique_code}:`, updateError);
      return new Response(JSON.stringify({ error: 'Update failed', details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updated ${animal.unique_code}: life_stage ${oldLifeStage} → ${newLifeStage}, milking_stage ${oldMilkingStage} → ${newMilkingStage}`);

    return new Response(JSON.stringify({
      success: true,
      animal: {
        id: animal.id,
        unique_code: animal.unique_code,
        old_life_stage: oldLifeStage,
        new_life_stage: newLifeStage,
        old_milking_stage: oldMilkingStage,
        new_milking_stage: newMilkingStage,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in recalculate-animal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
