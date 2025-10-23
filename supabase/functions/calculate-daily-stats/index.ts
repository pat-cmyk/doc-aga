import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60000;
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

interface AnimalStageData {
  birthDate: Date;
  gender: string | null;
  milkingStartDate: Date | null;
  offspringCount: number;
  lastCalvingDate: Date | null;
  hasRecentMilking: boolean;
  hasActiveAI: boolean;
}

function calculateLifeStage(data: AnimalStageData): string | null {
  try {
    const { birthDate, gender, offspringCount, hasActiveAI } = data;
    
    if (!birthDate || gender?.toLowerCase() !== 'female') return null;
    
    const now = new Date();
    const ageInMonths = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (ageInMonths < 0) return null;
    
    if (ageInMonths < 8) return "Calf";
    if (ageInMonths < 12) return "Heifer Calf";
    if (ageInMonths < 15) return "Yearling Heifer";
    
    if (offspringCount === 0) {
      if (hasActiveAI) return "Pregnant Heifer";
      return "Breeding Heifer";
    }
    
    if (offspringCount === 1) return "First-Calf Heifer";
    return "Mature Cow";
  } catch (error) {
    console.error("Error in calculateLifeStage:", error);
    return null;
  }
}

function calculateMilkingStage(data: AnimalStageData): string | null {
  try {
    const { birthDate, gender, lastCalvingDate, hasRecentMilking } = data;
    
    if (!birthDate || gender?.toLowerCase() !== 'female' || !lastCalvingDate) return null;
    
    const now = new Date();
    const daysSinceCalving = Math.floor((now.getTime() - lastCalvingDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceCalving < 0) return null;
    
    if (!hasRecentMilking && daysSinceCalving > 60) return "Dry Period";
    
    if (daysSinceCalving <= 100) return "Early Lactation";
    if (daysSinceCalving <= 200) return "Mid-Lactation";
    if (daysSinceCalving <= 305) return "Late Lactation";
    return "Dry Period";
  } catch (error) {
    console.error("Error in calculateMilkingStage:", error);
    return null;
  }
}

function calculateMaleStage(data: AnimalStageData): string | null {
  try {
    const { birthDate, gender } = data;
    
    if (!birthDate || gender?.toLowerCase() !== 'male') return null;
    
    const now = new Date();
    const ageInMonths = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (ageInMonths < 0) return null;
    
    if (ageInMonths < 12) return "Bull Calf";
    if (ageInMonths < 24) return "Young Bull";
    return "Mature Bull";
  } catch (error) {
    console.error("Error in calculateMaleStage:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication and admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is admin
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting daily stats calculation...');

    // Check if table is empty and backfill if needed
    const { data: existingStats, error: checkError } = await supabase
      .from('daily_farm_stats')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('Error checking existing stats:', checkError);
    }

    let datesToProcess: string[] = [];

    if (!existingStats || existingStats.length === 0) {
      console.log('Table is empty, backfilling last 30 days...');
      // Backfill last 30 days
      for (let i = 1; i <= 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        datesToProcess.push(date.toISOString().split('T')[0]);
      }
    } else {
      // Regular mode: just yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      datesToProcess = [yesterday.toISOString().split('T')[0]];
    }

    console.log(`Processing ${datesToProcess.length} dates: ${datesToProcess.join(', ')}`);

    // Get all farms
    const { data: farms, error: farmsError } = await supabase
      .from('farms')
      .select('id')
      .eq('is_deleted', false);

    if (farmsError) {
      console.error('Error fetching farms:', farmsError);
      throw farmsError;
    }

    console.log(`Processing ${farms?.length || 0} farms`);

    // Process each date
    for (const targetDate of datesToProcess) {
      console.log(`\nProcessing date: ${targetDate}`);

      // Process each farm for this date
      for (const farm of farms || []) {
        console.log(`Processing farm: ${farm.id} for date: ${targetDate}`);

      // Get daily milk total for the farm
      const { data: milkingData, error: milkError } = await supabase
        .from('milking_records')
        .select('liters, animals!inner(farm_id)')
        .eq('animals.farm_id', farm.id)
        .eq('record_date', targetDate);

      if (milkError) {
        console.error(`Error fetching milk data for farm ${farm.id}:`, milkError);
        continue;
      }

      const totalMilk = milkingData?.reduce((sum, r) => sum + Number(r.liters), 0) || 0;
      console.log(`Total milk for farm ${farm.id}: ${totalMilk}L`);

      // Get all animals for the farm
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('id, birth_date, gender, milking_start_date, mother_id')
        .eq('farm_id', farm.id)
        .eq('is_deleted', false);

      if (animalsError) {
        console.error(`Error fetching animals for farm ${farm.id}:`, animalsError);
        continue;
      }

      // Fetch all offspring data for the farm
      const { data: allOffspring } = await supabase
        .from('animals')
        .select('id, mother_id, birth_date')
        .eq('farm_id', farm.id)
        .not('mother_id', 'is', null)
        .lte('birth_date', targetDate)
        .order('birth_date', { ascending: false });

      // Create offspring lookup map
      const offspringByMother = new Map<string, Array<{ birth_date: string }>>();
      allOffspring?.forEach(offspring => {
        if (!offspring.mother_id) return;
        if (!offspringByMother.has(offspring.mother_id)) {
          offspringByMother.set(offspring.mother_id, []);
        }
        offspringByMother.get(offspring.mother_id)!.push({ birth_date: offspring.birth_date });
      });

      // Get AI records to check for active AIs
      const { data: aiRecords } = await supabase
        .from('ai_records')
        .select('animal_id')
        .gte('scheduled_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lte('scheduled_date', targetDate);

      const animalsWithActiveAI = new Set(aiRecords?.map(r => r.animal_id) || []);

      // Get recent milking records (last 30 days from target date)
      const thirtyDaysAgo = new Date(targetDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: recentMilking } = await supabase
        .from('milking_records')
        .select('animal_id')
        .gte('record_date', thirtyDaysAgo.toISOString().split('T')[0])
        .lte('record_date', targetDate);

      const animalsWithRecentMilking = new Set(recentMilking?.map(r => r.animal_id) || []);

      // Calculate stage counts and update animal stages
      const stageCounts: Record<string, number> = {};
      const animalUpdates: Array<{ id: string; life_stage: string | null; milking_stage: string | null }> = [];

      for (const animal of animals || []) {
        if (!animal.birth_date) continue;

        const birthDate = new Date(animal.birth_date);
        const offspring = offspringByMother.get(animal.id) || [];
        const lastCalvingDate = offspring[0]?.birth_date ? new Date(offspring[0].birth_date) : null;

        const stageData: AnimalStageData = {
          birthDate,
          gender: animal.gender,
          milkingStartDate: animal.milking_start_date ? new Date(animal.milking_start_date) : null,
          offspringCount: offspring.length,
          lastCalvingDate,
          hasRecentMilking: animalsWithRecentMilking.has(animal.id),
          hasActiveAI: animalsWithActiveAI.has(animal.id),
        };

        let stageForCount: string | null = null;

        if (animal.gender?.toLowerCase() === 'female') {
          const lifeStage = calculateLifeStage(stageData);
          const milkingStage = calculateMilkingStage(stageData);
          
          // Use milking stage for counting if available, otherwise life stage
          stageForCount = milkingStage || lifeStage;
          
          animalUpdates.push({
            id: animal.id,
            life_stage: lifeStage,
            milking_stage: milkingStage,
          });
        } else if (animal.gender?.toLowerCase() === 'male') {
          const maleStage = calculateMaleStage(stageData);
          stageForCount = maleStage;
          
          animalUpdates.push({
            id: animal.id,
            life_stage: maleStage,
            milking_stage: null,
          });
        }

        if (stageForCount) {
          stageCounts[stageForCount] = (stageCounts[stageForCount] || 0) + 1;
        }
      }

      // Update animal stages in the database
      for (const update of animalUpdates) {
        await supabase
          .from('animals')
          .update({
            life_stage: update.life_stage,
            milking_stage: update.milking_stage,
          })
          .eq('id', update.id);
      }

      console.log(`Stage counts for farm ${farm.id}:`, stageCounts);

      // Upsert the stats into daily_farm_stats table
      const { error: upsertError } = await supabase
        .from('daily_farm_stats')
        .upsert({
          farm_id: farm.id,
          stat_date: targetDate,
          total_milk_liters: totalMilk,
          stage_counts: stageCounts,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'farm_id,stat_date'
        });

      if (upsertError) {
        console.error(`Error upserting stats for farm ${farm.id}:`, upsertError);
        continue;
      }

        console.log(`Successfully saved stats for farm ${farm.id} for date: ${targetDate}`);
      }
    }

    console.log('Daily stats calculation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Calculated stats for ${farms?.length || 0} farms across ${datesToProcess.length} dates`,
        dates: datesToProcess,
        farmsProcessed: farms?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in calculate-daily-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
