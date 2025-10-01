import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function executeToolCall(
  toolName: string,
  args: any,
  supabase: SupabaseClient,
  farmId: string | undefined
) {
  console.log(`Executing tool: ${toolName}`, args);

  switch (toolName) {
    case "get_animal_profile":
      return await getAnimalProfile(args, supabase, farmId);
    
    case "get_animal_complete_profile":
      return await getAnimalCompleteProfile(args, supabase, farmId);
    
    case "search_animals":
      return await searchAnimals(args, supabase, farmId);
    
    case "add_health_record":
      return await addHealthRecord(args, supabase, farmId);
    
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
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
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
    .select('name, ear_tag, breed, gender, life_stage, milking_stage')
    .eq('farm_id', farmId)
    .eq('is_deleted', false);

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
    .select('life_stage, milking_stage')
    .eq('farm_id', farmId)
    .eq('is_deleted', false);

  const totalAnimals = animals?.length || 0;
  const stageBreakdown: Record<string, number> = {};
  
  animals?.forEach(a => {
    const stage = a.life_stage || 'Unknown';
    stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1;
  });

  const today = new Date().toISOString().split('T')[0];
  const { data: todayMilk } = await supabase
    .from('milking_records')
    .select('liters')
    .gte('record_date', today);

  const todayTotal = todayMilk?.reduce((sum, r) => sum + Number(r.liters), 0) || 0;

  return {
    total_animals: totalAnimals,
    stage_breakdown: stageBreakdown,
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

  // Get animals with pregnancy_confirmed events that don't have subsequent calving events
  const { data: pregnancyEvents } = await supabase
    .from('animal_events')
    .select('animal_id, event_date')
    .eq('event_type', 'pregnancy_confirmed')
    .order('event_date', { ascending: false });

  if (!pregnancyEvents || pregnancyEvents.length === 0) {
    return { pregnant_animals: [], count: 0 };
  }

  const pregnantAnimalIds = [];
  
  for (const pe of pregnancyEvents) {
    // Check if there's a calving event after this pregnancy
    const { data: calvings } = await supabase
      .from('animal_events')
      .select('event_date')
      .eq('animal_id', pe.animal_id)
      .eq('event_type', 'calving')
      .gte('event_date', pe.event_date);
    
    if (!calvings || calvings.length === 0) {
      pregnantAnimalIds.push(pe.animal_id);
    }
  }

  if (pregnantAnimalIds.length === 0) {
    return { pregnant_animals: [], count: 0 };
  }

  const { data: animals } = await supabase
    .from('animals')
    .select('name, ear_tag, breed, life_stage')
    .in('id', pregnantAnimalIds)
    .eq('is_deleted', false);

  return {
    pregnant_animals: animals || [],
    count: animals?.length || 0,
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
