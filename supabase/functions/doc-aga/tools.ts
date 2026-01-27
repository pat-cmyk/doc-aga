import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function executeToolCall(
  toolName: string,
  args: any,
  supabase: SupabaseClient,
  farmId: string | undefined,
  context: 'farmer' | 'government' = 'farmer',
  userId?: string,
  conversationId?: string
) {
  console.log(`Executing tool: ${toolName} (context: ${context})`, args);

  // Government analyst tools
  if (context === 'government') {
    switch (toolName) {
      case "get_national_overview":
        return await getNationalOverview(supabase);
      
      case "get_regional_stats":
        return await getRegionalStats(args, supabase);
      
      case "get_breeding_analytics":
        return await getBreedingAnalytics(args, supabase);
      
      case "get_health_analytics":
        return await getHealthAnalytics(args, supabase);
      
      case "get_production_trends":
        return await getProductionTrends(args, supabase);
      
      case "get_farmer_feedback_summary":
        return await getFarmerFeedbackSummary(args, supabase);
      
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
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ============= GOVERNMENT ANALYST TOOLS =============

async function getNationalOverview(supabase: SupabaseClient) {
  // Get total farms count
  const { count: totalFarms } = await supabase
    .from('farms')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false);

  // Get total animals count by livestock type
  const { data: animals } = await supabase
    .from('animals')
    .select('livestock_type, life_stage, milking_stage')
    .eq('is_deleted', false);

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
  const { data: farmsByRegion } = await supabase
    .from('farms')
    .select('region')
    .eq('is_deleted', false);

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

async function getRegionalStats(args: any, supabase: SupabaseClient) {
  const region = args.region;
  
  let farmsQuery = supabase
    .from('farms')
    .select('id, name, province, municipality')
    .eq('is_deleted', false);

  if (region) {
    farmsQuery = farmsQuery.eq('region', region);
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

async function getBreedingAnalytics(args: any, supabase: SupabaseClient) {
  const days = args.days || 90;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get AI records
  const { data: aiRecords } = await supabase
    .from('ai_records')
    .select('performed_date, pregnancy_confirmed, animals!inner(livestock_type)')
    .gte('performed_date', startDate)
    .not('performed_date', 'is', null);

  const totalAI = aiRecords?.length || 0;
  const confirmedPregnancies = aiRecords?.filter(r => r.pregnancy_confirmed)?.length || 0;
  const successRate = totalAI > 0 ? Math.round((confirmedPregnancies / totalAI) * 100) : 0;

  // Success rate by livestock type
  const aiByType: Record<string, { total: number; confirmed: number }> = {};
  aiRecords?.forEach((r: any) => {
    const type = r.animals?.livestock_type || 'Unknown';
    if (!aiByType[type]) aiByType[type] = { total: 0, confirmed: 0 };
    aiByType[type].total++;
    if (r.pregnancy_confirmed) aiByType[type].confirmed++;
  });

  const successByType: Record<string, number> = {};
  Object.entries(aiByType).forEach(([type, stats]) => {
    successByType[type] = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;
  });

  // Get currently pregnant animals count
  const { count: pregnantCount } = await supabase
    .from('ai_records')
    .select('*', { count: 'exact', head: true })
    .eq('pregnancy_confirmed', true);

  return {
    period_days: days,
    total_ai_procedures: totalAI,
    confirmed_pregnancies: confirmedPregnancies,
    overall_success_rate: successRate,
    success_rate_by_type: successByType,
    currently_pregnant: pregnantCount || 0,
  };
}

async function getHealthAnalytics(args: any, supabase: SupabaseClient) {
  const days = args.days || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get health records
  const { data: healthRecords } = await supabase
    .from('health_records')
    .select('diagnosis, treatment, visit_date')
    .gte('visit_date', startDate);

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
  const { data: exitedAnimals } = await supabase
    .from('animals')
    .select('exit_reason, exit_date')
    .gte('exit_date', startDate)
    .not('exit_date', 'is', null);

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

async function getProductionTrends(args: any, supabase: SupabaseClient) {
  const days = args.days || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get daily milk production
  const { data: milkRecords } = await supabase
    .from('milking_records')
    .select('record_date, liters, animals!inner(livestock_type)')
    .gte('record_date', startDate)
    .order('record_date', { ascending: true });

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

async function getFarmerFeedbackSummary(args: any, supabase: SupabaseClient) {
  const days = args.days || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Get feedback records
  const { data: feedback } = await supabase
    .from('farmer_feedback')
    .select('primary_category, sentiment, status, auto_priority, created_at')
    .gte('created_at', startDate);

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
