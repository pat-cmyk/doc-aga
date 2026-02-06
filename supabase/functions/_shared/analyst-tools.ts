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
 
// ============= NEW POLICY INTELLIGENCE TOOLS (SSOT-Compliant) =============

/**
 * Tool: get_semen_analytics
 * Purpose: Analyze genetic diversity, semen sources, and AI technician performance
 * SSOT Pattern: Uses getFilteredAnimalIds + batch query + Map aggregation
 */
export async function getSemenAnalytics(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const days = args.days || 90;
  const region = args.region;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`[RICO] getSemenAnalytics: Analyzing last ${days} days, region: ${region || 'all'}`);

  // SSOT Step 1: Get filtered animal IDs
  const animalIds = await getFilteredAnimalIds(supabase, dataCategory);
  
  if (animalIds && animalIds.length === 0) {
    return {
      period_days: days,
      unique_semen_sources: 0,
      total_procedures: 0,
      top_semen_sources: [],
      technician_performance: [],
      message: `No animals found for data category '${dataCategory}'`
    };
  }

  // SSOT Step 2: Query AI records with batch pattern
  let aiRecords: any[] = [];
  
  if (animalIds && animalIds.length > MAX_IDS_PER_BATCH) {
    const result = await batchQuery(animalIds, async (batchIds) => {
      return await supabase
        .from('ai_records')
        .select('semen_code, technician, pregnancy_confirmed, animal_id, performed_date')
        .gte('performed_date', startDate)
        .not('performed_date', 'is', null)
        .in('animal_id', batchIds);
    });
    aiRecords = result.data;
  } else {
    let query = supabase
      .from('ai_records')
      .select('semen_code, technician, pregnancy_confirmed, animal_id, performed_date')
      .gte('performed_date', startDate)
      .not('performed_date', 'is', null);
    
    if (animalIds) {
      query = query.in('animal_id', animalIds);
    }
    
    const { data } = await query;
    aiRecords = data || [];
  }

  console.log(`[RICO] getSemenAnalytics: Found ${aiRecords.length} AI records`);

  // If region filter, get animal farms and filter
  if (region && aiRecords.length > 0) {
    const recordAnimalIds = [...new Set(aiRecords.map(r => r.animal_id))];
    const { data: animals } = await supabase
      .from('animals')
      .select('id, farm_id')
      .in('id', recordAnimalIds);
    
    const farmIds = [...new Set(animals?.map(a => a.farm_id) || [])];
    const { data: farms } = await supabase
      .from('farms')
      .select('id, region')
      .in('id', farmIds)
      .eq('region', region);
    
    const regionFarmIds = new Set(farms?.map(f => f.id) || []);
    const regionAnimalIds = new Set(animals?.filter(a => regionFarmIds.has(a.farm_id)).map(a => a.id) || []);
    aiRecords = aiRecords.filter(r => regionAnimalIds.has(r.animal_id));
  }

  // SSOT Step 3: Aggregate with Map-based lookups
  const semenStats = new Map<string, { count: number; confirmed: number }>();
  const techStats = new Map<string, { count: number; confirmed: number }>();

  aiRecords.forEach(r => {
    // Semen aggregation
    const code = r.semen_code || 'Unknown';
    const current = semenStats.get(code) || { count: 0, confirmed: 0 };
    current.count++;
    if (r.pregnancy_confirmed) current.confirmed++;
    semenStats.set(code, current);
    
    // Technician aggregation
    const tech = r.technician || 'Unknown';
    const techCurrent = techStats.get(tech) || { count: 0, confirmed: 0 };
    techCurrent.count++;
    if (r.pregnancy_confirmed) techCurrent.confirmed++;
    techStats.set(tech, techCurrent);
  });

  // Build response
  return {
    period_days: days,
    region_filter: region || 'all',
    unique_semen_sources: semenStats.size - (semenStats.has('Unknown') ? 1 : 0),
    total_procedures: aiRecords.length,
    top_semen_sources: Array.from(semenStats.entries())
      .filter(([code]) => code !== 'Unknown')
      .map(([code, stats]) => ({
        semen_code: code,
        procedures: stats.count,
        confirmed: stats.confirmed,
        success_rate: stats.count > 0 ? Math.round((stats.confirmed / stats.count) * 100) : 0
      }))
      .sort((a, b) => b.procedures - a.procedures)
      .slice(0, 10),
    technician_performance: Array.from(techStats.entries())
      .filter(([name]) => name !== 'Unknown')
      .map(([name, stats]) => ({
        technician: name,
        procedures: stats.count,
        confirmed: stats.confirmed,
        success_rate: stats.count > 0 ? Math.round((stats.confirmed / stats.count) * 100) : 0
      }))
      .sort((a, b) => b.procedures - a.procedures)
      .slice(0, 10),
    unknown_semen_count: semenStats.get('Unknown')?.count || 0,
    unknown_technician_count: techStats.get('Unknown')?.count || 0
  };
}

