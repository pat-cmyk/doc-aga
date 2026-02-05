import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Data category type for live/demo data segregation (SSOT with frontend)
type DataCategory = 'live' | 'demo' | 'all';

// Maximum IDs per batch to avoid PostgREST URL length limits
const MAX_IDS_PER_BATCH = 200;

// ============= PRE-CALVING RISK SCORE (PCRS) CALCULATIONS =============
// Based on veterinary research from Penn State, UGA Extension, Merck Vet Manual

interface PCRSBreakdown {
  timeline: number;
  bcs: number;
  parity: number;
  health: number;
  dataFreshness: number;
}

interface PCRSResult {
  totalScore: number;
  tier: 'critical' | 'high' | 'moderate' | 'low';
  tierLabel: string;
  breakdown: PCRSBreakdown;
  factors: string[];
}

/**
 * Calculate timeline proximity score (0-35 pts)
 */
function calculateTimelineScore(daysUntilDelivery: number): number {
  if (daysUntilDelivery < 7) return 35;
  if (daysUntilDelivery <= 14) return 25;
  if (daysUntilDelivery <= 30) return 15;
  if (daysUntilDelivery <= 60) return 5;
  return 0;
}

/**
 * Calculate BCS risk score (0-25 pts)
 * Ideal BCS at calving: 2.5-3.5 (on 5-point scale)
 */
function calculateBCSScore(bcs: number | null): number {
  if (bcs === null) return 5; // Missing data = slight penalty
  if (bcs < 2.0) return 25;
  if (bcs < 2.5) return 15;
  if (bcs > 4.5) return 25;
  if (bcs > 4.0) return 10;
  return 0; // Ideal range
}

/**
 * Calculate parity risk score (0-15 pts)
 * Primiparous (first-calf) have 3-4x higher dystocia risk
 */
function calculateParityScore(parity: number | null): number {
  if (parity === null) return 5; // Unknown parity = slight penalty
  if (parity === 0) return 15; // First calving
  if (parity <= 2) return 5;
  return 0; // Experienced
}

/**
 * Calculate health history score (0-15 pts)
 * Based on number of health issues in last 90 days
 */
function calculateHealthHistoryScore(issueCount: number): number {
  if (issueCount >= 3) return 15;
  if (issueCount === 2) return 10;
  if (issueCount === 1) return 5;
  return 0;
}

/**
 * Calculate data freshness score (0-10 pts)
 * Based on days since last BCS assessment
 */
function calculateDataFreshnessScore(daysSinceLastBCS: number | null): number {
  if (daysSinceLastBCS === null) return 10; // No BCS data = high penalty
  if (daysSinceLastBCS > 60) return 10;
  if (daysSinceLastBCS > 30) return 5;
  return 0;
}

/**
 * Get PCRS tier based on total score
 */
function getPCRSTier(score: number): { tier: 'critical' | 'high' | 'moderate' | 'low'; label: string } {
  if (score >= 75) return { tier: 'critical', label: 'Critical' };
  if (score >= 50) return { tier: 'high', label: 'High' };
  if (score >= 25) return { tier: 'moderate', label: 'Moderate' };
  return { tier: 'low', label: 'Low' };
}

/**
 * Calculate complete Pre-Calving Risk Score
 */
function calculatePCRS(input: {
  daysUntilDelivery: number;
  latestBCS: number | null;
  parity: number | null;
  healthIssueCount: number;
  daysSinceLastBCS: number | null;
}): PCRSResult {
  const timeline = calculateTimelineScore(input.daysUntilDelivery);
  const bcs = calculateBCSScore(input.latestBCS);
  const parity = calculateParityScore(input.parity);
  const health = calculateHealthHistoryScore(input.healthIssueCount);
  const dataFreshness = calculateDataFreshnessScore(input.daysSinceLastBCS);

  const totalScore = timeline + bcs + parity + health + dataFreshness;
  const { tier, label } = getPCRSTier(totalScore);

  // Build factor explanations
  const factors: string[] = [];
  if (timeline >= 25) factors.push(`Delivery imminent (${input.daysUntilDelivery} days)`);
  if (bcs >= 15) factors.push(input.latestBCS !== null ? `BCS concern (${input.latestBCS})` : 'No BCS data');
  if (parity >= 10) factors.push('First-time calving (primiparous)');
  if (health >= 10) factors.push(`Recent health issues (${input.healthIssueCount})`);
  if (dataFreshness >= 5) factors.push('BCS data needs update');

  return {
    totalScore,
    tier,
    tierLabel: label,
    breakdown: { timeline, bcs, parity, health, dataFreshness },
    factors,
  };
}

/**
 * Batch large ID arrays and combine results (avoids PostgREST URL limits)
 */
async function batchQuery<T>(
  ids: string[],
  queryFn: (batchIds: string[]) => Promise<{ data: T[] | null; error: any }>
): Promise<{ data: T[]; error: any }> {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  if (ids.length <= MAX_IDS_PER_BATCH) {
    const result = await queryFn(ids);
    return { data: result.data || [], error: result.error };
  }

  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_BATCH) {
    batches.push(ids.slice(i, i + MAX_IDS_PER_BATCH));
  }

  const allResults: T[] = [];
  let lastError: any = null;

  for (const batch of batches) {
    const { data, error } = await queryFn(batch);
    if (error) {
      console.error('[batchQuery] Batch error:', error.message);
      lastError = error;
    }
    if (data) {
      allResults.push(...data);
    }
  }

  return { data: allResults, error: lastError };
}

/**
 * Get farm IDs filtered by data category (SSOT helper)
 * Returns null if 'all' or no filter needed, meaning query all farms
 */
async function getFilteredFarmIds(
  supabase: SupabaseClient,
  dataCategory?: DataCategory
): Promise<string[] | null> {
  if (!dataCategory || dataCategory === 'all') return null;

  const { data: farms, error } = await supabase
    .from('farms')
    .select('id')
    .eq('data_category', dataCategory)
    .eq('is_deleted', false);

  if (error) {
    console.error('[getFilteredFarmIds] Error:', error.message);
    return null;
  }

   console.log(`[getFilteredFarmIds] Category: ${dataCategory}, Found: ${farms?.length || 0} farms`);
  return farms?.map(f => f.id) || [];
}

 /**
  * Get animal IDs filtered by data category (two-stage query helper)
  * This works around PostgREST limitation with nested .in() filters on relations
  * Returns null if 'all' or no filter needed, meaning query all animals
  */
 async function getFilteredAnimalIds(
   supabase: SupabaseClient,
   dataCategory?: DataCategory
 ): Promise<string[] | null> {
   // Get farm IDs first
   const farmIds = await getFilteredFarmIds(supabase, dataCategory);
   
   if (farmIds === null) return null; // No filter needed
   if (farmIds.length === 0) return []; // No farms found
   
   // Get animal IDs from those farms
   const { data: animals, error } = await supabase
     .from('animals')
     .select('id')
     .in('farm_id', farmIds)
     .eq('is_deleted', false);
   
   if (error) {
     console.error('[getFilteredAnimalIds] Error:', error.message);
     return null;
   }
   
   console.log(`[getFilteredAnimalIds] Found ${animals?.length || 0} animals for dataCategory '${dataCategory}'`);
   return animals?.map(a => a.id) || [];
 }
 
