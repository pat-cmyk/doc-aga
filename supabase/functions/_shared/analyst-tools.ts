 import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 // Data category type for live/demo data segregation (SSOT with frontend)
 export type DataCategory = 'live' | 'demo' | 'all';
 
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
 export async function batchQuery<T>(
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
 export async function getFilteredFarmIds(
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
 export async function getFilteredAnimalIds(
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
 
 // ============= GOVERNMENT ANALYST TOOLS =============
 
 export async function getNationalOverview(supabase: SupabaseClient, dataCategory?: DataCategory) {
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
 
 export async function getRegionalStats(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
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
 
 export async function getBreedingAnalytics(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
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
 
   // Stage 3: Get currently pregnant animals count
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
 
 export async function getHealthAnalytics(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
   const days = args.days || 30;
   const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
 
   // Get filtered animal IDs based on data category (two-stage pattern)
   const animalIds = await getFilteredAnimalIds(supabase, dataCategory);
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
 
 export async function getProductionTrends(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
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
 
 export async function getFarmerFeedbackSummary(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
   const days = args.days || 30;
   const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
 
   const farmIds = await getFilteredFarmIds(supabase, dataCategory);
 
   let feedbackQuery = supabase
     .from('farmer_feedback')
     .select('primary_category, sentiment, status, auto_priority, created_at, farm_id')
     .gte('created_at', startDate);
   
   if (farmIds) {
     feedbackQuery = feedbackQuery.in('farm_id', farmIds);
   }
   
   const { data: feedback } = await feedbackQuery;
 
   const totalFeedback = feedback?.length || 0;
 
   const categoryCount: Record<string, number> = {};
   feedback?.forEach(f => {
     const category = f.primary_category || 'Unknown';
     categoryCount[category] = (categoryCount[category] || 0) + 1;
   });
 
   const sentimentCount: Record<string, number> = {};
   feedback?.forEach(f => {
     const sentiment = f.sentiment || 'Unknown';
     sentimentCount[sentiment] = (sentimentCount[sentiment] || 0) + 1;
   });
 
   const statusCount: Record<string, number> = {};
   feedback?.forEach(f => {
     const status = f.status || 'Unknown';
     statusCount[status] = (statusCount[status] || 0) + 1;
   });
 
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
 
 export async function getExpectedDeliveriesAnalysis(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
   const targetMonth = args.target_month;
   const includeHealthRisks = args.include_health_risks !== false;
 
   const animalIds = await getFilteredAnimalIds(supabase, dataCategory);
   
   if (animalIds && animalIds.length === 0) {
     return {
       total_pregnant: 0,
       message: `No farms found with data category '${dataCategory}'`
     };
   }
 
   // Get all pregnant animals with expected delivery dates
   let aiRecords: any[] = [];
   let aiError: any = null;
 
   if (animalIds && animalIds.length > MAX_IDS_PER_BATCH) {
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
     aiRecords.sort((a, b) => (a.expected_delivery_date || '').localeCompare(b.expected_delivery_date || ''));
   } else {
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
     const monthAnimalIds = monthAnimals.map((r: any) => r.animals?.id).filter(Boolean);
 
     let healthRiskSummary: any = null;
     let bcsRiskSummary: any = null;
     let animalsAtRisk: any[] = [];
 
     if (includeHealthRisks && monthAnimalIds.length > 0) {
       const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
       const { data: healthRecords } = await supabase
         .from('health_records')
         .select('animal_id, diagnosis, visit_date')
         .in('animal_id', monthAnimalIds)
         .gte('visit_date', thirtyDaysAgo);
 
       const { data: bcsRecords } = await supabase
         .from('body_condition_scores')
         .select('animal_id, score, assessment_date')
         .in('animal_id', monthAnimalIds)
         .order('assessment_date', { ascending: false });
 
       const animalsWithHealthIssues = new Set(healthRecords?.map(r => r.animal_id) || []);
       
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
         percentage_with_issues: monthAnimalIds.length > 0 
           ? Math.round((animalsWithHealthIssues.size / monthAnimalIds.length) * 100) 
           : 0,
         common_diagnoses: topDiagnoses
       };
 
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
 
 export async function getDeliveryRiskAssessment(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
   const daysAhead = args.days_ahead || 60;
   const startDate = new Date().toISOString().split('T')[0];
   const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
 
   const filteredAnimalIds = await getFilteredAnimalIds(supabase, dataCategory);
    
   if (filteredAnimalIds && filteredAnimalIds.length === 0) {
     return {
       period_days: daysAhead,
       total_deliveries_expected: 0,
       message: `No animals found for data category '${dataCategory}'`
     };
   }
 
   // Get pregnant animals due in the period
   let pregnantRecords: any[] = [];
   let aiError: any = null;
 
   if (filteredAnimalIds && filteredAnimalIds.length > MAX_IDS_PER_BATCH) {
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
     pregnantRecords.sort((a, b) => (a.expected_delivery_date || '').localeCompare(b.expected_delivery_date || ''));
   } else {
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
 
   // Check for regional outbreaks
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
 
 export async function getCohortHealthAnalysis(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
   const cohortFilter = args.cohort_filter;
   const filterValue = args.filter_value;
 
   const categoryAnimalIds = await getFilteredAnimalIds(supabase, dataCategory);
   const categoryFarmIds = await getFilteredFarmIds(supabase, dataCategory);
 
   let animalIds: string[] = [];
   let cohortDescription = '';
 
   if (cohortFilter === 'due_month' && filterValue) {
     let aiRecords: any[] = [];
     let aiError: any = null;
 
     if (categoryAnimalIds && categoryAnimalIds.length > MAX_IDS_PER_BATCH) {
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
 
   const last30Days = healthRecords?.filter(r => r.visit_date >= thirtyDaysAgo) || [];
   const last90Days = healthRecords || [];
 
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
 
   const latestBcsByAnimal: Record<string, number> = {};
   bcsRecords?.forEach((r: any) => {
     if (!latestBcsByAnimal[r.animal_id]) {
       latestBcsByAnimal[r.animal_id] = r.score;
     }
   });
 
   const bcsDistribution = {
     underweight: 0,
     optimal: 0,
     overweight: 0
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
     
     exit_summary: {
       total_exits_90d: exitedAnimals?.length || 0,
       by_reason: exitReasons,
       mortality_count: mortalityCount,
       mortality_rate: animalIds.length > 0 ? Math.round((mortalityCount / animalIds.length) * 100) : 0
     }
   };
 }
 
 // Tool execution dispatcher
 export async function executeAnalystToolCall(
   toolName: string,
   args: any,
   supabase: SupabaseClient,
   dataCategory?: DataCategory
 ) {
   console.log(`[RICO] Executing tool: ${toolName}`, args);
 
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
       return { error: `Unknown analyst tool: ${toolName}` };
   }
 }
 
 // Government Analytics Tools definitions
 export function getAnalystTools(): any[] {
   return [
     { type: "function", function: { name: "get_national_overview", description: "Get national-level statistics: total farms, total animals by type, regional distribution, today's total milk production", parameters: { type: "object", properties: {} } } },
     { type: "function", function: { name: "get_regional_stats", description: "Get statistics for a specific region including farm counts, animal populations, and production", parameters: { type: "object", properties: { region: { type: "string", description: "Region name to filter by (optional - omit for all regions)" } } } } },
     { type: "function", function: { name: "get_breeding_analytics", description: "Get AI success rates, pregnancy statistics by livestock type", parameters: { type: "object", properties: { days: { type: "number", description: "Number of days to analyze (default: 90)" } } } } },
     { type: "function", function: { name: "get_health_analytics", description: "Get health record patterns, common diagnoses, and mortality rates", parameters: { type: "object", properties: { days: { type: "number", description: "Number of days to analyze (default: 30)" } } } } },
     { type: "function", function: { name: "get_production_trends", description: "Get milk production trends across all farms", parameters: { type: "object", properties: { days: { type: "number", description: "Number of days to analyze (default: 30)" } } } } },
     { type: "function", function: { name: "get_farmer_feedback_summary", description: "Get summary of farmer feedback by category, sentiment, and priority", parameters: { type: "object", properties: { days: { type: "number", description: "Number of days to analyze (default: 30)" } } } } },
     { type: "function", function: { name: "get_expected_deliveries_analysis", description: "Get detailed breakdown of expected deliveries by month with health risk assessment, BCS analysis, and potential complications for pregnant animals. Use this to explain WHY deliveries are marked urgent and identify at-risk animals.", parameters: { type: "object", properties: { target_month: { type: "string", description: "Target month in format 'YYYY-MM' (e.g., '2026-03' for March 2026). Omit for overview of all months." }, include_health_risks: { type: "boolean", description: "Include correlation with recent health events (default: true)" } } } } },
     { type: "function", function: { name: "get_delivery_risk_assessment", description: "Analyze risk factors for upcoming deliveries: health outbreaks, underweight animals (low BCS), regional disease patterns that could impact delivery success", parameters: { type: "object", properties: { days_ahead: { type: "number", description: "How many days ahead to analyze (default: 60)" } } } } },
     { type: "function", function: { name: "get_cohort_health_analysis", description: "Deep health analysis for a specific cohort of animals (pregnant due in specific month, animals in a region, etc.)", parameters: { type: "object", properties: { cohort_filter: { type: "string", description: "Filter type: 'due_month', 'region', 'livestock_type'" }, filter_value: { type: "string", description: "Value for filter (e.g., '2026-03', 'Region IV-A', 'cattle')" } } } } }
   ];
 }