/**
 * Tool: get_grant_program_analytics
 * Purpose: Compare performance of grant-distributed vs purchased animals
 * SSOT Pattern: Uses getFilteredFarmIds + multi-table joins + Map enrichment
 */
export async function getGrantProgramAnalytics(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const region = args.region;

  console.log(`[RICO] getGrantProgramAnalytics: region: ${region || 'all'}`);

  // SSOT Step 1: Get filtered farm IDs
  const farmIds = await getFilteredFarmIds(supabase, dataCategory);
  
  // Build farm query
  let farmsQuery = supabase
    .from('farms')
    .select('id, region')
    .eq('is_deleted', false);
  
  if (farmIds) {
    farmsQuery = farmsQuery.in('id', farmIds);
  }
  if (region) {
    farmsQuery = farmsQuery.eq('region', region);
  }
  
  const { data: farms } = await farmsQuery;
  const targetFarmIds = farms?.map(f => f.id) || [];
  
  if (targetFarmIds.length === 0) {
    return {
      total_animals: 0,
      message: `No farms found for criteria`
    };
  }

  // SSOT Step 2: Get animals grouped by acquisition type
  const { data: animals } = await supabase
    .from('animals')
    .select('id, acquisition_type, grant_source, exit_date, exit_reason, farm_id')
    .in('farm_id', targetFarmIds)
    .eq('is_deleted', false);

  console.log(`[RICO] getGrantProgramAnalytics: Found ${animals?.length || 0} animals`);

  if (!animals || animals.length === 0) {
    return {
      total_animals: 0,
      message: "No animals found"
    };
  }

  // Group by acquisition type
  const byAcquisition: Record<string, any[]> = {
    grant: [],
    purchased: [],
    born_on_farm: [],
    unknown: []
  };

  animals.forEach(a => {
    const type = a.acquisition_type || 'unknown';
    if (byAcquisition[type]) {
      byAcquisition[type].push(a);
    } else {
      byAcquisition['unknown'].push(a);
    }
  });

  // Get animal IDs for each group
  const allAnimalIds = animals.map(a => a.id);

  // SSOT Step 3: Fetch related data for metrics
  // AI records for breeding success
  const { data: aiRecords } = await supabase
    .from('ai_records')
    .select('animal_id, pregnancy_confirmed')
    .in('animal_id', allAnimalIds);

  // Milking records for milk production (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: milkRecords } = await supabase
    .from('milking_records')
    .select('animal_id, liters')
    .in('animal_id', allAnimalIds)
    .gte('record_date', ninetyDaysAgo);

  // Build lookup maps
  const aiByAnimal = new Map<string, { total: number; confirmed: number }>();
  aiRecords?.forEach(r => {
    const current = aiByAnimal.get(r.animal_id) || { total: 0, confirmed: 0 };
    current.total++;
    if (r.pregnancy_confirmed) current.confirmed++;
    aiByAnimal.set(r.animal_id, current);
  });

  const milkByAnimal = new Map<string, number>();
  milkRecords?.forEach(r => {
    const current = milkByAnimal.get(r.animal_id) || 0;
    milkByAnimal.set(r.animal_id, current + Number(r.liters));
  });

  // Calculate metrics for each acquisition type
  const calculateMetrics = (group: any[]) => {
    const count = group.length;
    const exitedCount = group.filter(a => a.exit_date).length;
    const mortalityCount = group.filter(a => 
      a.exit_reason?.toLowerCase().includes('death') || 
      a.exit_reason?.toLowerCase().includes('died')
    ).length;

    let totalAI = 0, confirmedAI = 0;
    group.forEach(a => {
      const ai = aiByAnimal.get(a.id);
      if (ai) {
        totalAI += ai.total;
        confirmedAI += ai.confirmed;
      }
    });

    let totalMilk = 0, milkingAnimals = 0;
    group.forEach(a => {
      const milk = milkByAnimal.get(a.id);
      if (milk) {
        totalMilk += milk;
        milkingAnimals++;
      }
    });

    return {
      count,
      exited: exitedCount,
      mortality_count: mortalityCount,
      mortality_rate: count > 0 ? Math.round((mortalityCount / count) * 100) : 0,
      ai_procedures: totalAI,
      pregnancies_confirmed: confirmedAI,
      breeding_success_rate: totalAI > 0 ? Math.round((confirmedAI / totalAI) * 100) : 0,
      total_milk_liters: Math.round(totalMilk),
      avg_milk_per_animal: milkingAnimals > 0 ? Math.round(totalMilk / milkingAnimals) : 0
    };
  };

  // Grant source breakdown
  const grantSources = new Map<string, any[]>();
  byAcquisition['grant'].forEach(a => {
    const source = a.grant_source || 'Unknown';
    const current = grantSources.get(source) || [];
    current.push(a);
    grantSources.set(source, current);
  });

  const grantSourceMetrics = Array.from(grantSources.entries())
    .map(([source, group]) => ({
      source,
      ...calculateMetrics(group)
    }))
    .sort((a, b) => b.count - a.count);

  return {
    region_filter: region || 'all',
    total_animals: animals.length,
    by_acquisition_type: {
      grant: calculateMetrics(byAcquisition['grant']),
      purchased: calculateMetrics(byAcquisition['purchased']),
      born_on_farm: calculateMetrics(byAcquisition['born_on_farm']),
      unknown: calculateMetrics(byAcquisition['unknown'])
    },
    grant_percentage: Math.round((byAcquisition['grant'].length / animals.length) * 100),
    grant_sources: grantSourceMetrics,
    comparison_summary: byAcquisition['grant'].length > 0 && byAcquisition['purchased'].length > 0
      ? `Grant animals: ${calculateMetrics(byAcquisition['grant']).breeding_success_rate}% AI success, ${calculateMetrics(byAcquisition['grant']).mortality_rate}% mortality. Purchased: ${calculateMetrics(byAcquisition['purchased']).breeding_success_rate}% AI success, ${calculateMetrics(byAcquisition['purchased']).mortality_rate}% mortality.`
      : "Insufficient data for comparison"
  };
}