export async function executeToolCall(
  toolName: string,
  args: any,
  supabase: SupabaseClient,
  farmId: string | undefined,
  context: 'farmer' | 'government' = 'farmer',
  userId?: string,
  conversationId?: string,
  dataCategory?: DataCategory
) {
  console.log(`Executing tool: ${toolName} (context: ${context})`, args);

  // Government analyst tools
  if (context === 'government') {
    switch (toolName) {
      case "get_national_overview":
        return await getNationalOverview(supabase, dataCategory);
      
      case "get_regional_stats":
        return await getRegionalStats(args, supabase, dataCategory);
      
      case "get_breeding_analytics":
        return await getBreedingAnalytics(args, supabase, dataCategory);
      
      case "get_health_analytics":
        return await getHealthAnalytics(args, supabase, dataCategory);
      
      case "get_production_trends":
        return await getProductionTrends(args, supabase, dataCategory);
      
      case "get_farmer_feedback_summary":
        return await getFarmerFeedbackSummary(args, supabase, dataCategory);
      
      case "get_expected_deliveries_analysis":
        return await getExpectedDeliveriesAnalysis(args, supabase, dataCategory);
      
      case "get_delivery_risk_assessment":
        return await getDeliveryRiskAssessment(args, supabase, dataCategory);
      
      case "get_cohort_health_analysis":
        return await getCohortHealthAnalysis(args, supabase, dataCategory);
      
      default:
        return { error: `Unknown government tool: ${toolName}` };
    }
  }

  // Farmer tools
  switch (toolName) {
    case "get_animal_profile":
      return await getAnimalProfile(args, supabase, farmId);
    
    case "get_animal_complete_profile":
      return await getAnimalCompleteProfile(args, supabase, farmId);
    
    case "search_animals":
      return await searchAnimals(args, supabase, farmId);
    
    case "add_health_record":
      return await addHealthRecord(args, supabase, farmId);
    
    case "update_health_record":
      return await updateHealthRecord(args, supabase, farmId);
    
    case "add_health_resolution":
      return await addHealthResolution(args, supabase, farmId);
    
    case "add_weight_record":
      return await addWeightRecord(args, supabase, farmId);
    
    case "update_weight_record":
      return await updateWeightRecord(args, supabase, farmId);
    
    case "update_milking_record":
      return await updateMilkingRecord(args, supabase, farmId);
    
    case "update_ai_record":
      return await updateAIRecord(args, supabase, farmId);
    
    case "update_feeding_record":
      return await updateFeedingRecord(args, supabase, farmId);
    
    case "update_injection_record":
      return await updateInjectionRecord(args, supabase, farmId);
    
    case "add_smart_milking_record":
      return await addSmartMilkingRecord(args, supabase, farmId);
    
    case "add_milking_record":
      return await addMilkingRecord(args, supabase, farmId);
    
    case "add_ai_record":
      return await addAIRecord(args, supabase, farmId);
    
    case "add_animal_event":
      return await addAnimalEvent(args, supabase, farmId);
    
    case "add_feeding_record":
      return await addFeedingRecord(args, supabase, farmId);
    
    case "add_injection_record":
      return await addInjectionRecord(args, supabase, farmId);
    
    case "get_farm_overview":
      return await getFarmOverview(supabase, farmId);
    
    case "get_farm_analytics":
      return await getFarmAnalytics(args, supabase, farmId);
    
    case "get_pregnant_animals":
      return await getPregnantAnimals(supabase, farmId);
    
    case "get_recent_events":
      return await getRecentEvents(args, supabase, farmId);
    
    // NEW: Comprehensive farm data query tools
    case "get_milk_production":
      return await getMilkProduction(args, supabase, farmId);
    
    case "get_health_history":
      return await getHealthHistory(args, supabase, farmId);
    
    case "get_breeding_status":
      return await getBreedingStatus(args, supabase, farmId);
    
    case "get_weight_history":
      return await getWeightHistory(args, supabase, farmId);
    
    case "get_feeding_summary":
      return await getFeedingSummary(args, supabase, farmId);
    
    case "get_conversation_context":
      return await getConversationContext(args, supabase, userId);
    
    case "get_farm_context":
      return await getFarmContext(supabase, farmId);
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ============= GOVERNMENT ANALYST TOOLS =============

async function getNationalOverview(supabase: SupabaseClient, dataCategory?: DataCategory) {
  // Get filtered farm IDs based on data category
  const farmIds = await getFilteredFarmIds(supabase, dataCategory);
  
  // Get total farms count
  let farmsQuery = supabase
    .from('farms')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false);
  
  if (farmIds) {
    farmsQuery = farmsQuery.in('id', farmIds);
  } else if (dataCategory && dataCategory !== 'all') {
    farmsQuery = farmsQuery.eq('data_category', dataCategory);
  }
  
  const { count: totalFarms } = await farmsQuery;

  // Get total animals count by livestock type
  let animalsQuery = supabase
    .from('animals')
    .select('livestock_type, life_stage, milking_stage')
    .eq('is_deleted', false);
  
  if (farmIds) {
    animalsQuery = animalsQuery.in('farm_id', farmIds);
  }
  
  const { data: animals } = await animalsQuery;

  const totalAnimals = animals?.length || 0;
  const livestockBreakdown: Record<string, number> = {};
  let totalLactating = 0;

  animals?.forEach(a => {
    const type = a.livestock_type || 'Unknown';
    livestockBreakdown[type] = (livestockBreakdown[type] || 0) + 1;
    
    const isLactating = 
      (a.milking_stage && a.milking_stage !== 'Dry Period') ||
      (a.life_stage && a.life_stage.includes('Lactating'));
    if (isLactating) totalLactating++;
  });

  // Get farms by region
  let regionQuery = supabase
    .from('farms')
    .select('region')
    .eq('is_deleted', false);
  
  if (farmIds) {
    regionQuery = regionQuery.in('id', farmIds);
  } else if (dataCategory && dataCategory !== 'all') {
    regionQuery = regionQuery.eq('data_category', dataCategory);
  }
  
  const { data: farmsByRegion } = await regionQuery;

  const regionBreakdown: Record<string, number> = {};
  farmsByRegion?.forEach(f => {
    const region = f.region || 'Unknown';
    regionBreakdown[region] = (regionBreakdown[region] || 0) + 1;
  });

  // Get today's total milk production
  const today = new Date().toISOString().split('T')[0];
  const { data: milkToday } = await supabase
    .from('milking_records')
    .select('liters')
    .gte('record_date', today);

  const todayMilk = milkToday?.reduce((sum, r) => sum + Number(r.liters), 0) || 0;

  // Get AI procedure stats this month
  const monthStart = new Date();
  monthStart.setDate(1);
  const { count: aiProceduresThisMonth } = await supabase
    .from('ai_records')
    .select('*', { count: 'exact', head: true })
    .gte('performed_date', monthStart.toISOString().split('T')[0]);

  return {
    total_farms: totalFarms || 0,
    total_animals: totalAnimals,
    total_lactating: totalLactating,
    livestock_breakdown: livestockBreakdown,
    farms_by_region: regionBreakdown,
    today_milk_liters: todayMilk,
    ai_procedures_this_month: aiProceduresThisMonth || 0,
  };
}

async function getRegionalStats(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const region = args.region;
  
  // Get filtered farm IDs based on data category
  const categoryFarmIds = await getFilteredFarmIds(supabase, dataCategory);
  
  let farmsQuery = supabase
    .from('farms')
    .select('id, name, province, municipality')
    .eq('is_deleted', false);

  if (region) {
    farmsQuery = farmsQuery.eq('region', region);
  }
  
  // Apply data category filter
  if (categoryFarmIds) {
    farmsQuery = farmsQuery.in('id', categoryFarmIds);
  } else if (dataCategory && dataCategory !== 'all') {
    farmsQuery = farmsQuery.eq('data_category', dataCategory);
  }

  const { data: farms } = await farmsQuery;
  const farmIds = farms?.map(f => f.id) || [];

  if (farmIds.length === 0) {
    return { 
      region: region || 'All Regions',
      total_farms: 0,
      total_animals: 0,
      message: "No farms found in this region"
    };
  }

  // Get animals for these farms
  const { data: animals } = await supabase
    .from('animals')
    .select('livestock_type, life_stage, milking_stage')
    .in('farm_id', farmIds)
    .eq('is_deleted', false);

  const livestockBreakdown: Record<string, number> = {};
  let totalLactating = 0;

  animals?.forEach(a => {
    const type = a.livestock_type || 'Unknown';
    livestockBreakdown[type] = (livestockBreakdown[type] || 0) + 1;
    
    const isLactating = 
      (a.milking_stage && a.milking_stage !== 'Dry Period') ||
      (a.life_stage && a.life_stage.includes('Lactating'));
    if (isLactating) totalLactating++;
  });

  // Province breakdown
  const provinceBreakdown: Record<string, number> = {};
  farms?.forEach(f => {
    const province = f.province || 'Unknown';
    provinceBreakdown[province] = (provinceBreakdown[province] || 0) + 1;
  });

  return {
    region: region || 'All Regions',
    total_farms: farms?.length || 0,
    total_animals: animals?.length || 0,
    total_lactating: totalLactating,
    livestock_breakdown: livestockBreakdown,
    farms_by_province: provinceBreakdown,
  };
}

async function getBreedingAnalytics(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const days = args.days || 90;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

   // Get filtered animal IDs based on data category (two-stage pattern)
   const animalIds = await getFilteredAnimalIds(supabase, dataCategory);
   
   if (animalIds && animalIds.length === 0) {
     return {
       period_days: days,
       total_ai_procedures: 0,
       confirmed_pregnancies: 0,
       overall_success_rate: 0,
       success_rate_by_type: {},
       currently_pregnant: 0,
       message: `No animals found for data category '${dataCategory}'`
     };
   }

  // Stage 1: Get AI records with simple column filters (SSOT two-stage pattern)
  let aiRecords: any[] = [];
  let aiError: any = null;

  if (animalIds && animalIds.length > MAX_IDS_PER_BATCH) {
    // Use batched query for large ID arrays
    const result = await batchQuery(animalIds, async (batchIds) => {
      return await supabase
        .from('ai_records')
        .select('id, animal_id, performed_date, pregnancy_confirmed')
        .gte('performed_date', startDate)
        .not('performed_date', 'is', null)
        .in('animal_id', batchIds);
    });
    aiRecords = result.data;
    aiError = result.error;
  } else {
    // Standard query for smaller sets
    let aiQuery = supabase
      .from('ai_records')
      .select('id, animal_id, performed_date, pregnancy_confirmed')
      .gte('performed_date', startDate)
      .not('performed_date', 'is', null);
    
    if (animalIds) {
      aiQuery = aiQuery.in('animal_id', animalIds);
    }
    
    const result = await aiQuery;
    aiRecords = result.data || [];
    aiError = result.error;
  }

  // Log any errors
  if (aiError) {
    console.error('[getBreedingAnalytics] ai_records query error:', aiError.message);
    return {
      period_days: days,
      total_ai_procedures: 0,
      confirmed_pregnancies: 0,
      overall_success_rate: 0,
      success_rate_by_type: {},
      currently_pregnant: 0,
      error: true,
      message: `Query error: ${aiError.message}`
    };
  }

  console.log(`[getBreedingAnalytics] Found ${aiRecords?.length || 0} AI records`);

  // Stage 2: Get animal details separately for livestock type analysis
  const animalIdsWithRecords = [...new Set(aiRecords?.map(r => r.animal_id) || [])];
  let animalsMap: Record<string, { livestock_type: string }> = {};
  
  if (animalIdsWithRecords.length > 0) {
    const { data: animalDetails, error: animalError } = await supabase
      .from('animals')
      .select('id, livestock_type')
      .in('id', animalIdsWithRecords);
    
    if (animalError) {
      console.error('[getBreedingAnalytics] animals query error:', animalError.message);
    } else {
      animalDetails?.forEach(a => {
        animalsMap[a.id] = { livestock_type: a.livestock_type };
      });
    }
  }

  const totalAI = aiRecords?.length || 0;
  const confirmedPregnancies = aiRecords?.filter(r => r.pregnancy_confirmed)?.length || 0;
  const successRate = totalAI > 0 ? Math.round((confirmedPregnancies / totalAI) * 100) : 0;

  // Success rate by livestock type (using enriched data)
  const aiByType: Record<string, { total: number; confirmed: number }> = {};
  aiRecords?.forEach((r: any) => {
    const type = animalsMap[r.animal_id]?.livestock_type || 'Unknown';
    if (!aiByType[type]) aiByType[type] = { total: 0, confirmed: 0 };
    aiByType[type].total++;
    if (r.pregnancy_confirmed) aiByType[type].confirmed++;
  });

  const successByType: Record<string, number> = {};
  Object.entries(aiByType).forEach(([type, stats]) => {
    successByType[type] = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;
  });

  // Stage 3: Get currently pregnant animals count (simple query)
  let pregnantQuery = supabase
    .from('ai_records')
    .select('id', { count: 'exact', head: true })
    .eq('pregnancy_confirmed', true);
  
   if (animalIds) {
     pregnantQuery = pregnantQuery.in('animal_id', animalIds);
  }
  
  const { count: pregnantCount, error: pregnantError } = await pregnantQuery;
  
  if (pregnantError) {
    console.error('[getBreedingAnalytics] pregnant count error:', pregnantError.message);
  }

  return {
    period_days: days,
    total_ai_procedures: totalAI,
    confirmed_pregnancies: confirmedPregnancies,
    overall_success_rate: successRate,
    success_rate_by_type: successByType,
    currently_pregnant: pregnantCount || 0,
  };
}

async function getHealthAnalytics(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const days = args.days || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

   // Get filtered animal IDs based on data category (two-stage pattern)
   const animalIds = await getFilteredAnimalIds(supabase, dataCategory);
   
   // Also get farm IDs for animals exit query
   const farmIds = await getFilteredFarmIds(supabase, dataCategory);
   
   if (animalIds && animalIds.length === 0) {
     return {
       period_days: days,
       total_health_records: 0,
       top_diagnoses: [],
       animal_exits: {},
       total_exits: 0,
       message: `No animals found for data category '${dataCategory}'`
     };
   }

  // Get health records
  let healthQuery = supabase
    .from('health_records')
    .select('diagnosis, treatment, visit_date, animals!inner(farm_id)')
    .gte('visit_date', startDate);
  
   if (animalIds) {
     healthQuery = healthQuery.in('animal_id', animalIds);
  }
  
  const { data: healthRecords } = await healthQuery;

  const totalRecords = healthRecords?.length || 0;

  // Common diagnoses
  const diagnosisCount: Record<string, number> = {};
  healthRecords?.forEach(r => {
    const diagnosis = r.diagnosis || 'Unspecified';
    diagnosisCount[diagnosis] = (diagnosisCount[diagnosis] || 0) + 1;
  });

  // Sort by count
  const topDiagnoses = Object.entries(diagnosisCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([diagnosis, count]) => ({ diagnosis, count }));

  // Animal exits (mortality, sales)
  let exitsQuery = supabase
    .from('animals')
    .select('exit_reason, exit_date')
    .gte('exit_date', startDate)
    .not('exit_date', 'is', null);
  
  if (farmIds) {
    exitsQuery = exitsQuery.in('farm_id', farmIds);
  }
  
  const { data: exitedAnimals } = await exitsQuery;

  const exitReasons: Record<string, number> = {};
  exitedAnimals?.forEach(a => {
    const reason = a.exit_reason || 'Unknown';
    exitReasons[reason] = (exitReasons[reason] || 0) + 1;
  });

  return {
    period_days: days,
    total_health_records: totalRecords,
    top_diagnoses: topDiagnoses,
    animal_exits: exitReasons,
    total_exits: exitedAnimals?.length || 0,
  };
}

async function getProductionTrends(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const days = args.days || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

   // Get filtered animal IDs based on data category (two-stage pattern)
   const animalIds = await getFilteredAnimalIds(supabase, dataCategory);
   
   if (animalIds && animalIds.length === 0) {
     return {
       period_days: days,
       total_milk_liters: 0,
       average_daily_liters: 0,
       production_by_livestock_type: {},
       daily_trend: [],
       message: `No animals found for data category '${dataCategory}'`
     };
   }

  // Get daily milk production
  let milkQuery = supabase
    .from('milking_records')
    .select('record_date, liters, animals!inner(livestock_type, farm_id)')
    .gte('record_date', startDate)
    .order('record_date', { ascending: true });
  
   if (animalIds) {
     milkQuery = milkQuery.in('animal_id', animalIds);
  }
  
  const { data: milkRecords } = await milkQuery;

  // Aggregate by date
  const dailyTotals: Record<string, number> = {};
  const dailyByType: Record<string, Record<string, number>> = {};

  milkRecords?.forEach((r: any) => {
    const date = r.record_date;
    const type = r.animals?.livestock_type || 'Unknown';
    
    dailyTotals[date] = (dailyTotals[date] || 0) + Number(r.liters);
    
    if (!dailyByType[date]) dailyByType[date] = {};
    dailyByType[date][type] = (dailyByType[date][type] || 0) + Number(r.liters);
  });

  // Calculate averages
  const dates = Object.keys(dailyTotals);
  const totalMilk = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
  const avgDaily = dates.length > 0 ? Math.round(totalMilk / dates.length) : 0;

  // Total by livestock type
  const totalByType: Record<string, number> = {};
  milkRecords?.forEach((r: any) => {
    const type = r.animals?.livestock_type || 'Unknown';
    totalByType[type] = (totalByType[type] || 0) + Number(r.liters);
  });

  return {
    period_days: days,
    total_milk_liters: Math.round(totalMilk),
    average_daily_liters: avgDaily,
    production_by_livestock_type: totalByType,
    daily_trend: Object.entries(dailyTotals).map(([date, liters]) => ({ date, liters })),
  };
}

async function getFarmerFeedbackSummary(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const days = args.days || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Get filtered farm IDs based on data category
  const farmIds = await getFilteredFarmIds(supabase, dataCategory);

  // Get feedback records
  let feedbackQuery = supabase
    .from('farmer_feedback')
    .select('primary_category, sentiment, status, auto_priority, created_at, farm_id')
    .gte('created_at', startDate);
  
  if (farmIds) {
    feedbackQuery = feedbackQuery.in('farm_id', farmIds);
  }
  
  const { data: feedback } = await feedbackQuery;

  const totalFeedback = feedback?.length || 0;

  // Category breakdown
  const categoryCount: Record<string, number> = {};
  feedback?.forEach(f => {
    const category = f.primary_category || 'Unknown';
    categoryCount[category] = (categoryCount[category] || 0) + 1;
  });

  // Sentiment breakdown
  const sentimentCount: Record<string, number> = {};
  feedback?.forEach(f => {
    const sentiment = f.sentiment || 'Unknown';
    sentimentCount[sentiment] = (sentimentCount[sentiment] || 0) + 1;
  });

  // Status breakdown
  const statusCount: Record<string, number> = {};
  feedback?.forEach(f => {
    const status = f.status || 'Unknown';
    statusCount[status] = (statusCount[status] || 0) + 1;
  });

  // Priority breakdown
  const priorityCount: Record<string, number> = {};
  feedback?.forEach(f => {
    const priority = f.auto_priority || 'Unknown';
    priorityCount[priority] = (priorityCount[priority] || 0) + 1;
  });

  return {
    period_days: days,
    total_feedback: totalFeedback,
    by_category: categoryCount,
    by_sentiment: sentimentCount,
    by_status: statusCount,
    by_priority: priorityCount,
  };
}

// ============= DEEP ANALYTICS TOOLS =============

async function getExpectedDeliveriesAnalysis(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const targetMonth = args.target_month; // e.g., "2026-03"
  const includeHealthRisks = args.include_health_risks !== false;

   // Get filtered animal IDs based on data category (two-stage pattern)
   const animalIds = await getFilteredAnimalIds(supabase, dataCategory);
  
   if (animalIds && animalIds.length === 0) {
    return {
      total_pregnant: 0,
      message: `No farms found with data category '${dataCategory}'`
    };
  }

  // Get all pregnant animals with expected delivery dates
  // Stage 1: Get ai_records with simple column filters (SSOT two-stage pattern)
  let aiRecords: any[] = [];
  let aiError: any = null;

  if (animalIds && animalIds.length > MAX_IDS_PER_BATCH) {
    // Use batched query for large ID arrays
    const result = await batchQuery(animalIds, async (batchIds) => {
      return await supabase
        .from('ai_records')
        .select('id, animal_id, expected_delivery_date, performed_date, pregnancy_confirmed')
        .eq('pregnancy_confirmed', true)
        .not('expected_delivery_date', 'is', null)
        .in('animal_id', batchIds);
    });
    aiRecords = result.data;
    aiError = result.error;
    // Sort after combining batches
    aiRecords.sort((a, b) => (a.expected_delivery_date || '').localeCompare(b.expected_delivery_date || ''));
  } else {
    // Standard query for smaller sets
    let aiQuery = supabase
      .from('ai_records')
      .select('id, animal_id, expected_delivery_date, performed_date, pregnancy_confirmed')
      .eq('pregnancy_confirmed', true)
      .not('expected_delivery_date', 'is', null)
      .order('expected_delivery_date', { ascending: true });
    
    if (animalIds) {
      aiQuery = aiQuery.in('animal_id', animalIds);
    }
    
    const result = await aiQuery;
    aiRecords = result.data || [];
    aiError = result.error;
  }

  // Log any errors
  if (aiError) {
    console.error('[getExpectedDeliveriesAnalysis] ai_records query error:', aiError.message);
    return {
      total_pregnant: 0,
      error: true,
      message: `Query error: ${aiError.message}`
    };
  }

  console.log(`[getExpectedDeliveriesAnalysis] Found ${aiRecords?.length || 0} pregnant animals with delivery dates`);

  if (!aiRecords || aiRecords.length === 0) {
    return {
      total_pregnant: 0,
      message: "No pregnant animals with expected delivery dates found"
    };
  }

  // Stage 2: Get animal details separately
  const animalIdsWithRecords = [...new Set(aiRecords.map(r => r.animal_id))];
  const { data: animalDetails, error: animalError } = await supabase
    .from('animals')
    .select('id, name, ear_tag, livestock_type, farm_id')
    .in('id', animalIdsWithRecords);

  if (animalError) {
    console.error('[getExpectedDeliveriesAnalysis] animals query error:', animalError.message);
  }

  // Stage 3: Get farm details
  const farmIdsForAnimals = [...new Set(animalDetails?.map(a => a.farm_id) || [])];
  const { data: farmDetails, error: farmError } = await supabase
    .from('farms')
    .select('id, name, region, municipality, data_category')
    .in('id', farmIdsForAnimals);

  if (farmError) {
    console.error('[getExpectedDeliveriesAnalysis] farms query error:', farmError.message);
  }

  // Create lookup maps
  const animalMap = new Map(animalDetails?.map(a => [a.id, a]) || []);
  const farmMap = new Map(farmDetails?.map(f => [f.id, f]) || []);

  // Enrich records with animal and farm data
  const enrichedRecords = aiRecords.map(record => {
    const animal = animalMap.get(record.animal_id);
    const farm = animal ? farmMap.get(animal.farm_id) : null;
    return {
      ...record,
      animals: animal ? {
        id: animal.id,
        name: animal.name,
        ear_tag: animal.ear_tag,
        livestock_type: animal.livestock_type,
        farm_id: animal.farm_id,
        farms: farm ? {
          name: farm.name,
          region: farm.region,
          municipality: farm.municipality,
          data_category: farm.data_category
        } : null
      } : null
    };
  });

  // Group by month
  const byMonth: Record<string, any[]> = {};
  enrichedRecords.forEach((r: any) => {
    const month = r.expected_delivery_date?.substring(0, 7);
    if (month) {
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(r);
    }
  });

  // Helper to check if month is within 30 days
  const isWithin30Days = (monthStr: string): boolean => {
    const now = new Date();
    const monthStart = new Date(monthStr + '-01');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return monthStart <= thirtyDaysFromNow;
  };

  // Helper to count by type
  const countByType = (animals: any[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    animals.forEach(a => {
      const type = a.animals?.livestock_type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  };

  // Helper to count by region
  const countByRegion = (animals: any[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    animals.forEach(a => {
      const region = a.animals?.farms?.region || 'Unknown';
      counts[region] = (counts[region] || 0) + 1;
    });
    return counts;
  };

  // If specific month requested, get detailed analysis with health/BCS data
  if (targetMonth && byMonth[targetMonth]) {
    const monthAnimals = byMonth[targetMonth];
    const animalIds = monthAnimals.map((r: any) => r.animals?.id).filter(Boolean);

    let healthRiskSummary: any = null;
    let bcsRiskSummary: any = null;
    let animalsAtRisk: any[] = [];

    if (includeHealthRisks && animalIds.length > 0) {
      // Get recent health records for these animals (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: healthRecords } = await supabase
        .from('health_records')
        .select('animal_id, diagnosis, visit_date')
        .in('animal_id', animalIds)
        .gte('visit_date', thirtyDaysAgo);

      // Get latest BCS records for these animals
      const { data: bcsRecords } = await supabase
        .from('body_condition_scores')
        .select('animal_id, score, assessment_date')
        .in('animal_id', animalIds)
        .order('assessment_date', { ascending: false });

      // Calculate health risk metrics
      const animalsWithHealthIssues = new Set(healthRecords?.map(r => r.animal_id) || []);
      
      // Get top diagnoses
      const diagnosisCounts: Record<string, number> = {};
      healthRecords?.forEach(r => {
        const diagnosis = r.diagnosis || 'Unspecified';
        diagnosisCounts[diagnosis] = (diagnosisCounts[diagnosis] || 0) + 1;
      });
      const topDiagnoses = Object.entries(diagnosisCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([diagnosis, count]) => ({ diagnosis, count }));

      healthRiskSummary = {
        animals_with_recent_health_issues: animalsWithHealthIssues.size,
        percentage_with_issues: animalIds.length > 0 
          ? Math.round((animalsWithHealthIssues.size / animalIds.length) * 100) 
          : 0,
        common_diagnoses: topDiagnoses
      };

      // Calculate BCS risk metrics - get unique latest score per animal
      const latestBcsByAnimal: Record<string, number> = {};
      bcsRecords?.forEach((r: any) => {
        if (!latestBcsByAnimal[r.animal_id]) {
          latestBcsByAnimal[r.animal_id] = r.score;
        }
      });

      const lowBcsAnimalIds = Object.entries(latestBcsByAnimal)
        .filter(([_, score]) => score < 2.5)
        .map(([id]) => id);

      bcsRiskSummary = {
        animals_with_bcs_data: Object.keys(latestBcsByAnimal).length,
        animals_with_low_bcs: lowBcsAnimalIds.length,
        percentage_underweight: Object.keys(latestBcsByAnimal).length > 0
          ? Math.round((lowBcsAnimalIds.length / Object.keys(latestBcsByAnimal).length) * 100)
          : 0,
        risk_note: "Animals with BCS < 2.5 have higher risk of delivery complications and miscarriage"
      };

      // Identify high-risk animals (either health issues OR low BCS)
      const highRiskSet = new Set([...animalsWithHealthIssues, ...lowBcsAnimalIds]);
      animalsAtRisk = monthAnimals
        .filter((r: any) => highRiskSet.has(r.animals?.id))
        .map((r: any) => ({
          name: r.animals?.name || 'Unnamed',
          ear_tag: r.animals?.ear_tag,
          livestock_type: r.animals?.livestock_type,
          farm: r.animals?.farms?.name,
          region: r.animals?.farms?.region,
          expected_delivery: r.expected_delivery_date,
          has_health_issues: animalsWithHealthIssues.has(r.animals?.id),
          has_low_bcs: lowBcsAnimalIds.includes(r.animals?.id)
        }));
    }

    return {
      month: targetMonth,
      is_urgent: isWithin30Days(targetMonth),
      total_deliveries: monthAnimals.length,
      by_livestock_type: countByType(monthAnimals),
      by_region: countByRegion(monthAnimals),
      health_risk_summary: healthRiskSummary,
      bcs_risk_summary: bcsRiskSummary,
      animals_at_risk: animalsAtRisk,
      animals_list: monthAnimals.slice(0, 20).map((r: any) => ({
        name: r.animals?.name || 'Unnamed',
        ear_tag: r.animals?.ear_tag,
        livestock_type: r.animals?.livestock_type,
        farm: r.animals?.farms?.name,
        region: r.animals?.farms?.region,
        expected_delivery: r.expected_delivery_date
      }))
    };
  }

  // Return monthly overview
  return {
    total_pregnant: enrichedRecords.length,
    by_month: Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, animals]) => ({
        month,
        month_name: new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        count: animals.length,
        is_urgent: isWithin30Days(month),
        by_type: countByType(animals),
        by_region: countByRegion(animals)
      }))
  };
}

async function getDeliveryRiskAssessment(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const daysAhead = args.days_ahead || 60;
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

   // Get filtered animal IDs based on data category (two-stage pattern)
    const filteredAnimalIds = await getFilteredAnimalIds(supabase, dataCategory);
   
    if (filteredAnimalIds && filteredAnimalIds.length === 0) {
     return {
       period_days: daysAhead,
       total_deliveries_expected: 0,
       message: `No animals found for data category '${dataCategory}'`
     };
   }

  // Get pregnant animals due in the period
  // Stage 1: Get ai_records with simple column filters (SSOT two-stage pattern)
  let pregnantRecords: any[] = [];
  let aiError: any = null;

  if (filteredAnimalIds && filteredAnimalIds.length > MAX_IDS_PER_BATCH) {
    // Use batched query for large ID arrays
    const result = await batchQuery(filteredAnimalIds, async (batchIds) => {
      return await supabase
        .from('ai_records')
        .select('id, animal_id, expected_delivery_date, pregnancy_confirmed')
        .eq('pregnancy_confirmed', true)
        .gte('expected_delivery_date', startDate)
        .lte('expected_delivery_date', endDate)
        .in('animal_id', batchIds);
    });
    pregnantRecords = result.data;
    aiError = result.error;
    // Sort after combining batches
    pregnantRecords.sort((a, b) => (a.expected_delivery_date || '').localeCompare(b.expected_delivery_date || ''));
  } else {
    // Standard query for smaller sets
    let pregnantQuery = supabase
      .from('ai_records')
      .select('id, animal_id, expected_delivery_date, pregnancy_confirmed')
      .eq('pregnancy_confirmed', true)
      .gte('expected_delivery_date', startDate)
      .lte('expected_delivery_date', endDate)
      .order('expected_delivery_date', { ascending: true });
    
    if (filteredAnimalIds) {
      pregnantQuery = pregnantQuery.in('animal_id', filteredAnimalIds);
    }
    
    const result = await pregnantQuery;
    pregnantRecords = result.data || [];
    aiError = result.error;
  }

  // Log any errors
  if (aiError) {
    console.error('[getDeliveryRiskAssessment] ai_records query error:', aiError.message);
    return {
      period_days: daysAhead,
      total_deliveries_expected: 0,
      error: true,
      message: `Query error: ${aiError.message}`
    };
  }

  console.log(`[getDeliveryRiskAssessment] Found ${pregnantRecords?.length || 0} deliveries expected`);

  if (!pregnantRecords || pregnantRecords.length === 0) {
    return {
      period_days: daysAhead,
      total_deliveries_expected: 0,
      message: `No deliveries expected in the next ${daysAhead} days`
    };
  }

  // Stage 2: Get animal details separately
  const pregnantAnimalIds = [...new Set(pregnantRecords.map(r => r.animal_id))];
  const { data: animalDetails, error: animalError } = await supabase
    .from('animals')
    .select('id, name, ear_tag, livestock_type, farm_id')
    .in('id', pregnantAnimalIds);

  if (animalError) {
    console.error('[getDeliveryRiskAssessment] animals query error:', animalError.message);
  }

  // Stage 3: Get farm details
  const farmIdsForAnimals = [...new Set(animalDetails?.map(a => a.farm_id) || [])];
  const { data: farmDetails, error: farmError } = await supabase
    .from('farms')
    .select('id, name, region, municipality, data_category')
    .in('id', farmIdsForAnimals);

  if (farmError) {
    console.error('[getDeliveryRiskAssessment] farms query error:', farmError.message);
  }

  // Create lookup maps
  const animalMap = new Map(animalDetails?.map(a => [a.id, a]) || []);
  const farmMap = new Map(farmDetails?.map(f => [f.id, f]) || []);

  // Enrich records with animal and farm data
  const pregnantAnimals = pregnantRecords.map(record => {
    const animal = animalMap.get(record.animal_id);
    const farm = animal ? farmMap.get(animal.farm_id) : null;
    return {
      ...record,
      animals: animal ? {
        id: animal.id,
        name: animal.name,
        ear_tag: animal.ear_tag,
        livestock_type: animal.livestock_type,
        farm_id: animal.farm_id,
        farms: farm ? {
          name: farm.name,
          region: farm.region,
          municipality: farm.municipality,
          data_category: farm.data_category
        } : null
      } : null
    };
  });

  // Get health records for these animals (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: healthRecords } = await supabase
    .from('health_records')
    .select('animal_id, diagnosis, visit_date')
     .in('animal_id', pregnantAnimalIds)
    .gte('visit_date', thirtyDaysAgo);

  // Get BCS records
  const { data: bcsRecords } = await supabase
    .from('body_condition_scores')
    .select('animal_id, score, assessment_date')
     .in('animal_id', pregnantAnimalIds)
    .order('assessment_date', { ascending: false });

  // Calculate risk factors
  const animalsWithHealthIssues = new Set(healthRecords?.map(r => r.animal_id) || []);

  // Get latest BCS per animal
  const latestBcsByAnimal: Record<string, number> = {};
  bcsRecords?.forEach((r: any) => {
    if (!latestBcsByAnimal[r.animal_id]) {
      latestBcsByAnimal[r.animal_id] = r.score;
    }
  });

  const lowBcsAnimals = Object.entries(latestBcsByAnimal)
    .filter(([_, score]) => score < 2.5);

  // Get BCS assessment dates for data freshness calculation
  const latestBcsDateByAnimal: Record<string, string> = {};
  bcsRecords?.forEach((r: any) => {
    if (!latestBcsDateByAnimal[r.animal_id]) {
      latestBcsDateByAnimal[r.animal_id] = r.assessment_date;
    }
  });

  // Get animal parity data
  const { data: animalParityData } = await supabase
    .from('animals')
    .select('id, parity')
    .in('id', pregnantAnimalIds);

  const parityByAnimal: Record<string, number | null> = {};
  animalParityData?.forEach((a: any) => {
    parityByAnimal[a.id] = a.parity;
  });

  // Get health issue counts (last 90 days for PCRS)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: healthRecords90 } = await supabase
    .from('health_records')
    .select('animal_id')
    .in('animal_id', pregnantAnimalIds)
    .gte('visit_date', ninetyDaysAgo);

  const healthIssueCountByAnimal: Record<string, number> = {};
  healthRecords90?.forEach((r: any) => {
    healthIssueCountByAnimal[r.animal_id] = (healthIssueCountByAnimal[r.animal_id] || 0) + 1;
  });

  // Calculate PCRS for each pregnant animal
  const now = Date.now();
  const pcrsResults = pregnantAnimals.map((r: any) => {
    const animalId = r.animals?.id;
    const deliveryDate = new Date(r.expected_delivery_date);
    const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - now) / (24 * 60 * 60 * 1000));
    
    // Calculate days since last BCS
    let daysSinceLastBCS: number | null = null;
    if (latestBcsDateByAnimal[animalId]) {
      const bcsDate = new Date(latestBcsDateByAnimal[animalId]);
      daysSinceLastBCS = Math.ceil((now - bcsDate.getTime()) / (24 * 60 * 60 * 1000));
    }
    
    const pcrs = calculatePCRS({
      daysUntilDelivery,
      latestBCS: latestBcsByAnimal[animalId] ?? null,
      parity: parityByAnimal[animalId] ?? null,
      healthIssueCount: healthIssueCountByAnimal[animalId] || 0,
      daysSinceLastBCS,
    });
    
    return {
      animalId,
      name: r.animals?.name || 'Unnamed',
      ear_tag: r.animals?.ear_tag,
      livestock_type: r.animals?.livestock_type,
      farm: r.animals?.farms?.name,
      region: r.animals?.farms?.region,
      expected_delivery: r.expected_delivery_date,
      daysUntilDelivery,
      pcrs,
    };
  });

  // Sort by PCRS score (highest risk first)
  pcrsResults.sort((a, b) => b.pcrs.totalScore - a.pcrs.totalScore);

  // PCRS tier summary
  const pcrsSummary = {
    critical: pcrsResults.filter(r => r.pcrs.tier === 'critical').length,
    high: pcrsResults.filter(r => r.pcrs.tier === 'high').length,
    moderate: pcrsResults.filter(r => r.pcrs.tier === 'moderate').length,
    low: pcrsResults.filter(r => r.pcrs.tier === 'low').length,
  };

  // Check for regional outbreaks (multiple health events in same region)
  const regionHealthCounts: Record<string, number> = {};
  pregnantAnimals.forEach((r: any) => {
    if (animalsWithHealthIssues.has(r.animals?.id)) {
      const region = r.animals?.farms?.region || 'Unknown';
      regionHealthCounts[region] = (regionHealthCounts[region] || 0) + 1;
    }
  });

  const potentialOutbreakRegions = Object.entries(regionHealthCounts)
    .filter(([_, count]) => count >= 3)
    .map(([region, count]) => ({ region, affected_pregnant_animals: count }));

  // Group by urgency (within 30 days vs beyond)
  const within30Days = pregnantAnimals.filter((r: any) => {
    const dueDate = new Date(r.expected_delivery_date);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return dueDate <= thirtyDaysFromNow;
  });

  // Count by livestock type
  const countByType = (animals: any[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    animals.forEach(a => {
      const type = a.animals?.livestock_type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  };

  return {
    period_days: daysAhead,
    analysis_date: startDate,
    total_deliveries_expected: pregnantAnimals.length,
    urgent_deliveries: within30Days.length,
    by_livestock_type: countByType(pregnantAnimals),
    
    // NEW: Pre-Calving Risk Score (PCRS) analysis
    pcrs_analysis: {
      summary: pcrsSummary,
      critical_animals: pcrsResults
        .filter(r => r.pcrs.tier === 'critical')
        .slice(0, 10)
        .map(r => ({
          name: r.name,
          ear_tag: r.ear_tag,
          livestock_type: r.livestock_type,
          farm: r.farm,
          region: r.region,
          expected_delivery: r.expected_delivery,
          days_until_delivery: r.daysUntilDelivery,
          risk_score: r.pcrs.totalScore,
          risk_tier: r.pcrs.tierLabel,
          risk_factors: r.pcrs.factors,
          score_breakdown: r.pcrs.breakdown,
        })),
      high_risk_animals: pcrsResults
        .filter(r => r.pcrs.tier === 'high')
        .slice(0, 10)
        .map(r => ({
          name: r.name,
          ear_tag: r.ear_tag,
          livestock_type: r.livestock_type,
          farm: r.farm,
          region: r.region,
          expected_delivery: r.expected_delivery,
          days_until_delivery: r.daysUntilDelivery,
          risk_score: r.pcrs.totalScore,
          risk_tier: r.pcrs.tierLabel,
          risk_factors: r.pcrs.factors,
        })),
      scoring_explanation: "PCRS (0-100): Timeline (35pts), BCS Risk (25pts), Parity (15pts), Health History (15pts), Data Freshness (10pts). Critical>=75, High>=50, Moderate>=25, Low<25",
    },

    risk_factors: {
      animals_with_recent_health_issues: animalsWithHealthIssues.size,
       health_issue_percentage: pregnantAnimalIds.length > 0 ? Math.round((animalsWithHealthIssues.size / pregnantAnimalIds.length) * 100) : 0,
      
      animals_with_low_bcs: lowBcsAnimals.length,
      low_bcs_percentage: Object.keys(latestBcsByAnimal).length > 0
        ? Math.round((lowBcsAnimals.length / Object.keys(latestBcsByAnimal).length) * 100)
        : 0,
       bcs_data_coverage: `${Object.keys(latestBcsByAnimal).length}/${pregnantAnimalIds.length} animals have BCS data`,
      
      potential_outbreak_regions: potentialOutbreakRegions
    },
    
    high_risk_animals: pregnantAnimals
      .filter((r: any) => 
        animalsWithHealthIssues.has(r.animals?.id) || 
        (latestBcsByAnimal[r.animals?.id] && latestBcsByAnimal[r.animals?.id] < 2.5)
      )
      .map((r: any) => ({
        name: r.animals?.name || 'Unnamed',
        ear_tag: r.animals?.ear_tag,
        livestock_type: r.animals?.livestock_type,
        farm: r.animals?.farms?.name,
        region: r.animals?.farms?.region,
        expected_delivery: r.expected_delivery_date,
        risk_factors: [
          animalsWithHealthIssues.has(r.animals?.id) ? 'Recent health issue' : null,
          (latestBcsByAnimal[r.animals?.id] && latestBcsByAnimal[r.animals?.id] < 2.5) 
            ? `Low BCS (${latestBcsByAnimal[r.animals?.id]})` 
            : null
        ].filter(Boolean)
      })),
    
    recommendations: [
      pcrsSummary.critical > 0
        ? `🔴 ${pcrsSummary.critical} animal(s) at CRITICAL risk level require immediate veterinary review`
        : null,
      pcrsSummary.high > 0
        ? `🟠 ${pcrsSummary.high} animal(s) at HIGH risk level need priority monitoring`
        : null,
      lowBcsAnimals.length > 0 
        ? `Focus nutritional intervention on ${lowBcsAnimals.length} underweight animal(s)` 
        : null,
      potentialOutbreakRegions.length > 0 
        ? `Monitor health situation in ${potentialOutbreakRegions.map(r => r.region).join(', ')}` 
        : null,
      animalsWithHealthIssues.size > 0 
        ? `${animalsWithHealthIssues.size} pregnant animal(s) with recent health issues need monitoring` 
        : null
    ].filter(Boolean)
  };
}

async function getCohortHealthAnalysis(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const cohortFilter = args.cohort_filter; // 'due_month', 'region', 'livestock_type'
  const filterValue = args.filter_value;

   // Get filtered animal IDs based on data category (two-stage pattern)
   const categoryAnimalIds = await getFilteredAnimalIds(supabase, dataCategory);
   // Also get farm IDs for farm-based queries
   const categoryFarmIds = await getFilteredFarmIds(supabase, dataCategory);

  let animalIds: string[] = [];
  let cohortDescription = '';

  if (cohortFilter === 'due_month' && filterValue) {
    // Get animals due in specific month
    // Stage 1: Simple ai_records query (SSOT two-stage pattern)
    let aiRecords: any[] = [];
    let aiError: any = null;

    if (categoryAnimalIds && categoryAnimalIds.length > MAX_IDS_PER_BATCH) {
      // Use batched query for large ID arrays
      const result = await batchQuery(categoryAnimalIds, async (batchIds) => {
        return await supabase
          .from('ai_records')
          .select('id, animal_id')
          .eq('pregnancy_confirmed', true)
          .like('expected_delivery_date', `${filterValue}%`)
          .in('animal_id', batchIds);
      });
      aiRecords = result.data;
      aiError = result.error;
    } else {
      // Standard query for smaller sets
      let aiQuery = supabase
        .from('ai_records')
        .select('id, animal_id')
        .eq('pregnancy_confirmed', true)
        .like('expected_delivery_date', `${filterValue}%`);
      
      if (categoryAnimalIds) {
        aiQuery = aiQuery.in('animal_id', categoryAnimalIds);
      }
      
      const result = await aiQuery;
      aiRecords = result.data || [];
      aiError = result.error;
    }

    if (aiError) {
      console.error('[getCohortHealthAnalysis] ai_records query error:', aiError.message);
      return {
        cohort: `Animals due in ${filterValue}`,
        cohort_size: 0,
        error: true,
        message: `Query error: ${aiError.message}`
      };
    }

    console.log(`[getCohortHealthAnalysis] Found ${aiRecords?.length || 0} AI records for month ${filterValue}`);
    animalIds = aiRecords?.map((r: any) => r.animal_id).filter(Boolean) || [];
    const monthName = new Date(filterValue + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    cohortDescription = `Pregnant animals due in ${monthName}`;

  } else if (cohortFilter === 'region' && filterValue) {
    // Get animals in specific region
    let animalsQuery = supabase
      .from('animals')
      .select('id, farms!inner(region)')
      .eq('farms.region', filterValue)
      .eq('is_deleted', false);
    
    if (categoryFarmIds) {
      animalsQuery = animalsQuery.in('farm_id', categoryFarmIds);
    }
    
    const { data: animals } = await animalsQuery;

    animalIds = animals?.map((a: any) => a.id) || [];
    cohortDescription = `Animals in ${filterValue}`;

  } else if (cohortFilter === 'livestock_type' && filterValue) {
    // Get animals of specific type
    let animalsQuery = supabase
      .from('animals')
      .select('id')
      .eq('livestock_type', filterValue)
      .eq('is_deleted', false);
    
    if (categoryFarmIds) {
      animalsQuery = animalsQuery.in('farm_id', categoryFarmIds);
    }
    
    const { data: animals } = await animalsQuery;

    animalIds = animals?.map((a: any) => a.id) || [];
    cohortDescription = `All ${filterValue}`;

  } else {
    return { error: "Please provide cohort_filter ('due_month', 'region', 'livestock_type') and filter_value" };
  }

  if (animalIds.length === 0) {
    return {
      cohort: cohortDescription,
      cohort_size: 0,
      message: "No animals found matching the criteria"
    };
  }

  // Get health records for last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: healthRecords } = await supabase
    .from('health_records')
    .select('animal_id, diagnosis, visit_date')
    .in('animal_id', animalIds)
    .gte('visit_date', ninetyDaysAgo);

  // Health events breakdown
  const last30Days = healthRecords?.filter(r => r.visit_date >= thirtyDaysAgo) || [];
  const last90Days = healthRecords || [];

  // Top diagnoses
  const diagnosisCounts: Record<string, number> = {};
  healthRecords?.forEach(r => {
    const diagnosis = r.diagnosis || 'Unspecified';
    diagnosisCounts[diagnosis] = (diagnosisCounts[diagnosis] || 0) + 1;
  });
  const topDiagnoses = Object.entries(diagnosisCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([diagnosis, count]) => ({ diagnosis, count }));

  // Get BCS records
  const { data: bcsRecords } = await supabase
    .from('body_condition_scores')
    .select('animal_id, score, assessment_date')
    .in('animal_id', animalIds)
    .order('assessment_date', { ascending: false });

  // Latest BCS per animal
  const latestBcsByAnimal: Record<string, number> = {};
  bcsRecords?.forEach((r: any) => {
    if (!latestBcsByAnimal[r.animal_id]) {
      latestBcsByAnimal[r.animal_id] = r.score;
    }
  });

  // BCS distribution
  const bcsDistribution = {
    underweight: 0, // < 2.5
    optimal: 0,     // 2.5 - 3.5
    overweight: 0   // > 3.5
  };
  Object.values(latestBcsByAnimal).forEach(score => {
    if (score < 2.5) bcsDistribution.underweight++;
    else if (score <= 3.5) bcsDistribution.optimal++;
    else bcsDistribution.overweight++;
  });

  // Get mortality data
  const { data: exitedAnimals } = await supabase
    .from('animals')
    .select('exit_reason, exit_date')
    .in('id', animalIds)
    .not('exit_date', 'is', null)
    .gte('exit_date', ninetyDaysAgo);

  const exitReasons: Record<string, number> = {};
  let mortalityCount = 0;
  exitedAnimals?.forEach(a => {
    const reason = a.exit_reason || 'Unknown';
    exitReasons[reason] = (exitReasons[reason] || 0) + 1;
    if (reason.toLowerCase().includes('death') || reason.toLowerCase().includes('died') || reason.toLowerCase().includes('mortality')) {
      mortalityCount++;
    }
  });

  return {
    cohort: cohortDescription,
    cohort_filter: cohortFilter,
    filter_value: filterValue,
    cohort_size: animalIds.length,
    
    health_summary: {
      health_events_last_30_days: last30Days.length,
      health_events_last_90_days: last90Days.length,
      unique_animals_with_issues_30d: new Set(last30Days.map(r => r.animal_id)).size,
      unique_animals_with_issues_90d: new Set(last90Days.map(r => r.animal_id)).size,
      morbidity_rate_30d: Math.round((new Set(last30Days.map(r => r.animal_id)).size / animalIds.length) * 100),
      top_diagnoses: topDiagnoses
    },
    
    bcs_summary: {
      animals_with_bcs_data: Object.keys(latestBcsByAnimal).length,
      coverage_percentage: Math.round((Object.keys(latestBcsByAnimal).length / animalIds.length) * 100),
      distribution: bcsDistribution,
      underweight_percentage: Object.keys(latestBcsByAnimal).length > 0
        ? Math.round((bcsDistribution.underweight / Object.keys(latestBcsByAnimal).length) * 100)
        : 0
    },
    
    mortality_summary: {
      exits_last_90_days: exitedAnimals?.length || 0,
      mortality_count: mortalityCount,
      mortality_rate: Math.round((mortalityCount / animalIds.length) * 100),
      exit_reasons: exitReasons
    },
    
    risk_assessment: {
      overall_risk_level: 
        (mortalityCount / animalIds.length >= 0.2) ? 'Critical' :
        (mortalityCount / animalIds.length >= 0.1) ? 'High' :
        (mortalityCount / animalIds.length >= 0.05) ? 'Moderate' : 'Low',
      concerns: [
        bcsDistribution.underweight > 0 ? `${bcsDistribution.underweight} underweight animal(s) need nutritional attention` : null,
        mortalityCount > 0 ? `${mortalityCount} mortality case(s) in last 90 days` : null,
        new Set(last30Days.map(r => r.animal_id)).size > animalIds.length * 0.1 
          ? `High morbidity: ${new Set(last30Days.map(r => r.animal_id)).size} animals with health issues in last 30 days` 
          : null
      ].filter(Boolean)
    }
  };
}

async function getAnimalProfile(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  let query = supabase
    .from('animals')
    .select('*')
    .eq('farm_id', farmId)
    .eq('is_deleted', false);

  if (args.ear_tag) {
    query = query.eq('ear_tag', args.ear_tag);
  } else if (args.name) {
    query = query.ilike('name', `%${args.name}%`);
  } else {
    return { error: "Please provide either ear_tag or name" };
  }

  const { data: animals, error } = await query;
  if (error || !animals || animals.length === 0) {
    return { error: "Animal not found" };
  }

  const animal = animals[0];

  // Fetch health records
  const { data: healthRecords } = await supabase
    .from('health_records')
    .select('*')
    .eq('animal_id', animal.id)
    .order('visit_date', { ascending: false })
    .limit(5);

  // Fetch milking records
  const { data: milkingRecords } = await supabase
    .from('milking_records')
    .select('*')
    .eq('animal_id', animal.id)
    .order('record_date', { ascending: false })
    .limit(10);

  return {
    animal: {
      name: animal.name,
      ear_tag: animal.ear_tag,
      breed: animal.breed,
      gender: animal.gender,
      birth_date: animal.birth_date,
      life_stage: animal.life_stage,
      milking_stage: animal.milking_stage,
    },
    health_records: healthRecords || [],
    milking_records: milkingRecords || [],
  };
}

async function searchAnimals(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  let query = supabase
    .from('animals')
    .select('name, ear_tag, breed, gender, livestock_type, life_stage, milking_stage')
    .eq('farm_id', farmId)
    .eq('is_deleted', false);

  if (args.livestock_type) query = query.eq('livestock_type', args.livestock_type);
  if (args.breed) query = query.ilike('breed', `%${args.breed}%`);
  if (args.life_stage) query = query.eq('life_stage', args.life_stage);
  if (args.milking_stage) query = query.eq('milking_stage', args.milking_stage);
  if (args.gender) query = query.eq('gender', args.gender);

  const { data: animals, error } = await query.limit(20);
  
  if (error) return { error: error.message };
  return { animals: animals || [], count: animals?.length || 0 };
}

async function addHealthRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  // Find animal
  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];

  // Get user ID
  const { data: { user } } = await supabase.auth.getUser();

  // Get current date in PH timezone (UTC+8)
  const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];

  // Create health record
  const { data, error } = await supabase
    .from('health_records')
    .insert({
      animal_id: animal.id,
      visit_date: phDate,
      diagnosis: args.diagnosis || null,
      treatment: args.treatment || null,
      notes: args.notes || null,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  
  return {
    success: true,
    message: `Health record created for ${animal.name || animal.ear_tag}`,
    record: data,
  };
}

async function updateHealthRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  // Find animal
  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];

  // Find the most recent health record (or by date if specified)
  let query = supabase
    .from('health_records')
    .select('*')
    .eq('animal_id', animal.id)
    .order('visit_date', { ascending: false });

  if (args.record_date) {
    query = query.eq('visit_date', args.record_date);
  }

  const { data: records, error: fetchError } = await query.limit(1);
  
  if (fetchError || !records || records.length === 0) {
    return { error: `No health record found for ${animal.name || animal.ear_tag}` };
  }

  const record = records[0];
  
  // Build update object
  const updateData: any = {};
  if (args.new_diagnosis) updateData.diagnosis = args.new_diagnosis;
  if (args.new_treatment) updateData.treatment = args.new_treatment;
  if (args.additional_notes) updateData.notes = record.notes 
    ? `${record.notes}\n\nUpdate: ${args.additional_notes}` 
    : args.additional_notes;

  if (Object.keys(updateData).length === 0) {
    return { error: "No updates provided" };
  }

  // Update the record
  const { data, error } = await supabase
    .from('health_records')
    .update(updateData)
    .eq('id', record.id)
    .select()
    .single();

  if (error) return { error: error.message };
  
  return {
    success: true,
    message: `Health record updated for ${animal.name || animal.ear_tag}`,
    previous: {
      diagnosis: record.diagnosis,
      treatment: record.treatment,
      notes: record.notes
    },
    updated: {
      diagnosis: data.diagnosis,
      treatment: data.treatment,
      notes: data.notes
    },
    record_date: record.visit_date
  };
}

async function addHealthResolution(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  // Find animal
  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];

  // Find health record to resolve
  let query = supabase
    .from('health_records')
    .select('*')
    .eq('animal_id', animal.id)
    .is('resolution_notes', null) // Only unresolved records
    .order('visit_date', { ascending: false });

  if (args.diagnosis) {
    query = query.ilike('diagnosis', `%${args.diagnosis}%`);
  }

  const { data: records, error: fetchError } = await query.limit(1);
  
  if (fetchError || !records || records.length === 0) {
    return { error: `No unresolved health record found for ${animal.name || animal.ear_tag}` };
  }

  const record = records[0];

  // Add resolution notes
  const { data, error } = await supabase
    .from('health_records')
    .update({ resolution_notes: args.resolution_notes })
    .eq('id', record.id)
    .select()
    .single();

  if (error) return { error: error.message };
  
  return {
    success: true,
    message: `Resolved health issue for ${animal.name || animal.ear_tag}`,
    original_diagnosis: record.diagnosis,
    resolution: args.resolution_notes,
    visit_date: record.visit_date
  };
}

