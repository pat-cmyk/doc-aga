import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnimalStageData {
  birthDate: Date;
  gender: string | null;
  milkingStartDate: Date | null;
  offspringCount: number;
  lastCalvingDate: Date | null;
  hasRecentMilking: boolean;
  hasActiveAI: boolean;
}

function calculateMilkingStage(data: AnimalStageData): string | null {
  if (data.gender?.toLowerCase() !== 'female') return null;
  
  const now = new Date();
  const ageInMonths = data.birthDate 
    ? Math.floor((now.getTime() - data.birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) 
    : 0;

  if (ageInMonths < 15) return null;

  if (data.lastCalvingDate) {
    const daysSinceCalving = Math.floor((now.getTime() - data.lastCalvingDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceCalving <= 100) return "Early Lactation";
    if (daysSinceCalving <= 200) return "Mid-Lactation";
    if (daysSinceCalving <= 305) return "Late Lactation";
    return "Dry Period";
  }

  return "Dry Period";
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting daily stats calculation...');

    // Get yesterday's date (since we're calculating for the previous day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0];

    console.log(`Calculating stats for date: ${targetDate}`);

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

    // Process each farm
    for (const farm of farms || []) {
      console.log(`Processing farm: ${farm.id}`);

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

      // Calculate stage counts
      const stageCounts: Record<string, number> = {};

      for (const animal of animals || []) {
        if (animal.gender?.toLowerCase() !== 'female') continue;
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
          hasRecentMilking: false,
          hasActiveAI: false,
        };

        const milkingStage = calculateMilkingStage(stageData);

        if (milkingStage) {
          stageCounts[milkingStage] = (stageCounts[milkingStage] || 0) + 1;
        }
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

      console.log(`Successfully saved stats for farm ${farm.id}`);
    }

    console.log('Daily stats calculation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Calculated stats for ${farms?.length || 0} farms`,
        date: targetDate 
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