/**
 * Tool: get_market_price_intelligence
 * Purpose: Analyze regional price trends and estimate revenue
 * SSOT Pattern: Uses getFilteredFarmIds + market_prices table
 */
export async function getMarketPriceIntelligence(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const days = args.days || 30;
  const region = args.region;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`[RICO] getMarketPriceIntelligence: last ${days} days, region: ${region || 'all'}`);

  // SSOT Step 1: Get filtered farm IDs
  const farmIds = await getFilteredFarmIds(supabase, dataCategory);

  // Get market prices
  let pricesQuery = supabase
    .from('market_prices')
    .select('livestock_type, price_per_kg, effective_date, region, source')
    .gte('effective_date', startDate)
    .order('effective_date', { ascending: false });

  if (region) {
    pricesQuery = pricesQuery.eq('region', region);
  }

  const { data: prices } = await pricesQuery;

  console.log(`[RICO] getMarketPriceIntelligence: Found ${prices?.length || 0} price records`);

  if (!prices || prices.length === 0) {
    return {
      period_days: days,
      region_filter: region || 'all',
      avg_prices_by_species: {},
      price_trends: [],
      regional_prices: [],
      message: "No market price data found for the period"
    };
  }

  // Aggregate prices by species
  const pricesBySpecies = new Map<string, number[]>();
  const pricesByRegionSpecies = new Map<string, { prices: number[]; latest: number; region: string; species: string }>();

  prices.forEach(p => {
    const species = p.livestock_type || 'Unknown';
    const priceList = pricesBySpecies.get(species) || [];
    priceList.push(Number(p.price_per_kg));
    pricesBySpecies.set(species, priceList);

    const key = `${p.region || 'Unknown'}-${species}`;
    const current = pricesByRegionSpecies.get(key) || { prices: [], latest: 0, region: p.region || 'Unknown', species };
    current.prices.push(Number(p.price_per_kg));
    current.latest = current.prices[0]; // First is latest due to order
    pricesByRegionSpecies.set(key, current);
  });

  // Calculate averages and trends
  const avgPrices: Record<string, number> = {};
  const trends: any[] = [];

  pricesBySpecies.forEach((priceList, species) => {
    const avg = priceList.reduce((a, b) => a + b, 0) / priceList.length;
    avgPrices[species] = Math.round(avg * 100) / 100;

    // Trend: compare first half vs second half
    const mid = Math.floor(priceList.length / 2);
    if (priceList.length >= 4) {
      const recentAvg = priceList.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const olderAvg = priceList.slice(mid).reduce((a, b) => a + b, 0) / (priceList.length - mid);
      const change = ((recentAvg - olderAvg) / olderAvg) * 100;
      
      trends.push({
        species,
        trend: change > 3 ? 'rising' : change < -3 ? 'falling' : 'stable',
        change_pct: Math.round(change * 10) / 10,
        sample_count: priceList.length
      });
    }
  });

  // Regional breakdown
  const regionalPrices = Array.from(pricesByRegionSpecies.values())
    .map(v => ({
      region: v.region,
      species: v.species,
      latest_price: Math.round(v.latest * 100) / 100,
      avg_price: Math.round((v.prices.reduce((a, b) => a + b, 0) / v.prices.length) * 100) / 100,
      sample_count: v.prices.length
    }))
    .sort((a, b) => b.sample_count - a.sample_count);

  // Estimate revenue (if we have production data)
  let revenueEstimate = null;
  if (farmIds || !dataCategory || dataCategory === 'all') {
    const { data: milkRecords } = await supabase
      .from('milking_records')
      .select('liters')
      .gte('record_date', startDate);

    const totalLiters = milkRecords?.reduce((sum, r) => sum + Number(r.liters), 0) || 0;
    const dairyPrice = avgPrices['Dairy Cattle'] || avgPrices['cattle'] || 0;
    
    if (totalLiters > 0 && dairyPrice > 0) {
      // Rough estimate: milk price per liter is ~5% of meat price per kg
      const estimatedMilkPrice = dairyPrice * 0.05;
      revenueEstimate = {
        total_milk_liters: Math.round(totalLiters),
        estimated_milk_price_per_liter: Math.round(estimatedMilkPrice * 100) / 100,
        estimated_revenue: Math.round(totalLiters * estimatedMilkPrice)
      };
    }
  }

  return {
    period_days: days,
    region_filter: region || 'all',
    avg_prices_by_species: avgPrices,
    price_trends: trends,
    regional_prices: regionalPrices.slice(0, 20),
    revenue_estimate: revenueEstimate
  };
}