async function addSmartMilkingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  // If animal explicitly specified, use regular flow
  if (args.animal_identifier) {
    return await addMilkingRecord(args, supabase, farmId);
  }

  // Smart auto-selection logic
  let query = supabase
    .from('animals')
    .select('id, name, ear_tag, livestock_type, milking_stage, life_stage')
    .eq('farm_id', farmId)
    .eq('is_deleted', false);

  // Filter by livestock type if specified
  if (args.livestock_type) {
    query = query.eq('livestock_type', args.livestock_type);
  }

  const { data: allAnimals, error: animalError } = await query;
  if (animalError) return { error: animalError.message };

  // Filter to lactating animals only
  const lactatingAnimals = allAnimals?.filter(a => 
    (a.milking_stage && a.milking_stage !== 'Dry Period') ||
    (a.life_stage && a.life_stage.includes('Lactating'))
  ) || [];

  // Scenario 1: No lactating animals
  if (lactatingAnimals.length === 0) {
    const typeMsg = args.livestock_type ? ` na ${args.livestock_type}` : '';
    return { 
      error: `Walang nag-gagatas na hayop${typeMsg} sa farm mo ngayon. Check if animals are in lactation stage.`,
      requires_clarification: true 
    };
  }

  // Scenario 2: Only 1 lactating animal - AUTO-SELECT!
  if (lactatingAnimals.length === 1) {
    const animal = lactatingAnimals[0];
    const { data: { user } } = await supabase.auth.getUser();
    const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('milking_records')
      .insert({
        animal_id: animal.id,
        record_date: phDate,
        liters: args.liters,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    return {
      success: true,
      auto_selected: true,
      message: `Naitala ko na ang ${args.liters}L para kay ${animal.name || animal.ear_tag}! (Auto-selected kasi siya lang ang nag-gagatas)`,
      animal: { name: animal.name, ear_tag: animal.ear_tag, livestock_type: animal.livestock_type },
      record: data,
    };
  }

  // Scenario 3: Multiple lactating animals - NEED CLARIFICATION
  const animalList = lactatingAnimals
    .map(a => `${a.name || 'No name'} (${a.ear_tag})`)
    .join(', ');

  return {
    requires_clarification: true,
    eligible_animals: lactatingAnimals.map(a => ({
      name: a.name,
      ear_tag: a.ear_tag,
      livestock_type: a.livestock_type
    })),
    message: `May ${lactatingAnimals.length} nag-gagatas na ${args.livestock_type || 'hayop'}: ${animalList}. Para kay sino ang ${args.liters}L?`,
  };
}

async function addMilkingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  // Find animal
  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];

  // Get user ID
  const { data: { user } } = await supabase.auth.getUser();

  // Get current date in PH timezone (UTC+8)
  const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];

  // Create milking record
  const { data, error } = await supabase
    .from('milking_records')
    .insert({
      animal_id: animal.id,
      record_date: phDate,
      liters: args.liters,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  
  return {
    success: true,
    message: `Milking record created: ${args.liters}L for ${animal.name || animal.ear_tag}`,
    record: data,
  };
}

async function getAnimalCompleteProfile(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  let query = supabase
    .from('animals')
    .select('*')
    .eq('farm_id', farmId)
    .eq('is_deleted', false);

  if (args.ear_tag) {
    query = query.eq('ear_tag', args.ear_tag);
  } else if (args.name) {
    query = query.ilike('name', `%${args.name}%`);
  } else {
    return { error: "Please provide either ear_tag or name" };
  }

  const { data: animals, error } = await query;
  if (error || !animals || animals.length === 0) {
    return { error: "Animal not found" };
  }

  const animal = animals[0];

  // Fetch all record types
  const [healthRecords, milkingRecords, aiRecords, animalEvents, feedingRecords, injectionRecords] = await Promise.all([
    supabase.from('health_records').select('*').eq('animal_id', animal.id).order('visit_date', { ascending: false }).limit(10),
    supabase.from('milking_records').select('*').eq('animal_id', animal.id).order('record_date', { ascending: false }).limit(10),
    supabase.from('ai_records').select('*').eq('animal_id', animal.id).order('scheduled_date', { ascending: false }).limit(10),
    supabase.from('animal_events').select('*').eq('animal_id', animal.id).order('event_date', { ascending: false }).limit(10),
    supabase.from('feeding_records').select('*').eq('animal_id', animal.id).order('record_datetime', { ascending: false }).limit(10),
    supabase.from('injection_records').select('*').eq('animal_id', animal.id).order('record_datetime', { ascending: false }).limit(10),
  ]);

  // Get parent info if exists
  let mother = null, father = null;
  if (animal.mother_id) {
    const { data } = await supabase.from('animals').select('name, ear_tag').eq('id', animal.mother_id).single();
    mother = data;
  }
  if (animal.father_id) {
    const { data } = await supabase.from('animals').select('name, ear_tag').eq('id', animal.father_id).single();
    father = data;
  }

  return {
    animal: {
      name: animal.name,
      ear_tag: animal.ear_tag,
      breed: animal.breed,
      gender: animal.gender,
      birth_date: animal.birth_date,
      life_stage: animal.life_stage,
      milking_stage: animal.milking_stage,
      mother: mother,
      father: father,
    },
    health_records: healthRecords.data || [],
    milking_records: milkingRecords.data || [],
    ai_records: aiRecords.data || [],
    animal_events: animalEvents.data || [],
    feeding_records: feedingRecords.data || [],
    injection_records: injectionRecords.data || [],
  };
}

async function addAIRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];
  const { data: { user } } = await supabase.auth.getUser();
  const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('ai_records')
    .insert({
      animal_id: animal.id,
      scheduled_date: phDate,
      technician: args.technician || null,
      semen_code: args.semen_code || null,
      notes: args.notes || null,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  
  return {
    success: true,
    message: `AI record created for ${animal.name || animal.ear_tag}`,
    record: data,
  };
}

async function addAnimalEvent(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];
  const { data: { user } } = await supabase.auth.getUser();
  const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('animal_events')
    .insert({
      animal_id: animal.id,
      event_type: args.event_type,
      event_date: phDate,
      notes: args.notes || null,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  
  return {
    success: true,
    message: `${args.event_type} event recorded for ${animal.name || animal.ear_tag}`,
    record: data,
  };
}

async function addFeedingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];
  const { data: { user } } = await supabase.auth.getUser();
  const phDateTime = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString();

  const { data, error } = await supabase
    .from('feeding_records')
    .insert({
      animal_id: animal.id,
      record_datetime: phDateTime,
      feed_type: args.feed_type || null,
      kilograms: args.kilograms || null,
      notes: args.notes || null,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  
  return {
    success: true,
    message: `Feeding record created for ${animal.name || animal.ear_tag}`,
    record: data,
  };
}

async function addInjectionRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];
  const { data: { user } } = await supabase.auth.getUser();
  const phDateTime = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString();

  const { data, error } = await supabase
    .from('injection_records')
    .insert({
      animal_id: animal.id,
      record_datetime: phDateTime,
      medicine_name: args.medicine_name || null,
      dosage: args.dosage || null,
      instructions: args.instructions || null,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  
  return {
    success: true,
    message: `Injection record created for ${animal.name || animal.ear_tag}`,
    record: data,
  };
}

// ============= NEW SSOT-ALIGNED UPDATE TOOLS =============

async function addWeightRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];
  const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('weight_records')
    .insert({
      animal_id: animal.id,
      measurement_date: phDate,
      weight_kg: args.weight_kg,
      measurement_method: args.measurement_method || null,
      notes: args.notes || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Also update current_weight_kg on animal
  await supabase
    .from('animals')
    .update({ current_weight_kg: args.weight_kg })
    .eq('id', animal.id);

  return {
    success: true,
    message: `Weight recorded: ${args.weight_kg}kg for ${animal.name || animal.ear_tag}`,
    record: data,
  };
}

async function updateWeightRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];

  // Find the most recent weight record (or by date if specified)
  let query = supabase
    .from('weight_records')
    .select('*')
    .eq('animal_id', animal.id)
    .order('measurement_date', { ascending: false });

  if (args.record_date) {
    query = query.eq('measurement_date', args.record_date);
  }

  const { data: records, error: fetchError } = await query.limit(1);
  
  if (fetchError || !records || records.length === 0) {
    return { error: `No weight record found for ${animal.name || animal.ear_tag}` };
  }

  const record = records[0];
  
  // Build update object
  const updateData: any = {};
  if (args.new_weight_kg) updateData.weight_kg = args.new_weight_kg;
  if (args.notes) updateData.notes = record.notes 
    ? `${record.notes}\n\nCorrection: ${args.notes}` 
    : args.notes;

  if (Object.keys(updateData).length === 0) {
    return { error: "No updates provided" };
  }

  // Update the record
  const { data, error } = await supabase
    .from('weight_records')
    .update(updateData)
    .eq('id', record.id)
    .select()
    .single();

  if (error) return { error: error.message };

  // Update current_weight_kg if this was the most recent record
  if (args.new_weight_kg) {
    await supabase
      .from('animals')
      .update({ current_weight_kg: args.new_weight_kg })
      .eq('id', animal.id);
  }

  return {
    success: true,
    message: `Weight record updated for ${animal.name || animal.ear_tag}`,
    previous: { weight_kg: record.weight_kg, notes: record.notes },
    updated: { weight_kg: data.weight_kg, notes: data.notes },
    record_date: record.measurement_date
  };
}

