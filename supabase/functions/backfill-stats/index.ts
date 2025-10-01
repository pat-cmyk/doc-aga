import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

function calculateLifeStage(data: AnimalStageData): string | null {
  const { birthDate, gender } = data;
  if (!birthDate || gender?.toLowerCase() !== 'female') return null;
  
  const ageInMonths = Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  
  if (ageInMonths < 12) return "Calf";
  if (ageInMonths < 15) return "Weaned Heifer";
  if (ageInMonths < 24) return "Breeding Heifer";
  if (data.offspringCount === 0) return "Pregnant Heifer";
  return "Mature Cow";
}

function calculateMilkingStage(data: AnimalStageData): string | null {
  const { birthDate, gender, milkingStartDate, lastCalvingDate, hasRecentMilking, hasActiveAI } = data;
  
  if (!birthDate || gender?.toLowerCase() !== 'female') return null;
  
  if (!milkingStartDate) return null;
  
  const daysSinceCalving = lastCalvingDate 
    ? Math.floor((Date.now() - lastCalvingDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  if (daysSinceCalving === null) {
    return hasRecentMilking ? "Early Lactation" : null;
  }
  
  if (daysSinceCalving > 305) {
    return hasActiveAI ? "Late Lactation (AI Scheduled)" : "Dry Period";
  }
  
  if (daysSinceCalving <= 100) return "Early Lactation";
  if (daysSinceCalving <= 200) return "Mid Lactation";
  return "Late Lactation";
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { startDate, endDate, farmId } = await req.json();
    
    if (!startDate || !endDate || !farmId) {
      throw new Error('startDate, endDate, and farmId are required');
    }

    console.log(`Backfilling monthly stats for farm ${farmId} from ${startDate} to ${endDate}`);

    // Get all animals for the farm
    const { data: allAnimals, error: animalsError } = await supabaseClient
      .from('animals')
      .select('id, birth_date, gender, milking_start_date, mother_id')
      .eq('farm_id', farmId)
      .eq('is_deleted', false);

    if (animalsError) throw animalsError;

    // Get all offspring
    const { data: allOffspring, error: offspringError } = await supabaseClient
      .from('animals')
      .select('id, mother_id, birth_date')
      .eq('farm_id', farmId)
      .not('mother_id', 'is', null)
      .order('birth_date', { ascending: false });

    if (offspringError) throw offspringError;

    // Create offspring lookup map
    const offspringByMother = new Map<string, Array<{ birth_date: string }>>();
    allOffspring?.forEach(offspring => {
      if (!offspring.mother_id) return;
      if (!offspringByMother.has(offspring.mother_id)) {
        offspringByMother.set(offspring.mother_id, []);
      }
      offspringByMother.get(offspring.mother_id)!.push({ birth_date: offspring.birth_date });
    });

    // Create array of last days of each month
    const monthDates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    
    while (currentMonth <= end) {
      // Get last day of current month
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      // Only add if it's within our range
      if (lastDay >= start && lastDay <= end) {
        monthDates.push(lastDay.toISOString().split('T')[0]);
      }
      
      // Move to next month
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    }

    console.log(`Processing ${monthDates.length} months...`);

    // Process each month (last day of each month)
    const statsToUpsert = [];
    
    for (const date of monthDates) {
      const stageCounts: Record<string, number> = {};

      // Get AI records within 90 days of this date
      const ninetyDaysBefore = new Date(date);
      ninetyDaysBefore.setDate(ninetyDaysBefore.getDate() - 90);
      
      const { data: aiRecords } = await supabaseClient
        .from('ai_records')
        .select('animal_id')
        .gte('scheduled_date', ninetyDaysBefore.toISOString().split('T')[0])
        .lte('scheduled_date', date);

      const animalsWithActiveAI = new Set(aiRecords?.map(r => r.animal_id) || []);

      // Get milking records within 30 days of this date
      const thirtyDaysBefore = new Date(date);
      thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);
      
      const { data: recentMilking } = await supabaseClient
        .from('milking_records')
        .select('animal_id')
        .gte('record_date', thirtyDaysBefore.toISOString().split('T')[0])
        .lte('record_date', date);

      const animalsWithRecentMilking = new Set(recentMilking?.map(r => r.animal_id) || []);

      // Calculate stages for each animal on this date
      allAnimals?.forEach(animal => {
        if (!animal.birth_date) return;
        
        const birthDate = new Date(animal.birth_date);
        const checkDate = new Date(date);
        
        // Skip if animal wasn't born yet
        if (birthDate > checkDate) return;

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
          stageForCount = milkingStage || lifeStage;
        } else if (animal.gender?.toLowerCase() === 'male') {
          const ageInMonths = Math.floor((checkDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          if (ageInMonths < 12) stageForCount = "Bull Calf";
          else if (ageInMonths < 24) stageForCount = "Young Bull";
          else stageForCount = "Mature Bull";
        }

        if (stageForCount) {
          stageCounts[stageForCount] = (stageCounts[stageForCount] || 0) + 1;
        }
      });

      statsToUpsert.push({
        farm_id: farmId,
        month_date: date,
        stage_counts: stageCounts,
      });
    }

    console.log(`Upserting ${statsToUpsert.length} monthly stat records...`);

    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < statsToUpsert.length; i += batchSize) {
      const batch = statsToUpsert.slice(i, i + batchSize);
      
      const { error: upsertError } = await supabaseClient
        .from('monthly_farm_stats')
        .upsert(batch, {
          onConflict: 'farm_id,month_date',
        });

      if (upsertError) {
        console.error(`Error upserting batch ${i / batchSize + 1}:`, upsertError);
        throw upsertError;
      }
      
      console.log(`Processed batch ${i / batchSize + 1} of ${Math.ceil(statsToUpsert.length / batchSize)}`);
    }

    console.log('Backfill completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Backfilled ${statsToUpsert.length} months of data`,
        processed: statsToUpsert.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in backfill-stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