/**
 * Tool: get_feed_security_status
 * Purpose: Identify regional feed shortage hotspots
 * SSOT Pattern: Uses getFilteredFarmIds + feed_inventory aggregation
 * Terminology: Critical (<7 days), Low (7-30 days), Adequate (>30 days) per urgencyGlossary.ts
 */
export async function getFeedSecurityStatus(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const region = args.region;

  console.log(`[RICO] getFeedSecurityStatus: region: ${region || 'all'}`);

  // SSOT Step 1: Get filtered farm IDs
  const farmIds = await getFilteredFarmIds(supabase, dataCategory);

  // Get farms with region info
  let farmsQuery = supabase
    .from('farms')
    .select('id, name, region, province')
    .eq('is_deleted', false);

  if (farmIds) {
    farmsQuery = farmsQuery.in('id', farmIds);
  }
  if (region) {
    farmsQuery = farmsQuery.eq('region', region);
  }

  const { data: farms } = await farmsQuery;
  const targetFarmIds = farms?.map(f => f.id) || [];

  if (targetFarmIds.length === 0) {
    return {
      total_farms: 0,
      message: "No farms found"
    };
  }

  // Get feed inventory for farms
  const { data: feedInventory } = await supabase
    .from('feed_inventory')
    .select('farm_id, quantity_kg, category')
    .in('farm_id', targetFarmIds);

  // Get animals per farm for consumption calculation
  const { data: animals } = await supabase
    .from('animals')
    .select('farm_id')
    .in('farm_id', targetFarmIds)
    .eq('is_deleted', false);

  // Build farm lookup
  const farmMap = new Map(farms?.map(f => [f.id, f]) || []);
  const animalCountByFarm = new Map<string, number>();
  animals?.forEach(a => {
    animalCountByFarm.set(a.farm_id, (animalCountByFarm.get(a.farm_id) || 0) + 1);
  });

  // Calculate stock days per farm (focusing on roughage - animals can survive on roughage alone)
  const stockDaysByFarm = new Map<string, number>();
  const ROUGHAGE_KG_PER_ANIMAL_PER_DAY = 15; // Average roughage consumption

  feedInventory?.forEach(f => {
    if (f.category?.toLowerCase() === 'roughage') {
      const current = stockDaysByFarm.get(f.farm_id) || 0;
      stockDaysByFarm.set(f.farm_id, current + Number(f.quantity_kg));
    }
  });

  // Convert to days
  const farmStockDays: Array<{ farm_id: string; days: number; region: string }> = [];
  targetFarmIds.forEach(farmId => {
    const totalKg = stockDaysByFarm.get(farmId) || 0;
    const animalCount = animalCountByFarm.get(farmId) || 1;
    const days = Math.floor(totalKg / (animalCount * ROUGHAGE_KG_PER_ANIMAL_PER_DAY));
    const farm = farmMap.get(farmId);
    farmStockDays.push({
      farm_id: farmId,
      days,
      region: farm?.region || 'Unknown'
    });
  });

  // Classify using urgencyGlossary.ts definitions
  const critical = farmStockDays.filter(f => f.days < 7);
  const low = farmStockDays.filter(f => f.days >= 7 && f.days < 30);
  const adequate = farmStockDays.filter(f => f.days >= 30);

  // Regional hotspots
  const regionStats = new Map<string, { total: number; critical: number; low: number }>();
  farmStockDays.forEach(f => {
    const stats = regionStats.get(f.region) || { total: 0, critical: 0, low: 0 };
    stats.total++;
    if (f.days < 7) stats.critical++;
    else if (f.days < 30) stats.low++;
    regionStats.set(f.region, stats);
  });

  const hotspots = Array.from(regionStats.entries())
    .map(([r, stats]) => ({
      region: r,
      total_farms: stats.total,
      critical_farms: stats.critical,
      low_farms: stats.low,
      critical_percentage: Math.round((stats.critical / stats.total) * 100)
    }))
    .filter(h => h.critical_farms > 0)
    .sort((a, b) => b.critical_percentage - a.critical_percentage);

  // Security index (0-100, higher is better)
  const securityIndex = targetFarmIds.length > 0
    ? Math.round(((adequate.length + low.length * 0.5) / targetFarmIds.length) * 100)
    : 0;

  return {
    region_filter: region || 'all',
    total_farms: targetFarmIds.length,
    critical_farms: critical.length,
    low_farms: low.length,
    adequate_farms: adequate.length,
    critical_percentage: Math.round((critical.length / targetFarmIds.length) * 100),
    low_percentage: Math.round((low.length / targetFarmIds.length) * 100),
    adequate_percentage: Math.round((adequate.length / targetFarmIds.length) * 100),
    security_index: securityIndex,
    hotspot_regions: hotspots.slice(0, 10),
    terminology_note: "Critical = <7 days stock, Low = 7-30 days, Adequate = >30 days (based on roughage)"
  };
}