async function updateMilkingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];

  // Find the milking record
  let query = supabase
    .from('milking_records')
    .select('*')
    .eq('animal_id', animal.id)
    .order('record_date', { ascending: false });

  if (args.record_date) {
    query = query.eq('record_date', args.record_date);
  }
  
  if (args.session) {
    query = query.eq('session', args.session);
  }

  const { data: records, error: fetchError } = await query.limit(1);
  
  if (fetchError || !records || records.length === 0) {
    return { error: `No milking record found for ${animal.name || animal.ear_tag}` };
  }

  const record = records[0];
  
  // Build update object
  const updateData: any = {};
  if (args.new_liters !== undefined) updateData.liters = args.new_liters;
  if (args.notes) updateData.notes = record.notes 
    ? `${record.notes}\n\nCorrection: ${args.notes}` 
    : args.notes;

  if (Object.keys(updateData).length === 0) {
    return { error: "No updates provided" };
  }

  // Update the record
  const { data, error } = await supabase
    .from('milking_records')
    .update(updateData)
    .eq('id', record.id)
    .select()
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Milking record updated for ${animal.name || animal.ear_tag}`,
    previous: { liters: record.liters, session: record.session },
    updated: { liters: data.liters, session: data.session },
    record_date: record.record_date
  };
}

async function updateAIRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];

  // Find the most recent AI record
  const { data: records, error: fetchError } = await supabase
    .from('ai_records')
    .select('*')
    .eq('animal_id', animal.id)
    .order('performed_date', { ascending: false })
    .limit(1);
  
  if (fetchError || !records || records.length === 0) {
    return { error: `No AI/breeding record found for ${animal.name || animal.ear_tag}` };
  }

  const record = records[0];
  
  // Build update object
  const updateData: any = {};
  if (args.pregnancy_confirmed !== undefined) {
    updateData.pregnancy_confirmed = args.pregnancy_confirmed;
    if (args.pregnancy_confirmed === true) {
      updateData.confirmed_at = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString();
    }
  }
  if (args.expected_delivery_date) updateData.expected_delivery_date = args.expected_delivery_date;
  if (args.notes) updateData.notes = record.notes 
    ? `${record.notes}\n\nUpdate: ${args.notes}` 
    : args.notes;

  if (Object.keys(updateData).length === 0) {
    return { error: "No updates provided" };
  }

  // Update the record
  const { data, error } = await supabase
    .from('ai_records')
    .update(updateData)
    .eq('id', record.id)
    .select()
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    message: args.pregnancy_confirmed === true 
      ? `Pregnancy CONFIRMED for ${animal.name || animal.ear_tag}! 🎉`
      : `AI record updated for ${animal.name || animal.ear_tag}`,
    previous: { 
      pregnancy_confirmed: record.pregnancy_confirmed, 
      expected_delivery_date: record.expected_delivery_date 
    },
    updated: { 
      pregnancy_confirmed: data.pregnancy_confirmed, 
      expected_delivery_date: data.expected_delivery_date 
    },
    ai_date: record.performed_date || record.scheduled_date
  };
}

async function updateFeedingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];

  // Find the feeding record
  let query = supabase
    .from('feeding_records')
    .select('*')
    .eq('animal_id', animal.id)
    .order('record_datetime', { ascending: false });

  if (args.record_date) {
    query = query.gte('record_datetime', args.record_date)
                 .lt('record_datetime', args.record_date + 'T23:59:59');
  }

  const { data: records, error: fetchError } = await query.limit(1);
  
  if (fetchError || !records || records.length === 0) {
    return { error: `No feeding record found for ${animal.name || animal.ear_tag}` };
  }

  const record = records[0];
  
  // Build update object
  const updateData: any = {};
  if (args.new_kilograms !== undefined) updateData.kilograms = args.new_kilograms;
  if (args.new_feed_type) updateData.feed_type = args.new_feed_type;
  if (args.notes) updateData.notes = record.notes 
    ? `${record.notes}\n\nCorrection: ${args.notes}` 
    : args.notes;

  if (Object.keys(updateData).length === 0) {
    return { error: "No updates provided" };
  }

  // Update the record
  const { data, error } = await supabase
    .from('feeding_records')
    .update(updateData)
    .eq('id', record.id)
    .select()
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Feeding record updated for ${animal.name || animal.ear_tag}`,
    previous: { kilograms: record.kilograms, feed_type: record.feed_type },
    updated: { kilograms: data.kilograms, feed_type: data.feed_type },
    record_datetime: record.record_datetime
  };
}

