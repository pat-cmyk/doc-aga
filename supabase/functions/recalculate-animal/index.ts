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

    // Fetch animal data
    const { data: animal, error: fetchError } = await supabase
      .from('animals')
      .select(`
        id,
        unique_code,
        birth_date,
        gender,
        livestock_type,
        last_calving_date,
        life_stage,
        milking_stage
      `)
      .eq('id', animalId)
      .single();

    if (fetchError || !animal) {
      return new Response(JSON.stringify({ error: 'Animal not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!animal.birth_date) {
      return new Response(JSON.stringify({ 
        error: 'Cannot calculate: birth_date missing',
        animal: animal.unique_code 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Count offspring
    const { count: offspringCount } = await supabase
      .from('animals')
      .select('id', { count: 'exact', head: true })
      .eq(animal.gender?.toLowerCase() === 'female' ? 'dam_id' : 'sire_id', animal.id)
      .eq('is_deleted', false);

    // Check recent milking (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: recentMilkingCount } = await supabase
      .from('milking_records')
      .select('id', { count: 'exact', head: true })
      .eq('animal_id', animal.id)
      .gte('record_date', sevenDaysAgo.toISOString().split('T')[0]);

    // Check active AI
    const { count: activeAICount } = await supabase
      .from('ai_records')
      .select('id', { count: 'exact', head: true })
      .eq('animal_id', animal.id)
      .eq('pregnancy_confirmed', false)
      .is('performed_date', null);

    const stageData: AnimalStageData = {
      birth_date: animal.birth_date,
      gender: animal.gender,
      offspring_count: offspringCount || 0,
      last_calving_date: animal.last_calving_date,
      has_recent_milking: (recentMilkingCount || 0) > 0,
      has_active_ai: (activeAICount || 0) > 0,
      livestock_type: animal.livestock_type || 'cattle',
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