/**
 * Tool: get_vaccination_compliance
 * Purpose: Track preventive health program effectiveness
 * SSOT Pattern: Uses getFilteredFarmIds + preventive_health_schedules
 * Terminology: Overdue (past date), Urgent (within 2 days), Soon (within 7 days)
 */
export async function getVaccinationCompliance(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const region = args.region;
  const days = args.days || 90;

  console.log(`[RICO] getVaccinationCompliance: region: ${region || 'all'}, days: ${days}`);

  // SSOT Step 1: Get filtered farm IDs
  const farmIds = await getFilteredFarmIds(supabase, dataCategory);

  // Get farms
  let farmsQuery = supabase
    .from('farms')
    .select('id, region')
    .eq('is_deleted', false);

  if (farmIds) {
    farmsQuery = farmsQuery.in('id', farmIds);
  }
  if (region) {
    farmsQuery = farmsQuery.eq('region', region);
  }

  const { data: farms } = await farmsQuery;
  const targetFarmIds = farms?.map(f => f.id) || [];

  if (targetFarmIds.length === 0) {
    return {
      total_schedules: 0,
      message: "No farms found"
    };
  }

  // Get preventive health schedules
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: schedules } = await supabase
    .from('preventive_health_schedules')
    .select('id, schedule_type, status, scheduled_date, completed_date, farm_id')
    .in('farm_id', targetFarmIds)
    .gte('scheduled_date', startDate);

  console.log(`[RICO] getVaccinationCompliance: Found ${schedules?.length || 0} schedules`);

  if (!schedules || schedules.length === 0) {
    return {
      total_schedules: 0,
      message: "No preventive health schedules found"
    };
  }

  // Classify schedules
  const byType: Record<string, { total: number; completed: number; overdue: number; urgent: number; soon: number }> = {
    vaccination: { total: 0, completed: 0, overdue: 0, urgent: 0, soon: 0 },
    deworming: { total: 0, completed: 0, overdue: 0, urgent: 0, soon: 0 },
    other: { total: 0, completed: 0, overdue: 0, urgent: 0, soon: 0 }
  };

  schedules.forEach(s => {
    const type = s.schedule_type === 'vaccination' || s.schedule_type === 'deworming' 
      ? s.schedule_type 
      : 'other';
    
    byType[type].total++;
    
    if (s.status === 'completed' || s.completed_date) {
      byType[type].completed++;
    } else if (s.scheduled_date < today) {
      byType[type].overdue++;
    } else if (s.scheduled_date <= twoDaysFromNow) {
      byType[type].urgent++;
    } else if (s.scheduled_date <= sevenDaysFromNow) {
      byType[type].soon++;
    }
  });

  const totalCompleted = schedules.filter(s => s.status === 'completed' || s.completed_date).length;
  const totalOverdue = schedules.filter(s => !s.completed_date && s.scheduled_date < today).length;

  return {
    region_filter: region || 'all',
    period_days: days,
    total_schedules: schedules.length,
    completed_count: totalCompleted,
    overdue_count: totalOverdue,
    compliance_rate: Math.round((totalCompleted / schedules.length) * 100),
    by_schedule_type: byType,
    terminology_note: "Overdue = past scheduled date, Urgent = within 2 days, Soon = within 7 days"
  };
}