async function updateInjectionRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('id, name, ear_tag')
    .eq('farm_id', farmId)
    .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
    .eq('is_deleted', false)
    .limit(1);

  if (!animals || animals.length === 0) {
    return { error: `Animal "${args.animal_identifier}" not found` };
  }

  const animal = animals[0];

  // Find the injection record
  let query = supabase
    .from('injection_records')
    .select('*')
    .eq('animal_id', animal.id)
    .order('record_datetime', { ascending: false });

  if (args.record_date) {
    query = query.gte('record_datetime', args.record_date)
                 .lt('record_datetime', args.record_date + 'T23:59:59');
  }

  const { data: records, error: fetchError } = await query.limit(1);
  
  if (fetchError || !records || records.length === 0) {
    return { error: `No injection record found for ${animal.name || animal.ear_tag}` };
  }

  const record = records[0];
  
  // Build update object
  const updateData: any = {};
  if (args.new_medicine_name) updateData.medicine_name = args.new_medicine_name;
  if (args.new_dosage) updateData.dosage = args.new_dosage;
  if (args.notes) updateData.notes = record.notes 
    ? `${record.notes}\n\nCorrection: ${args.notes}` 
    : args.notes;

  if (Object.keys(updateData).length === 0) {
    return { error: "No updates provided" };
  }

  // Update the record
  const { data, error } = await supabase
    .from('injection_records')
    .update(updateData)
    .eq('id', record.id)
    .select()
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    message: `Injection record updated for ${animal.name || animal.ear_tag}`,
    previous: { medicine_name: record.medicine_name, dosage: record.dosage },
    updated: { medicine_name: data.medicine_name, dosage: data.dosage },
    record_datetime: record.record_datetime
  };
}

