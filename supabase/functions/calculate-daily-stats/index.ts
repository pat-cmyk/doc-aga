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

function calculateLifeStage(data: AnimalStageData, livestockType: string = 'cattle'): string | null {
  try {
    const { birthDate, gender, offspringCount, hasActiveAI } = data;
    
    if (!birthDate || gender?.toLowerCase() !== 'female') return null;
    
    const now = new Date();
    const ageInMonths = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (ageInMonths < 0) return null;
    
    const type = livestockType.toLowerCase();
    
    // Young animals (0-8 months)
    if (ageInMonths < 8) {
      if (type === 'goat') return 'Kid';
      if (type === 'sheep') return 'Lamb';
      return 'Calf'; // cattle and carabao
    }
    
    // Adolescent (8-12 months)
    if (ageInMonths < 12) {
      if (type === 'goat') return 'Young Doe';
      if (type === 'sheep') return 'Young Ewe';
      if (type === 'carabao') return 'Young Carabao';
      return 'Heifer Calf'; // cattle
    }
    
    // Cattle-specific yearling stage
    if (ageInMonths < 15 && type === 'cattle') {
      return 'Yearling Heifer';
    }
    
    // Breeding age animals (15+ months) with no offspring
    if (offspringCount === 0) {
      if (hasActiveAI) {
        // Pregnant, no offspring yet
        if (type === 'goat') return 'Pregnant Doe';
        if (type === 'sheep') return 'Pregnant Ewe';
        if (type === 'carabao') return 'Pregnant Carabao';
        return 'Pregnant Heifer'; // cattle
      }
      // Ready for breeding
      if (type === 'goat') return 'Breeding Doe';
      if (type === 'sheep') return 'Breeding Ewe';
      if (type === 'carabao') return 'Breeding Carabao';
      return 'Breeding Heifer'; // cattle
    }
    
    // Has offspring
    if (offspringCount === 1) {
      if (type === 'goat') return 'Lactating Doe';
      if (type === 'sheep') return 'Lactating Ewe';
      if (type === 'carabao') return 'First-Time Mother';
      return 'First-Calf Heifer'; // cattle
    }
    
    // Multiple offspring
    if (type === 'goat') return 'Lactating Doe';
    if (type === 'sheep') return 'Lactating Ewe';
    if (type === 'carabao') return 'Mature Carabao';
    return 'Mature Cow'; // cattle
    
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

function calculateMaleStage(data: AnimalStageData, livestockType: string = 'cattle'): string | null {
  try {
    const { birthDate, gender } = data;
    
    if (!birthDate || gender?.toLowerCase() !== 'male') return null;
    
    const now = new Date();
    const ageInMonths = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (ageInMonths < 0) return null;
    
    const type = livestockType.toLowerCase();
    
    if (ageInMonths < 12) {
      if (type === 'goat') return 'Buck Kid';
      if (type === 'sheep') return 'Ram Lamb';
      return 'Bull Calf'; // cattle and carabao
    }
    
    if (ageInMonths < 24) {
      if (type === 'goat') return 'Young Buck';
      if (type === 'sheep') return 'Young Ram';
      return 'Young Bull'; // cattle and carabao
    }
    
    if (type === 'goat') return 'Mature Buck';
    if (type === 'sheep') return 'Mature Ram';
    return 'Mature Bull'; // cattle and carabao
    
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

    // Rate limiting
    const identifier = user.id;
    const rateCheck = checkRateLimit(identifier, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter || 60) }
      });
    }

    console.log('Starting daily stats calculation...');

    // Parse optional date range from request body
    const requestBody = await req.text();
    let startDate: string | null = null;
    let endDate: string | null = null;
    
    if (requestBody) {
      try {
        const body = JSON.parse(requestBody);
        startDate = body.start_date || null;
        endDate = body.end_date || null;
      } catch (e) {
        // If JSON parsing fails, continue with default behavior
        console.log('No date range provided, using default behavior');
      }
    }

    let datesToProcess: string[] = [];

    if (startDate && endDate) {
      // Custom date range mode
      console.log(`Processing custom date range: ${startDate} to ${endDate}`);
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesToProcess.push(d.toISOString().split('T')[0]);
      }
    } else {
      // Default behavior: check if table is empty and backfill if needed
      const { data: existingStats, error: checkError } = await supabase
        .from('daily_farm_stats')
        .select('id')
        .limit(1);

      if (checkError) {
        console.error('Error checking existing stats:', checkError);
      }

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

      // Get all animals for the farm (only those registered by target date)
      const { data: animals, error: animalsError } = await supabase
        .from('animals')
        .select('id, birth_date, gender, milking_start_date, mother_id, livestock_type')
        .eq('farm_id', farm.id)
        .eq('is_deleted', false)
        .lte('created_at', targetDate + 'T23:59:59Z');

      if (animalsError) {
        console.error(`Error fetching animals for farm ${farm.id}:`, animalsError);
        continue;
      }

      // Fetch all offspring data for the farm (only those registered by target date)
      const { data: allOffspring } = await supabase
        .from('animals')
        .select('id, mother_id, birth_date')
        .eq('farm_id', farm.id)
        .not('mother_id', 'is', null)
        .lte('birth_date', targetDate)
        .lte('created_at', targetDate + 'T23:59:59Z')
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
          const lifeStage = calculateLifeStage(stageData, animal.livestock_type || 'cattle');
          const milkingStage = calculateMilkingStage(stageData);
          
          // Use milking stage for counting if available, otherwise life stage
          stageForCount = milkingStage || lifeStage;
          
          animalUpdates.push({
            id: animal.id,
            life_stage: lifeStage,
            milking_stage: milkingStage,
          });
        } else if (animal.gender?.toLowerCase() === 'male') {
          const maleStage = calculateMaleStage(stageData, animal.livestock_type || 'cattle');
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