/**
 * Tool: get_farm_compliance_metrics
 * Purpose: Track record-keeping compliance across farms
 * SSOT Pattern: Uses getFilteredFarmIds + activity counts from records tables
 */
export async function getFarmComplianceMetrics(args: any, supabase: SupabaseClient, dataCategory?: DataCategory) {
  const days = args.days || 30;
  const region = args.region;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`[RICO] getFarmComplianceMetrics: last ${days} days, region: ${region || 'all'}`);

  // SSOT Step 1: Get filtered farm IDs
  const farmIds = await getFilteredFarmIds(supabase, dataCategory);

  // Get farms
  let farmsQuery = supabase
    .from('farms')
    .select('id, name, region')
    .eq('is_deleted', false);

  if (farmIds) {
    farmsQuery = farmsQuery.in('id', farmIds);
  }
  if (region) {
    farmsQuery = farmsQuery.eq('region', region);
  }

  const { data: farms } = await farmsQuery;
  const targetFarmIds = farms?.map(f => f.id) || [];

  if (targetFarmIds.length === 0) {
    return {
      total_farms: 0,
      message: "No farms found"
    };
  }

  // Get animals per farm
  const { data: animals } = await supabase
    .from('animals')
    .select('id, farm_id')
    .in('farm_id', targetFarmIds)
    .eq('is_deleted', false);

  const animalsByFarm = new Map<string, string[]>();
  animals?.forEach(a => {
    const list = animalsByFarm.get(a.farm_id) || [];
    list.push(a.id);
    animalsByFarm.set(a.farm_id, list);
  });

  const allAnimalIds = animals?.map(a => a.id) || [];

  // Get activity counts
  const [milkResult, feedResult, healthResult] = await Promise.all([
    supabase
      .from('milking_records')
      .select('animal_id')
      .in('animal_id', allAnimalIds)
      .gte('record_date', startDate),
    supabase
      .from('feeding_records')
      .select('animal_id')
      .in('animal_id', allAnimalIds)
      .gte('record_datetime', startDate),
    supabase
      .from('health_records')
      .select('animal_id')
      .in('animal_id', allAnimalIds)
      .gte('visit_date', startDate)
  ]);

  // Count unique farms with activity
  const farmWithMilking = new Set<string>();
  const farmWithFeeding = new Set<string>();
  const farmWithHealth = new Set<string>();

  const animalToFarm = new Map<string, string>();
  animals?.forEach(a => animalToFarm.set(a.id, a.farm_id));

  milkResult.data?.forEach(r => {
    const farmId = animalToFarm.get(r.animal_id);
    if (farmId) farmWithMilking.add(farmId);
  });

  feedResult.data?.forEach(r => {
    const farmId = animalToFarm.get(r.animal_id);
    if (farmId) farmWithFeeding.add(farmId);
  });

  healthResult.data?.forEach(r => {
    const farmId = animalToFarm.get(r.animal_id);
    if (farmId) farmWithHealth.add(farmId);
  });

  // Calculate compliance
  const highCompliance = targetFarmIds.filter(id => 
    farmWithMilking.has(id) && farmWithFeeding.has(id)
  ).length;

  const lowCompliance = targetFarmIds.filter(id => 
    !farmWithMilking.has(id) && !farmWithFeeding.has(id) && !farmWithHealth.has(id)
  ).length;

  // Regional breakdown
  const farmMap = new Map(farms?.map(f => [f.id, f]) || []);
  const regionStats = new Map<string, { total: number; high: number; low: number }>();

  targetFarmIds.forEach(id => {
    const farm = farmMap.get(id);
    const r = farm?.region || 'Unknown';
    const stats = regionStats.get(r) || { total: 0, high: 0, low: 0 };
    stats.total++;
    if (farmWithMilking.has(id) && farmWithFeeding.has(id)) stats.high++;
    if (!farmWithMilking.has(id) && !farmWithFeeding.has(id) && !farmWithHealth.has(id)) stats.low++;
    regionStats.set(r, stats);
  });

  const byRegion = Array.from(regionStats.entries())
    .map(([r, stats]) => ({
      region: r,
      total_farms: stats.total,
      high_compliance: stats.high,
      low_compliance: stats.low,
      compliance_rate: Math.round((stats.high / stats.total) * 100)
    }))
    .sort((a, b) => b.total_farms - a.total_farms);

  return {
    region_filter: region || 'all',
    period_days: days,
    total_farms: targetFarmIds.length,
    farms_with_milking_logs: farmWithMilking.size,
    farms_with_feeding_logs: farmWithFeeding.size,
    farms_with_health_logs: farmWithHealth.size,
    high_compliance_farms: highCompliance,
    low_compliance_farms: lowCompliance,
    milking_completion_rate: Math.round((farmWithMilking.size / targetFarmIds.length) * 100),
    feeding_completion_rate: Math.round((farmWithFeeding.size / targetFarmIds.length) * 100),
    overall_compliance_rate: Math.round((highCompliance / targetFarmIds.length) * 100),
    by_region: byRegion
  };
}