async function getFarmOverview(supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const { data: animals } = await supabase
    .from('animals')
    .select('livestock_type, life_stage, milking_stage')
    .eq('farm_id', farmId)
    .eq('is_deleted', false);

  const totalAnimals = animals?.length || 0;
  const stageBreakdown: Record<string, number> = {};
  const livestockBreakdown: Record<string, number> = {};
  const milkingStageBreakdown: Record<string, number> = {};
  const lactatingByType: Record<string, number> = {};
  
  animals?.forEach(a => {
    // Stage breakdown
    const stage = a.life_stage || 'Unknown';
    stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1;
    
    // Livestock type breakdown
    const type = a.livestock_type || 'Unknown';
    livestockBreakdown[type] = (livestockBreakdown[type] || 0) + 1;

    // Milking stage breakdown
    if (a.milking_stage) {
      milkingStageBreakdown[a.milking_stage] = (milkingStageBreakdown[a.milking_stage] || 0) + 1;
    }

    // Count lactating animals by type
    // Lactating = has milking_stage AND it's not "Dry Period"
    // OR life_stage contains "Lactating" (for goats: "Lactating Doe")
    const isLactating = 
      (a.milking_stage && a.milking_stage !== 'Dry Period') ||
      (a.life_stage && a.life_stage.includes('Lactating'));
    
    if (isLactating) {
      lactatingByType[type] = (lactatingByType[type] || 0) + 1;
    }
  });

  // Get milk production with livestock type
  const today = new Date().toISOString().split('T')[0];
  const { data: milkingData } = await supabase
    .from('milking_records')
    .select('liters, animals!inner(livestock_type)')
    .gte('record_date', today);

  const milkByType: Record<string, number> = {};
  milkingData?.forEach((record: any) => {
    const type = record.animals?.livestock_type || 'Unknown';
    milkByType[type] = (milkByType[type] || 0) + Number(record.liters);
  });

  const todayTotal = Object.values(milkByType).reduce((a, b) => a + b, 0);
  const totalLactating = Object.values(lactatingByType).reduce((a, b) => a + b, 0);

  return {
    total_animals: totalAnimals,
    livestock_breakdown: livestockBreakdown,
    stage_breakdown: stageBreakdown,
    milking_stage_breakdown: milkingStageBreakdown,
    lactating_by_type: lactatingByType,
    total_lactating: totalLactating,
    today_milk_by_type: milkByType,
    today_milk_liters: todayTotal,
  };
}