// ============= PERSISTENT MEMORY TOOLS =============

/**
 * Helper to extract topic patterns from user questions
 */
function extractTopics(questions: string[]): string[] {
  const topicKeywords = [
    'semen', 'breeding', 'AI', 'genetics',
    'grant', 'program', 'ROI',
    'feed', 'security', 'shortage',
    'vaccination', 'health', 'mortality',
    'market', 'price', 'revenue',
    'compliance', 'audit', 'discrepancy',
    'Region', 'province', 'national',
    'delivery', 'pregnant', 'calving', 'PCRS',
    'lactating', 'milk', 'production'
  ];
  
  const found = new Set<string>();
  questions.forEach(q => {
    topicKeywords.forEach(keyword => {
      if (q.toLowerCase().includes(keyword.toLowerCase())) {
        found.add(keyword);
      }
    });
  });
  
  return Array.from(found);
}

/**
 * Tool: get_user_conversation_context
 * Purpose: Retrieve recent conversation history for the current user
 * This enables RICO to remember previous discussions across sessions
 */
export async function getUserConversationContext(
  args: any,
  supabase: SupabaseClient,
  userId: string,
  _dataCategory?: DataCategory // Not used but kept for SSOT consistency
) {
  const hours = args.hours || 168; // Default 7 days
  const topicKeywords = args.topic_keywords;
  const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  console.log(`[RICO] getUserConversationContext: Fetching last ${hours} hours for user ${userId.slice(0, 8)}...`);

  // Build query for RICO conversations (farm_id is null for government-level queries)
  let query = supabase
    .from('doc_aga_queries')
    .select('question, answer, created_at, conversation_id')
    .eq('user_id', userId)
    .is('farm_id', null) // RICO conversations have null farm_id
    .gte('created_at', sinceTime)
    .order('created_at', { ascending: false })
    .limit(20);

  // Optional keyword filter
  if (topicKeywords) {
    query = query.or(`question.ilike.%${topicKeywords}%,answer.ilike.%${topicKeywords}%`);
  }

  const { data: recentQueries, error } = await query;

  if (error) {
    console.error('[RICO] getUserConversationContext error:', error);
    return { error: error.message };
  }

  if (!recentQueries || recentQueries.length === 0) {
    console.log('[RICO] No recent conversation context found for user');
    return {
      has_recent_context: false,
      message: "This appears to be a new user or no recent RICO conversations found in the last " + hours + " hours."
    };
  }

  // Extract topic patterns from questions
  const topicPatterns = extractTopics(recentQueries.map(q => q.question));
  
  // Count unique sessions
  const uniqueSessions = new Set(recentQueries.map(q => q.conversation_id).filter(Boolean));

  console.log(`[RICO] Found ${recentQueries.length} conversations, ${uniqueSessions.size} sessions, topics: ${topicPatterns.join(', ')}`);

  return {
    has_recent_context: true,
    hours_covered: hours,
    total_conversations: recentQueries.length,
    unique_sessions: uniqueSessions.size,
    topics_discussed: topicPatterns,
    recent_conversations: recentQueries.slice(0, 5).map(q => ({
      question: q.question.slice(0, 200),
      answer_preview: q.answer?.slice(0, 300) || null,
      date: q.created_at
    }))
  };
}