async function getFarmAnalytics(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const days = args.days || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get daily stats
  const { data: dailyStats } = await supabase
    .from('daily_farm_stats')
    .select('*')
    .eq('farm_id', farmId)
    .gte('stat_date', startDate)
    .order('stat_date', { ascending: false });

  // Get monthly stats
  const { data: monthlyStats } = await supabase
    .from('monthly_farm_stats')
    .select('*')
    .eq('farm_id', farmId)
    .order('month_date', { ascending: false })
    .limit(6);

  // Calculate averages
  const avgMilk = dailyStats?.length 
    ? dailyStats.reduce((sum, s) => sum + Number(s.total_milk_liters), 0) / dailyStats.length 
    : 0;

  return {
    daily_stats: dailyStats || [],
    monthly_stats: monthlyStats || [],
    average_daily_milk_liters: Math.round(avgMilk * 100) / 100,
    period_days: days,
  };
}

async function getPregnantAnimals(supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  // Get AI records with confirmed pregnancies - matching dashboard logic
  const { data: pregnantRecords, error } = await supabase
    .from('ai_records')
    .select(`
      animal_id,
      performed_date,
      pregnancy_confirmed,
      animals!inner(
        id,
        name,
        ear_tag,
        breed,
        life_stage,
        farm_id
      )
    `)
    .eq('animals.farm_id', farmId)
    .eq('pregnancy_confirmed', true)
    .eq('animals.is_deleted', false);

  if (error || !pregnantRecords) {
    return { pregnant_animals: [], count: 0 };
  }

  // Format the response
  const animals = pregnantRecords.map(record => {
    const animal = Array.isArray(record.animals) ? record.animals[0] : record.animals;
    return {
      name: animal.name,
      ear_tag: animal.ear_tag,
      breed: animal.breed,
      life_stage: animal.life_stage
    };
  });

  return {
    pregnant_animals: animals,
    count: animals.length
  };
}

async function getRecentEvents(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const limit = args.limit || 20;
  
  const { data: events } = await supabase
    .from('animal_events')
    .select(`
      *,
      animals!inner(name, ear_tag, farm_id)
    `)
    .eq('animals.farm_id', farmId)
    .eq('animals.is_deleted', false)
    .order('event_date', { ascending: false })
    .limit(limit);

  return {
    events: events?.map(e => ({
      event_type: e.event_type,
      event_date: e.event_date,
      animal_name: e.animals.name,
      animal_ear_tag: e.animals.ear_tag,
      notes: e.notes,
    })) || [],
    count: events?.length || 0,
  };
}

// ============= NEW: COMPREHENSIVE FARM DATA QUERY TOOLS =============

// Helper: Parse relative date keywords
function parseRelativeDate(dateStr: string | undefined): { startDate: string; endDate: string } {
  const today = new Date();
  const phOffset = 8 * 60 * 60 * 1000; // UTC+8
  const phToday = new Date(Date.now() + phOffset);
  const todayStr = phToday.toISOString().split('T')[0];
  
  if (!dateStr) {
    return { startDate: todayStr, endDate: todayStr };
  }
  
  const normalized = dateStr.toLowerCase().trim();
  
  // Yesterday / Kahapon
  if (normalized === 'yesterday' || normalized === 'kahapon') {
    const yesterday = new Date(phToday);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    return { startDate: yesterdayStr, endDate: yesterdayStr };
  }
  
  // Today / Ngayon
  if (normalized === 'today' || normalized === 'ngayon') {
    return { startDate: todayStr, endDate: todayStr };
  }
  
  // Last week / Noong nakaraang linggo
  if (normalized.includes('last week') || normalized.includes('nakaraang linggo') || normalized === 'last week') {
    const weekAgo = new Date(phToday);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { startDate: weekAgo.toISOString().split('T')[0], endDate: todayStr };
  }
  
  // This week
  if (normalized.includes('this week') || normalized === 'nitong linggo') {
    const startOfWeek = new Date(phToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return { startDate: startOfWeek.toISOString().split('T')[0], endDate: todayStr };
  }
  
  // This month / Nitong buwan
  if (normalized.includes('this month') || normalized.includes('nitong buwan')) {
    const startOfMonth = new Date(phToday.getFullYear(), phToday.getMonth(), 1);
    return { startDate: startOfMonth.toISOString().split('T')[0], endDate: todayStr };
  }
  
  // If it looks like a date (YYYY-MM-DD), use it directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { startDate: dateStr, endDate: dateStr };
  }
  
  // Default to today
  return { startDate: todayStr, endDate: todayStr };
}

async function getMilkProduction(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  // Parse date arguments
  let startDate: string, endDate: string;
  
  if (args.start_date && args.end_date) {
    startDate = args.start_date;
    endDate = args.end_date;
  } else {
    const parsed = parseRelativeDate(args.date);
    startDate = parsed.startDate;
    endDate = parsed.endDate;
  }

  // Build base query - filter by farm animals first
  let query = supabase
    .from('milking_records')
    .select(`
      liters,
      record_date,
      session,
      animals!inner(id, name, ear_tag, livestock_type, farm_id)
    `)
    .eq('animals.farm_id', farmId)
    .gte('record_date', startDate)
    .lte('record_date', endDate)
    .order('record_date', { ascending: false });

  // If specific animal requested
  if (args.animal_identifier) {
    const { data: animal } = await supabase
      .from('animals')
      .select('id, name, ear_tag')
      .eq('farm_id', farmId)
      .eq('is_deleted', false)
      .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
      .limit(1)
      .single();

    if (animal) {
      query = query.eq('animal_id', animal.id);
    } else {
      return { error: `Animal "${args.animal_identifier}" not found` };
    }
  }

  const { data: milkRecords, error } = await query;
  if (error) return { error: error.message };

  // Calculate totals
  const totalLiters = milkRecords?.reduce((sum, r) => sum + Number(r.liters), 0) || 0;
  
  // Breakdown by livestock type
  const byLivestockType: Record<string, number> = {};
  const bySession: Record<string, number> = {};
  const animalTotals: Record<string, { name: string; ear_tag: string; liters: number; type: string }> = {};

  milkRecords?.forEach((r: any) => {
    const type = r.animals?.livestock_type || 'Unknown';
    const animalId = r.animals?.id;
    const session = r.session || 'Not specified';
    
    // By type
    byLivestockType[type] = (byLivestockType[type] || 0) + Number(r.liters);
    
    // By session
    bySession[session] = (bySession[session] || 0) + Number(r.liters);
    
    // By animal (aggregate)
    if (animalId && !animalTotals[animalId]) {
      animalTotals[animalId] = {
        name: r.animals?.name || 'Unknown',
        ear_tag: r.animals?.ear_tag || 'N/A',
        liters: 0,
        type: type
      };
    }
    if (animalId) {
      animalTotals[animalId].liters += Number(r.liters);
    }
  });

  // Convert to sorted array (top producers first)
  const topAnimals = Object.values(animalTotals)
    .sort((a, b) => b.liters - a.liters)
    .slice(0, 10);

  // Get previous period for comparison
  const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevStartDate = new Date(prevEndDate);
  prevStartDate.setDate(prevStartDate.getDate() - daysDiff + 1);
  
  const { data: prevRecords } = await supabase
    .from('milking_records')
    .select('liters, animals!inner(farm_id)')
    .eq('animals.farm_id', farmId)
    .gte('record_date', prevStartDate.toISOString().split('T')[0])
    .lte('record_date', prevEndDate.toISOString().split('T')[0]);

  const prevTotal = prevRecords?.reduce((sum, r) => sum + Number(r.liters), 0) || 0;
  const comparison = prevTotal > 0 ? Math.round(((totalLiters - prevTotal) / prevTotal) * 100) : null;

  return {
    query_date: startDate === endDate ? startDate : null,
    date_range: startDate !== endDate ? { start: startDate, end: endDate } : null,
    total_liters: Math.round(totalLiters * 100) / 100,
    by_livestock_type: byLivestockType,
    by_session: bySession,
    top_animals: topAnimals,
    total_records: milkRecords?.length || 0,
    total_animals_milked: Object.keys(animalTotals).length,
    comparison_to_previous_period: comparison !== null ? `${comparison >= 0 ? '+' : ''}${comparison}%` : null
  };
}

async function getHealthHistory(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const days = args.days || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let query = supabase
    .from('health_records')
    .select(`
      id,
      visit_date,
      diagnosis,
      treatment,
      notes,
      resolution_notes,
      animals!inner(id, name, ear_tag, farm_id)
    `)
    .eq('animals.farm_id', farmId)
    .gte('visit_date', startDate)
    .order('visit_date', { ascending: false });

  // If specific animal requested
  if (args.animal_identifier) {
    const { data: animal } = await supabase
      .from('animals')
      .select('id')
      .eq('farm_id', farmId)
      .eq('is_deleted', false)
      .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
      .limit(1)
      .single();

    if (animal) {
      query = query.eq('animal_id', animal.id);
    }
  }

  // If diagnosis filter
  if (args.diagnosis) {
    query = query.ilike('diagnosis', `%${args.diagnosis}%`);
  }

  const { data: healthRecords, error } = await query.limit(50);
  if (error) return { error: error.message };

  // Breakdown by diagnosis
  const diagnosisCount: Record<string, number> = {};
  const animalsWithIssues: Record<string, number> = {};
  let unresolvedCount = 0;

  healthRecords?.forEach((r: any) => {
    const diagnosis = r.diagnosis || 'Unspecified';
    diagnosisCount[diagnosis] = (diagnosisCount[diagnosis] || 0) + 1;
    
    const animalName = r.animals?.name || r.animals?.ear_tag || 'Unknown';
    animalsWithIssues[animalName] = (animalsWithIssues[animalName] || 0) + 1;
    
    if (!r.resolution_notes) unresolvedCount++;
  });

  // Sort animals by issue count
  const topAnimalsWithIssues = Object.entries(animalsWithIssues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ animal: name, issue_count: count }));

  return {
    period_days: days,
    total_health_records: healthRecords?.length || 0,
    unresolved_issues: unresolvedCount,
    diagnosis_breakdown: diagnosisCount,
    animals_with_most_issues: topAnimalsWithIssues,
    recent_records: healthRecords?.slice(0, 10).map((r: any) => ({
      date: r.visit_date,
      animal: r.animals?.name || r.animals?.ear_tag,
      diagnosis: r.diagnosis,
      treatment: r.treatment,
      resolved: !!r.resolution_notes
    })) || []
  };
}

async function getBreedingStatus(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const days = args.days || 90;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get all AI records for the farm
  const { data: aiRecords, error } = await supabase
    .from('ai_records')
    .select(`
      id,
      scheduled_date,
      performed_date,
      pregnancy_confirmed,
      expected_delivery_date,
      semen_code,
      technician,
      animals!inner(id, name, ear_tag, farm_id, livestock_type)
    `)
    .eq('animals.farm_id', farmId)
    .eq('animals.is_deleted', false)
    .order('performed_date', { ascending: false });

  if (error) return { error: error.message };

  const statusFilter = args.status?.toLowerCase();

  // Categorize records
  const pregnant: any[] = [];
  const dueSoon: any[] = [];
  const recentAI: any[] = [];
  const pendingConfirmation: any[] = [];

  aiRecords?.forEach((r: any) => {
    const animal = r.animals;
    const record = {
      animal_name: animal?.name || 'Unknown',
      animal_ear_tag: animal?.ear_tag || 'N/A',
      livestock_type: animal?.livestock_type,
      performed_date: r.performed_date,
      expected_delivery_date: r.expected_delivery_date,
      semen_code: r.semen_code
    };

    if (r.pregnancy_confirmed) {
      pregnant.push(record);
      
      if (r.expected_delivery_date && r.expected_delivery_date <= thirtyDaysFromNow && r.expected_delivery_date >= today) {
        dueSoon.push(record);
      }
    }

    if (r.performed_date && r.performed_date >= startDate) {
      recentAI.push(record);
      
      if (r.pregnancy_confirmed === null) {
        pendingConfirmation.push(record);
      }
    }
  });

  // Calculate success rate
  const performedRecords = aiRecords?.filter(r => r.performed_date) || [];
  const confirmedCount = performedRecords.filter(r => r.pregnancy_confirmed === true).length;
  const successRate = performedRecords.length > 0 
    ? Math.round((confirmedCount / performedRecords.length) * 100) 
    : 0;

  // Filter based on status parameter
  let result: any = {
    period_days: days,
    total_ai_procedures: recentAI.length,
    success_rate: `${successRate}%`,
    currently_pregnant: pregnant.length,
    due_within_30_days: dueSoon.length,
    pending_confirmation: pendingConfirmation.length
  };

  if (!statusFilter || statusFilter === 'all') {
    result.pregnant_animals = pregnant.slice(0, 10);
    result.due_soon = dueSoon;
    result.recent_ai = recentAI.slice(0, 10);
  } else if (statusFilter === 'pregnant') {
    result.pregnant_animals = pregnant;
  } else if (statusFilter === 'due_soon') {
    result.due_soon = dueSoon;
  } else if (statusFilter === 'recent_ai') {
    result.recent_ai = recentAI;
  }

  return result;
}

async function getWeightHistory(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const days = args.days || 90;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let query = supabase
    .from('weight_records')
    .select(`
      id,
      weight_kg,
      measurement_date,
      notes,
      animals!inner(id, name, ear_tag, farm_id, livestock_type, current_weight_kg)
    `)
    .eq('animals.farm_id', farmId)
    .eq('animals.is_deleted', false)
    .gte('measurement_date', startDate)
    .order('measurement_date', { ascending: false });

  // If specific animal requested
  if (args.animal_identifier) {
    const { data: animal } = await supabase
      .from('animals')
      .select('id')
      .eq('farm_id', farmId)
      .eq('is_deleted', false)
      .or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`)
      .limit(1)
      .single();

    if (animal) {
      query = query.eq('animal_id', animal.id);
    }
  }

  const { data: weightRecords, error } = await query.limit(100);
  if (error) return { error: error.message };

  // Group by animal and calculate growth
  const animalWeights: Record<string, { 
    name: string; 
    ear_tag: string;
    type: string;
    current: number | null;
    oldest: number | null;
    newest: number | null;
    gain: number | null;
    records: number;
  }> = {};

  weightRecords?.forEach((r: any) => {
    const animalId = r.animals?.id;
    const name = r.animals?.name || 'Unknown';
    const ear_tag = r.animals?.ear_tag || 'N/A';
    const type = r.animals?.livestock_type || 'Unknown';

    if (!animalWeights[animalId]) {
      animalWeights[animalId] = {
        name,
        ear_tag,
        type,
        current: r.animals?.current_weight_kg,
        oldest: null,
        newest: null,
        gain: null,
        records: 0
      };
    }

    animalWeights[animalId].records++;
    
    if (!animalWeights[animalId].newest) {
      animalWeights[animalId].newest = r.weight_kg;
    }
    animalWeights[animalId].oldest = r.weight_kg;
  });

  // Calculate gain for each animal
  Object.values(animalWeights).forEach(a => {
    if (a.newest && a.oldest) {
      a.gain = Math.round((a.newest - a.oldest) * 10) / 10;
    }
  });

  // Sort by gain (top gainers)
  const animalList = Object.values(animalWeights).sort((a, b) => (b.gain || 0) - (a.gain || 0));

  return {
    period_days: days,
    total_measurements: weightRecords?.length || 0,
    animals_measured: Object.keys(animalWeights).length,
    animal_weights: animalList.slice(0, 15),
    top_gainers: animalList.filter(a => (a.gain || 0) > 0).slice(0, 5),
    needing_attention: animalList.filter(a => (a.gain || 0) < 0).slice(0, 5)
  };
}

async function getFeedingSummary(args: any, supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  const days = args.days || 7;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('feeding_records')
    .select(`
      id,
      record_datetime,
      feed_type,
      kilograms,
      cost_per_kg_at_time,
      animals!inner(id, name, ear_tag, farm_id)
    `)
    .eq('animals.farm_id', farmId)
    .eq('animals.is_deleted', false)
    .gte('record_datetime', startDate)
    .order('record_datetime', { ascending: false });

  if (args.feed_type) {
    query = query.ilike('feed_type', `%${args.feed_type}%`);
  }

  const { data: feedingRecords, error } = await query.limit(200);
  if (error) return { error: error.message };

  // Aggregate by feed type
  const byFeedType: Record<string, { kg: number; cost: number }> = {};
  const byAnimal: Record<string, number> = {};
  let totalKg = 0;
  let totalCost = 0;

  feedingRecords?.forEach((r: any) => {
    const type = r.feed_type || 'Unknown';
    const kg = Number(r.kilograms) || 0;
    const costPerKg = Number(r.cost_per_kg_at_time) || 0;
    const cost = kg * costPerKg;

    if (!byFeedType[type]) {
      byFeedType[type] = { kg: 0, cost: 0 };
    }
    byFeedType[type].kg += kg;
    byFeedType[type].cost += cost;

    const animalName = r.animals?.name || r.animals?.ear_tag || 'Unknown';
    byAnimal[animalName] = (byAnimal[animalName] || 0) + kg;

    totalKg += kg;
    totalCost += cost;
  });

  // Get current feed inventory
  const { data: inventory } = await supabase
    .from('feed_inventory')
    .select('feed_type, quantity_kg, category')
    .eq('farm_id', farmId);

  const inventorySummary = inventory?.map(i => ({
    type: i.feed_type,
    category: i.category,
    remaining_kg: i.quantity_kg
  })) || [];

  return {
    period_days: days,
    total_feed_consumed_kg: Math.round(totalKg * 10) / 10,
    total_cost: Math.round(totalCost * 100) / 100,
    by_feed_type: Object.entries(byFeedType).map(([type, data]) => ({
      feed_type: type,
      kg: Math.round(data.kg * 10) / 10,
      cost: Math.round(data.cost * 100) / 100
    })),
    top_consumers: Object.entries(byAnimal)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([animal, kg]) => ({ animal, kg: Math.round(kg * 10) / 10 })),
    current_inventory: inventorySummary,
    total_records: feedingRecords?.length || 0
  };
}

async function getConversationContext(args: any, supabase: SupabaseClient, userId?: string) {
  if (!userId) return { error: "User not authenticated" };

  const hours = args.hours || 24;
  const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Get recent queries for this user
  const { data: recentQueries, error } = await supabase
    .from('doc_aga_queries')
    .select('question, answer, created_at')
    .eq('user_id', userId)
    .gte('created_at', sinceTime)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return { error: error.message };

  if (!recentQueries || recentQueries.length === 0) {
    return {
      has_recent_context: false,
      message: "No recent conversations found"
    };
  }

  // Extract animal mentions from questions/answers
  const animalPattern = /(?:si\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)|(?:ear\s*tag[:\s]*)?([A-Z]-?\d{3})/gi;
  const mentionedAnimals = new Set<string>();
  
  recentQueries.forEach(q => {
    const text = `${q.question} ${q.answer || ''}`;
    const matches = text.matchAll(animalPattern);
    for (const match of matches) {
      if (match[1]) mentionedAnimals.add(match[1]);
      if (match[2]) mentionedAnimals.add(match[2]);
    }
  });

  // Extract topics
  const topics: string[] = [];
  const topicKeywords = {
    milk: ['gatas', 'milk', 'liters', 'litro'],
    health: ['health', 'sakit', 'sick', 'diagnosis', 'treatment'],
    breeding: ['pregnant', 'buntis', 'AI', 'breeding', 'calving'],
    feeding: ['feed', 'kain', 'feeding', 'pakain'],
    weight: ['weight', 'timbang', 'kg', 'kilos']
  };

  recentQueries.forEach(q => {
    const text = (q.question + ' ' + (q.answer || '')).toLowerCase();
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(kw => text.includes(kw)) && !topics.includes(topic)) {
        topics.push(topic);
      }
    });
  });

  // Filter by keywords if provided
  let filteredQueries = recentQueries;
  if (args.topic_keywords) {
    const keywords = args.topic_keywords.toLowerCase().split(/[,\s]+/);
    filteredQueries = recentQueries.filter(q => {
      const text = (q.question + ' ' + (q.answer || '')).toLowerCase();
      return keywords.some((kw: string) => text.includes(kw));
    });
  }

  return {
    has_recent_context: true,
    hours_covered: hours,
    total_recent_queries: recentQueries.length,
    animals_mentioned: Array.from(mentionedAnimals).slice(0, 10),
    topics_discussed: topics,
    recent_conversations: filteredQueries.slice(0, 5).map(q => ({
      question: q.question.slice(0, 200),
      answer_preview: q.answer?.slice(0, 200),
      time: q.created_at
    }))
  };
}

// ============= FARM CONTEXT TOOL =============

async function getFarmContext(supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found for user" };

  // Get farm details
  const { data: farm, error: farmError } = await supabase
    .from('farms')
    .select('name, created_at')
    .eq('id', farmId)
    .single();

  if (farmError || !farm) {
    return { error: "Farm not found" };
  }

  // Get farm's animal IDs for multi-tenant isolation
  const { data: farmAnimals } = await supabase
    .from('animals')
    .select('id')
    .eq('farm_id', farmId)
    .eq('is_deleted', false);
  
  const farmAnimalIds = farmAnimals?.map(a => a.id) || [];
  
  if (farmAnimalIds.length === 0) {
    return {
      farm_name: farm.name,
      farm_created: farm.created_at ? new Date(farm.created_at).toLocaleDateString('en-PH', { 
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : null,
      current_date: new Date().toLocaleDateString('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      current_time_pht: new Date().toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
      total_animals: 0,
      data_coverage: {
        milk_records: { earliest: null, latest: null, total_records: 0 },
        health_records: { earliest: null, latest: null, total_records: 0 },
        breeding_records: { earliest: null, latest: null, total_records: 0 }
      },
      message: `This farm was created on ${farm.created_at ? new Date(farm.created_at).toLocaleDateString() : 'unknown date'} but has no animals or records yet.`
    };
  }

  // Fetch data ranges in parallel
  const [milkResult, healthResult, aiResult] = await Promise.all([
    supabase
      .from('milking_records')
      .select('record_date')
      .in('animal_id', farmAnimalIds)
      .order('record_date', { ascending: true }),
    supabase
      .from('health_records')
      .select('visit_date')
      .in('animal_id', farmAnimalIds)
      .order('visit_date', { ascending: true }),
    supabase
      .from('ai_records')
      .select('performed_date')
      .in('animal_id', farmAnimalIds)
      .not('performed_date', 'is', null)
      .order('performed_date', { ascending: true })
  ]);

  const milkDates = milkResult.data?.map(r => r.record_date) || [];
  const healthDates = healthResult.data?.map(r => r.visit_date) || [];
  const aiDates = aiResult.data?.map(r => r.performed_date) || [];

  // Find overall earliest date
  const allDates = [...milkDates, ...healthDates, ...aiDates].filter(Boolean);
  const earliestOverall = allDates.length > 0 
    ? new Date(Math.min(...allDates.map(d => new Date(d!).getTime())))
    : null;
  const latestOverall = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => new Date(d!).getTime())))
    : null;

  const formatDate = (date: Date | null) => date 
    ? date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return {
    farm_name: farm.name,
    farm_created: formatDate(farm.created_at ? new Date(farm.created_at) : null),
    current_date: formatDate(new Date()),
    current_time_pht: new Date().toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }),
    total_animals: farmAnimalIds.length,
    data_coverage: {
      milk_records: {
        earliest: milkDates[0] || null,
        latest: milkDates[milkDates.length - 1] || null,
        total_records: milkDates.length
      },
      health_records: {
        earliest: healthDates[0] || null,
        latest: healthDates[healthDates.length - 1] || null,
        total_records: healthDates.length
      },
      breeding_records: {
        earliest: aiDates[0] || null,
        latest: aiDates[aiDates.length - 1] || null,
        total_records: aiDates.length
      }
    },
    earliest_record_overall: formatDate(earliestOverall),
    latest_record_overall: formatDate(latestOverall),
    message: `This farm "${farm.name}" was created on ${formatDate(farm.created_at ? new Date(farm.created_at) : null) || 'unknown date'}. It has ${farmAnimalIds.length} animals. Data records exist from ${formatDate(earliestOverall) || 'no records'} to ${formatDate(latestOverall) || 'no records'}. Milk records: ${milkDates.length}, Health records: ${healthDates.length}, AI/Breeding records: ${aiDates.length}.`
  };
}