// Tool execution dispatcher
export async function executeAnalystToolCall(
  toolName: string,
  args: any,
  supabase: SupabaseClient,
  dataCategory?: DataCategory,
  userId?: string // Added for user-specific tools like conversation context
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
    
    // POLICY INTELLIGENCE TOOLS
    case "get_semen_analytics":
      return await getSemenAnalytics(args, supabase, dataCategory);
    
    case "get_grant_program_analytics":
      return await getGrantProgramAnalytics(args, supabase, dataCategory);
    
    case "get_market_price_intelligence":
      return await getMarketPriceIntelligence(args, supabase, dataCategory);
    
    case "get_feed_security_status":
      return await getFeedSecurityStatus(args, supabase, dataCategory);
    
    case "get_vaccination_compliance":
      return await getVaccinationCompliance(args, supabase, dataCategory);
    
    case "get_farm_compliance_metrics":
      return await getFarmComplianceMetrics(args, supabase, dataCategory);
    
    // PERSISTENT MEMORY TOOL
    case "get_user_conversation_context":
      if (!userId) {
        return { error: "User ID required for conversation context" };
      }
      return await getUserConversationContext(args, supabase, userId, dataCategory);
    
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
    { type: "function", function: { name: "get_cohort_health_analysis", description: "Deep health analysis for a specific cohort of animals (pregnant due in specific month, animals in a region, etc.)", parameters: { type: "object", properties: { cohort_filter: { type: "string", description: "Filter type: 'due_month', 'region', 'livestock_type'" }, filter_value: { type: "string", description: "Value for filter (e.g., '2026-03', 'Region IV-A', 'cattle')" } } } } },
    // NEW POLICY INTELLIGENCE TOOLS
    { type: "function", function: { name: "get_semen_analytics", description: "Get semen source distribution, genetic diversity metrics, and AI technician performance. Use this to answer questions about breeding program quality, semen brands/types being used, and technician effectiveness.", parameters: { type: "object", properties: { days: { type: "number", description: "Analysis period in days (default: 90)" }, region: { type: "string", description: "Optional region filter" } } } } },
    { type: "function", function: { name: "get_grant_program_analytics", description: "Compare performance of grant-distributed animals vs purchased animals. Tracks mortality rates, breeding success, and milk production by acquisition type and grant source. Use this to evaluate government livestock distribution program effectiveness.", parameters: { type: "object", properties: { region: { type: "string", description: "Optional region filter" } } } } },
    { type: "function", function: { name: "get_market_price_intelligence", description: "Analyze regional market price trends for livestock and estimate revenue. Tracks price changes over time and identifies rising/falling/stable trends by species.", parameters: { type: "object", properties: { days: { type: "number", description: "Analysis period in days (default: 30)" }, region: { type: "string", description: "Optional region filter" } } } } },
    { type: "function", function: { name: "get_feed_security_status", description: "Identify regional feed shortage hotspots. Classifies farms as Critical (<7 days stock), Low (7-30 days), or Adequate (>30 days). Calculates security index and identifies regions at risk.", parameters: { type: "object", properties: { region: { type: "string", description: "Optional region filter" } } } } },
    { type: "function", function: { name: "get_vaccination_compliance", description: "Track vaccination and deworming program compliance. Shows completed, overdue, urgent (within 2 days), and upcoming schedules. Calculates compliance rates by schedule type.", parameters: { type: "object", properties: { region: { type: "string", description: "Optional region filter" }, days: { type: "number", description: "Analysis period in days (default: 90)" } } } } },
    { type: "function", function: { name: "get_farm_compliance_metrics", description: "Track record-keeping compliance across farms. Measures milking log, feeding log, and health record activity. Identifies high and low compliance farms by region.", parameters: { type: "object", properties: { days: { type: "number", description: "Analysis period in days (default: 30)" }, region: { type: "string", description: "Optional region filter" } } } } },
    // PERSISTENT MEMORY TOOL
    { type: "function", function: { name: "get_user_conversation_context", description: "Get the current user's recent RICO conversation history. Use this when the user references previous discussions (e.g., 'remember when we discussed', 'like we talked about', 'following up on', 'continue from before'). Also useful at the start of sessions to understand the user's focus areas and provide continuity.", parameters: { type: "object", properties: { hours: { type: "number", description: "Lookback period in hours (default: 168 = 7 days)" }, topic_keywords: { type: "string", description: "Optional: filter by topic like 'breeding', 'feed security', 'Region VIII'" } } } } }
  ];
}