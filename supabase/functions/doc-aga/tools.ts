 import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 export async function executeToolCall(
   toolName: string,
   args: any,
   supabase: SupabaseClient,
   farmId: string | undefined,
   userId?: string,
   conversationId?: string
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
 
 // ============= FARMER TOOLS =============
 
 async function getAnimalProfile(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   let query = supabase.from('animals').select('*').eq('farm_id', farmId).eq('is_deleted', false);
   if (args.ear_tag) query = query.eq('ear_tag', args.ear_tag);
   else if (args.name) query = query.ilike('name', `%${args.name}%`);
   else return { error: "Please provide either ear_tag or name" };
   const { data: animals, error } = await query;
   if (error || !animals || animals.length === 0) return { error: "Animal not found" };
   const animal = animals[0];
   const { data: healthRecords } = await supabase.from('health_records').select('*').eq('animal_id', animal.id).order('visit_date', { ascending: false }).limit(5);
   const { data: milkingRecords } = await supabase.from('milking_records').select('*').eq('animal_id', animal.id).order('record_date', { ascending: false }).limit(10);
   return { animal: { name: animal.name, ear_tag: animal.ear_tag, breed: animal.breed, gender: animal.gender, birth_date: animal.birth_date, life_stage: animal.life_stage, milking_stage: animal.milking_stage }, health_records: healthRecords || [], milking_records: milkingRecords || [] };
 }
 
 async function getAnimalCompleteProfile(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   let query = supabase.from('animals').select('*').eq('farm_id', farmId).eq('is_deleted', false);
   if (args.ear_tag) query = query.eq('ear_tag', args.ear_tag);
   else if (args.name) query = query.ilike('name', `%${args.name}%`);
   else return { error: "Please provide either ear_tag or name" };
   const { data: animals, error } = await query;
   if (error || !animals || animals.length === 0) return { error: "Animal not found" };
   const animal = animals[0];
   const [healthRecords, milkingRecords, aiRecords, animalEvents, feedingRecords, injectionRecords] = await Promise.all([
     supabase.from('health_records').select('*').eq('animal_id', animal.id).order('visit_date', { ascending: false }).limit(10),
     supabase.from('milking_records').select('*').eq('animal_id', animal.id).order('record_date', { ascending: false }).limit(10),
     supabase.from('ai_records').select('*').eq('animal_id', animal.id).order('scheduled_date', { ascending: false }).limit(10),
     supabase.from('animal_events').select('*').eq('animal_id', animal.id).order('event_date', { ascending: false }).limit(10),
     supabase.from('feeding_records').select('*').eq('animal_id', animal.id).order('record_datetime', { ascending: false }).limit(10),
     supabase.from('injection_records').select('*').eq('animal_id', animal.id).order('record_datetime', { ascending: false }).limit(10),
   ]);
   return { animal: { name: animal.name, ear_tag: animal.ear_tag, breed: animal.breed, gender: animal.gender, birth_date: animal.birth_date, life_stage: animal.life_stage, milking_stage: animal.milking_stage }, health_records: healthRecords.data || [], milking_records: milkingRecords.data || [], ai_records: aiRecords.data || [], animal_events: animalEvents.data || [], feeding_records: feedingRecords.data || [], injection_records: injectionRecords.data || [] };
 }
 
 async function searchAnimals(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   let query = supabase.from('animals').select('name, ear_tag, breed, gender, livestock_type, life_stage, milking_stage').eq('farm_id', farmId).eq('is_deleted', false);
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
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   const { data: { user } } = await supabase.auth.getUser();
   const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
   const { data, error } = await supabase.from('health_records').insert({ animal_id: animal.id, visit_date: phDate, diagnosis: args.diagnosis || null, treatment: args.treatment || null, notes: args.notes || null, created_by: user?.id }).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `Health record created for ${animal.name || animal.ear_tag}`, record: data };
 }
 
 async function updateHealthRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   let query = supabase.from('health_records').select('*').eq('animal_id', animal.id).order('visit_date', { ascending: false });
   if (args.record_date) query = query.eq('visit_date', args.record_date);
   const { data: records, error: fetchError } = await query.limit(1);
   if (fetchError || !records || records.length === 0) return { error: `No health record found for ${animal.name || animal.ear_tag}` };
   const record = records[0];
   const updateData: any = {};
   if (args.new_diagnosis) updateData.diagnosis = args.new_diagnosis;
   if (args.new_treatment) updateData.treatment = args.new_treatment;
   if (args.additional_notes) updateData.notes = record.notes ? `${record.notes}\n\nUpdate: ${args.additional_notes}` : args.additional_notes;
   if (Object.keys(updateData).length === 0) return { error: "No updates provided" };
   const { data, error } = await supabase.from('health_records').update(updateData).eq('id', record.id).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `Health record updated for ${animal.name || animal.ear_tag}`, previous: { diagnosis: record.diagnosis, treatment: record.treatment, notes: record.notes }, updated: { diagnosis: data.diagnosis, treatment: data.treatment, notes: data.notes }, record_date: record.visit_date };
 }
 
 async function addHealthResolution(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   let query = supabase.from('health_records').select('*').eq('animal_id', animal.id).is('resolution_notes', null).order('visit_date', { ascending: false });
   if (args.diagnosis) query = query.ilike('diagnosis', `%${args.diagnosis}%`);
   const { data: records, error: fetchError } = await query.limit(1);
   if (fetchError || !records || records.length === 0) return { error: `No unresolved health record found for ${animal.name || animal.ear_tag}` };
   const record = records[0];
   const { data, error } = await supabase.from('health_records').update({ resolution_notes: args.resolution_notes }).eq('id', record.id).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `Resolved health issue for ${animal.name || animal.ear_tag}`, original_diagnosis: record.diagnosis, resolution: args.resolution_notes, visit_date: record.visit_date };
 }
 
 async function addWeightRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
   const { data, error } = await supabase.from('weight_records').insert({ animal_id: animal.id, measurement_date: phDate, weight_kg: args.weight_kg, measurement_method: args.measurement_method || null, notes: args.notes || null }).select().single();
   if (error) return { error: error.message };
   await supabase.from('animals').update({ current_weight_kg: args.weight_kg }).eq('id', animal.id);
   return { success: true, message: `Weight recorded: ${args.weight_kg}kg for ${animal.name || animal.ear_tag}`, record: data };
 }
 
 async function updateWeightRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   let query = supabase.from('weight_records').select('*').eq('animal_id', animal.id).order('measurement_date', { ascending: false });
   if (args.record_date) query = query.eq('measurement_date', args.record_date);
   const { data: records, error: fetchError } = await query.limit(1);
   if (fetchError || !records || records.length === 0) return { error: `No weight record found for ${animal.name || animal.ear_tag}` };
   const record = records[0];
   const updateData: any = {};
   if (args.new_weight_kg) updateData.weight_kg = args.new_weight_kg;
   if (args.notes) updateData.notes = record.notes ? `${record.notes}\n\nCorrection: ${args.notes}` : args.notes;
   if (Object.keys(updateData).length === 0) return { error: "No updates provided" };
   const { data, error } = await supabase.from('weight_records').update(updateData).eq('id', record.id).select().single();
   if (error) return { error: error.message };
   if (args.new_weight_kg) await supabase.from('animals').update({ current_weight_kg: args.new_weight_kg }).eq('id', animal.id);
   return { success: true, message: `Weight record updated for ${animal.name || animal.ear_tag}`, previous: { weight_kg: record.weight_kg, notes: record.notes }, updated: { weight_kg: data.weight_kg, notes: data.notes }, record_date: record.measurement_date };
 }
 
 async function updateMilkingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   let query = supabase.from('milking_records').select('*').eq('animal_id', animal.id).order('record_date', { ascending: false });
   if (args.record_date) query = query.eq('record_date', args.record_date);
   if (args.session) query = query.eq('session', args.session);
   const { data: records, error: fetchError } = await query.limit(1);
   if (fetchError || !records || records.length === 0) return { error: `No milking record found for ${animal.name || animal.ear_tag}` };
   const record = records[0];
   const updateData: any = {};
   if (args.new_liters !== undefined) updateData.liters = args.new_liters;
   if (args.notes) updateData.notes = record.notes ? `${record.notes}\n\nCorrection: ${args.notes}` : args.notes;
   if (Object.keys(updateData).length === 0) return { error: "No updates provided" };
   const { data, error } = await supabase.from('milking_records').update(updateData).eq('id', record.id).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `Milking record updated for ${animal.name || animal.ear_tag}`, previous: { liters: record.liters, session: record.session }, updated: { liters: data.liters, session: data.session }, record_date: record.record_date };
 }
 
 async function updateAIRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   const { data: records, error: fetchError } = await supabase.from('ai_records').select('*').eq('animal_id', animal.id).order('performed_date', { ascending: false }).limit(1);
   if (fetchError || !records || records.length === 0) return { error: `No AI/breeding record found for ${animal.name || animal.ear_tag}` };
   const record = records[0];
   const updateData: any = {};
   if (args.pregnancy_confirmed !== undefined) { updateData.pregnancy_confirmed = args.pregnancy_confirmed; if (args.pregnancy_confirmed === true) updateData.confirmed_at = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString(); }
   if (args.expected_delivery_date) updateData.expected_delivery_date = args.expected_delivery_date;
   if (args.notes) updateData.notes = record.notes ? `${record.notes}\n\nUpdate: ${args.notes}` : args.notes;
   if (Object.keys(updateData).length === 0) return { error: "No updates provided" };
   const { data, error } = await supabase.from('ai_records').update(updateData).eq('id', record.id).select().single();
   if (error) return { error: error.message };
   return { success: true, message: args.pregnancy_confirmed === true ? `Pregnancy CONFIRMED for ${animal.name || animal.ear_tag}! 🎉` : `AI record updated for ${animal.name || animal.ear_tag}`, previous: { pregnancy_confirmed: record.pregnancy_confirmed, expected_delivery_date: record.expected_delivery_date }, updated: { pregnancy_confirmed: data.pregnancy_confirmed, expected_delivery_date: data.expected_delivery_date }, ai_date: record.performed_date || record.scheduled_date };
 }
 
 async function updateFeedingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   let query = supabase.from('feeding_records').select('*').eq('animal_id', animal.id).order('record_datetime', { ascending: false });
   if (args.record_date) query = query.gte('record_datetime', args.record_date).lt('record_datetime', args.record_date + 'T23:59:59');
   const { data: records, error: fetchError } = await query.limit(1);
   if (fetchError || !records || records.length === 0) return { error: `No feeding record found for ${animal.name || animal.ear_tag}` };
   const record = records[0];
   const updateData: any = {};
   if (args.new_kilograms !== undefined) updateData.kilograms = args.new_kilograms;
   if (args.new_feed_type) updateData.feed_type = args.new_feed_type;
   if (args.notes) updateData.notes = record.notes ? `${record.notes}\n\nCorrection: ${args.notes}` : args.notes;
   if (Object.keys(updateData).length === 0) return { error: "No updates provided" };
   const { data, error } = await supabase.from('feeding_records').update(updateData).eq('id', record.id).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `Feeding record updated for ${animal.name || animal.ear_tag}`, previous: { kilograms: record.kilograms, feed_type: record.feed_type }, updated: { kilograms: data.kilograms, feed_type: data.feed_type }, record_datetime: record.record_datetime };
 }
 
 async function updateInjectionRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   let query = supabase.from('injection_records').select('*').eq('animal_id', animal.id).order('record_datetime', { ascending: false });
   if (args.record_date) query = query.gte('record_datetime', args.record_date).lt('record_datetime', args.record_date + 'T23:59:59');
   const { data: records, error: fetchError } = await query.limit(1);
   if (fetchError || !records || records.length === 0) return { error: `No injection record found for ${animal.name || animal.ear_tag}` };
   const record = records[0];
   const updateData: any = {};
   if (args.new_medicine_name) updateData.medicine_name = args.new_medicine_name;
   if (args.new_dosage) updateData.dosage = args.new_dosage;
   if (args.notes) updateData.notes = record.notes ? `${record.notes}\n\nCorrection: ${args.notes}` : args.notes;
   if (Object.keys(updateData).length === 0) return { error: "No updates provided" };
   const { data, error } = await supabase.from('injection_records').update(updateData).eq('id', record.id).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `Injection record updated for ${animal.name || animal.ear_tag}`, previous: { medicine_name: record.medicine_name, dosage: record.dosage }, updated: { medicine_name: data.medicine_name, dosage: data.dosage }, record_datetime: record.record_datetime };
 }
 
 async function addSmartMilkingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   if (args.animal_identifier) return await addMilkingRecord(args, supabase, farmId);
   let query = supabase.from('animals').select('id, name, ear_tag, livestock_type, milking_stage, life_stage').eq('farm_id', farmId).eq('is_deleted', false);
   if (args.livestock_type) query = query.eq('livestock_type', args.livestock_type);
   const { data: allAnimals, error: animalError } = await query;
   if (animalError) return { error: animalError.message };
   const lactatingAnimals = allAnimals?.filter(a => (a.milking_stage && a.milking_stage !== 'Dry Period') || (a.life_stage && a.life_stage.includes('Lactating'))) || [];
   if (lactatingAnimals.length === 0) { const typeMsg = args.livestock_type ? ` na ${args.livestock_type}` : ''; return { error: `Walang nag-gagatas na hayop${typeMsg} sa farm mo ngayon.`, requires_clarification: true }; }
   if (lactatingAnimals.length === 1) { const animal = lactatingAnimals[0]; const { data: { user } } = await supabase.auth.getUser(); const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0]; const { data, error } = await supabase.from('milking_records').insert({ animal_id: animal.id, record_date: phDate, liters: args.liters, created_by: user?.id }).select().single(); if (error) return { error: error.message }; return { success: true, auto_selected: true, message: `Naitala ko na ang ${args.liters}L para kay ${animal.name || animal.ear_tag}!`, animal: { name: animal.name, ear_tag: animal.ear_tag, livestock_type: animal.livestock_type }, record: data }; }
   const animalList = lactatingAnimals.map(a => `${a.name || 'No name'} (${a.ear_tag})`).join(', ');
   return { requires_clarification: true, eligible_animals: lactatingAnimals.map(a => ({ name: a.name, ear_tag: a.ear_tag, livestock_type: a.livestock_type })), message: `May ${lactatingAnimals.length} nag-gagatas na ${args.livestock_type || 'hayop'}: ${animalList}. Para kay sino ang ${args.liters}L?` };
 }
 
 async function addMilkingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   const { data: { user } } = await supabase.auth.getUser();
   const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
   const { data, error } = await supabase.from('milking_records').insert({ animal_id: animal.id, record_date: phDate, liters: args.liters, created_by: user?.id }).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `Milking record created: ${args.liters}L for ${animal.name || animal.ear_tag}`, record: data };
 }
 
 async function addAIRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   const { data: { user } } = await supabase.auth.getUser();
   const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
   const { data, error } = await supabase.from('ai_records').insert({ animal_id: animal.id, scheduled_date: phDate, technician: args.technician || null, semen_code: args.semen_code || null, notes: args.notes || null, created_by: user?.id }).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `AI record created for ${animal.name || animal.ear_tag}`, record: data };
 }
 
 async function addAnimalEvent(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   const { data: { user } } = await supabase.auth.getUser();
   const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
   const { data, error } = await supabase.from('animal_events').insert({ animal_id: animal.id, event_type: args.event_type, event_date: phDate, notes: args.notes || null, created_by: user?.id }).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `${args.event_type} event recorded for ${animal.name || animal.ear_tag}`, record: data };
 }
 
 async function addFeedingRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   const { data: { user } } = await supabase.auth.getUser();
   const phDateTime = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString();
   const { data, error } = await supabase.from('feeding_records').insert({ animal_id: animal.id, record_datetime: phDateTime, feed_type: args.feed_type || null, kilograms: args.kilograms || null, notes: args.notes || null, created_by: user?.id }).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `Feeding record created for ${animal.name || animal.ear_tag}`, record: data };
 }
 
 async function addInjectionRecord(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('id, name, ear_tag').eq('farm_id', farmId).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).eq('is_deleted', false).limit(1);
   if (!animals || animals.length === 0) return { error: `Animal "${args.animal_identifier}" not found` };
   const animal = animals[0];
   const { data: { user } } = await supabase.auth.getUser();
   const phDateTime = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString();
   const { data, error } = await supabase.from('injection_records').insert({ animal_id: animal.id, record_datetime: phDateTime, medicine_name: args.medicine_name || null, dosage: args.dosage || null, instructions: args.instructions || null, created_by: user?.id }).select().single();
   if (error) return { error: error.message };
   return { success: true, message: `Injection record created for ${animal.name || animal.ear_tag}`, record: data };
 }
 
 async function getFarmOverview(supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: animals } = await supabase.from('animals').select('livestock_type, life_stage, milking_stage').eq('farm_id', farmId).eq('is_deleted', false);
   const totalAnimals = animals?.length || 0;
   const stageBreakdown: Record<string, number> = {};
   const livestockBreakdown: Record<string, number> = {};
   const lactatingByType: Record<string, number> = {};
   animals?.forEach(a => { const stage = a.life_stage || 'Unknown'; stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1; const type = a.livestock_type || 'Unknown'; livestockBreakdown[type] = (livestockBreakdown[type] || 0) + 1; const isLactating = (a.milking_stage && a.milking_stage !== 'Dry Period') || (a.life_stage && a.life_stage.includes('Lactating')); if (isLactating) lactatingByType[type] = (lactatingByType[type] || 0) + 1; });
   const today = new Date().toISOString().split('T')[0];
   const { data: milkingData } = await supabase.from('milking_records').select('liters, animals!inner(livestock_type)').gte('record_date', today);
   const milkByType: Record<string, number> = {};
   milkingData?.forEach((record: any) => { const type = record.animals?.livestock_type || 'Unknown'; milkByType[type] = (milkByType[type] || 0) + Number(record.liters); });
   const todayTotal = Object.values(milkByType).reduce((a, b) => a + b, 0);
   const totalLactating = Object.values(lactatingByType).reduce((a, b) => a + b, 0);
   return { total_animals: totalAnimals, livestock_breakdown: livestockBreakdown, stage_breakdown: stageBreakdown, lactating_by_type: lactatingByType, total_lactating: totalLactating, today_milk_by_type: milkByType, today_milk_liters: todayTotal };
 }
 
 async function getFarmAnalytics(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const days = args.days || 30;
   const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
   const { data: dailyStats } = await supabase.from('daily_farm_stats').select('*').eq('farm_id', farmId).gte('stat_date', startDate).order('stat_date', { ascending: false });
   const { data: monthlyStats } = await supabase.from('monthly_farm_stats').select('*').eq('farm_id', farmId).order('month_date', { ascending: false }).limit(6);
   const avgMilk = dailyStats?.length ? dailyStats.reduce((sum, s) => sum + Number(s.total_milk_liters), 0) / dailyStats.length : 0;
   return { daily_stats: dailyStats || [], monthly_stats: monthlyStats || [], average_daily_milk_liters: Math.round(avgMilk * 100) / 100, period_days: days };
 }
 
 async function getPregnantAnimals(supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: pregnantRecords, error } = await supabase.from('ai_records').select(`animal_id, performed_date, pregnancy_confirmed, animals!inner(id, name, ear_tag, breed, life_stage, farm_id)`).eq('animals.farm_id', farmId).eq('pregnancy_confirmed', true).eq('animals.is_deleted', false);
   if (error || !pregnantRecords) return { pregnant_animals: [], count: 0 };
   const animals = pregnantRecords.map(record => { const animal = Array.isArray(record.animals) ? record.animals[0] : record.animals; return { name: animal.name, ear_tag: animal.ear_tag, breed: animal.breed, life_stage: animal.life_stage }; });
   return { pregnant_animals: animals, count: animals.length };
 }
 
 async function getRecentEvents(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const limit = args.limit || 20;
   const { data: events } = await supabase.from('animal_events').select(`*, animals!inner(name, ear_tag, farm_id)`).eq('animals.farm_id', farmId).eq('animals.is_deleted', false).order('event_date', { ascending: false }).limit(limit);
   return { events: events?.map(e => ({ event_type: e.event_type, event_date: e.event_date, animal_name: e.animals.name, animal_ear_tag: e.animals.ear_tag, notes: e.notes })) || [], count: events?.length || 0 };
 }
 
 function parseRelativeDate(dateStr: string | undefined): { startDate: string; endDate: string } {
   const phToday = new Date(Date.now() + 8 * 60 * 60 * 1000);
   const todayStr = phToday.toISOString().split('T')[0];
   if (!dateStr) return { startDate: todayStr, endDate: todayStr };
   const normalized = dateStr.toLowerCase().trim();
   if (normalized === 'yesterday' || normalized === 'kahapon') { const yesterday = new Date(phToday); yesterday.setDate(yesterday.getDate() - 1); const yesterdayStr = yesterday.toISOString().split('T')[0]; return { startDate: yesterdayStr, endDate: yesterdayStr }; }
   if (normalized === 'today' || normalized === 'ngayon') return { startDate: todayStr, endDate: todayStr };
   if (normalized.includes('last week') || normalized.includes('nakaraang linggo')) { const weekAgo = new Date(phToday); weekAgo.setDate(weekAgo.getDate() - 7); return { startDate: weekAgo.toISOString().split('T')[0], endDate: todayStr }; }
   if (normalized.includes('this month') || normalized.includes('nitong buwan')) { const startOfMonth = new Date(phToday.getFullYear(), phToday.getMonth(), 1); return { startDate: startOfMonth.toISOString().split('T')[0], endDate: todayStr }; }
   if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { startDate: dateStr, endDate: dateStr };
   return { startDate: todayStr, endDate: todayStr };
 }
 
 async function getMilkProduction(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   let startDate: string, endDate: string;
   if (args.start_date && args.end_date) { startDate = args.start_date; endDate = args.end_date; } else { const parsed = parseRelativeDate(args.date); startDate = parsed.startDate; endDate = parsed.endDate; }
   let query = supabase.from('milking_records').select(`liters, record_date, session, animals!inner(id, name, ear_tag, livestock_type, farm_id)`).eq('animals.farm_id', farmId).gte('record_date', startDate).lte('record_date', endDate).order('record_date', { ascending: false });
   if (args.animal_identifier) { const { data: animal } = await supabase.from('animals').select('id').eq('farm_id', farmId).eq('is_deleted', false).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).limit(1).single(); if (animal) query = query.eq('animal_id', animal.id); else return { error: `Animal "${args.animal_identifier}" not found` }; }
   const { data: milkRecords, error } = await query;
   if (error) return { error: error.message };
   const totalLiters = milkRecords?.reduce((sum, r) => sum + Number(r.liters), 0) || 0;
   const byLivestockType: Record<string, number> = {};
   const animalTotals: Record<string, { name: string; ear_tag: string; liters: number; type: string }> = {};
   milkRecords?.forEach((r: any) => { const type = r.animals?.livestock_type || 'Unknown'; const animalId = r.animals?.id; byLivestockType[type] = (byLivestockType[type] || 0) + Number(r.liters); if (animalId && !animalTotals[animalId]) animalTotals[animalId] = { name: r.animals?.name || 'Unknown', ear_tag: r.animals?.ear_tag || 'N/A', liters: 0, type }; if (animalId) animalTotals[animalId].liters += Number(r.liters); });
   const topAnimals = Object.values(animalTotals).sort((a, b) => b.liters - a.liters).slice(0, 10);
   return { query_date: startDate === endDate ? startDate : null, date_range: startDate !== endDate ? { start: startDate, end: endDate } : null, total_liters: Math.round(totalLiters * 100) / 100, by_livestock_type: byLivestockType, top_animals: topAnimals, total_records: milkRecords?.length || 0, total_animals_milked: Object.keys(animalTotals).length };
 }
 
 async function getHealthHistory(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const days = args.days || 30;
   const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
   let query = supabase.from('health_records').select(`id, visit_date, diagnosis, treatment, notes, resolution_notes, animals!inner(id, name, ear_tag, farm_id)`).eq('animals.farm_id', farmId).gte('visit_date', startDate).order('visit_date', { ascending: false });
   if (args.animal_identifier) { const { data: animal } = await supabase.from('animals').select('id').eq('farm_id', farmId).eq('is_deleted', false).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).limit(1).single(); if (animal) query = query.eq('animal_id', animal.id); }
   if (args.diagnosis) query = query.ilike('diagnosis', `%${args.diagnosis}%`);
   const { data: healthRecords, error } = await query.limit(50);
   if (error) return { error: error.message };
   const diagnosisCount: Record<string, number> = {};
   let unresolvedCount = 0;
   healthRecords?.forEach((r: any) => { const diagnosis = r.diagnosis || 'Unspecified'; diagnosisCount[diagnosis] = (diagnosisCount[diagnosis] || 0) + 1; if (!r.resolution_notes) unresolvedCount++; });
   return { period_days: days, total_health_records: healthRecords?.length || 0, unresolved_issues: unresolvedCount, diagnosis_breakdown: diagnosisCount, recent_records: healthRecords?.slice(0, 10).map((r: any) => ({ date: r.visit_date, animal: r.animals?.name || r.animals?.ear_tag, diagnosis: r.diagnosis, treatment: r.treatment, resolved: !!r.resolution_notes })) || [] };
 }
 
 async function getBreedingStatus(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const days = args.days || 90;
   const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
   const today = new Date().toISOString().split('T')[0];
   const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
   const { data: aiRecords, error } = await supabase.from('ai_records').select(`id, scheduled_date, performed_date, pregnancy_confirmed, expected_delivery_date, semen_code, technician, animals!inner(id, name, ear_tag, farm_id, livestock_type)`).eq('animals.farm_id', farmId).eq('animals.is_deleted', false).order('performed_date', { ascending: false });
   if (error) return { error: error.message };
   const pregnant: any[] = []; const dueSoon: any[] = []; const recentAI: any[] = []; const pendingConfirmation: any[] = [];
   aiRecords?.forEach((r: any) => { const animal = r.animals; const record = { animal_name: animal?.name || 'Unknown', animal_ear_tag: animal?.ear_tag || 'N/A', livestock_type: animal?.livestock_type, performed_date: r.performed_date, expected_delivery_date: r.expected_delivery_date, semen_code: r.semen_code }; if (r.pregnancy_confirmed) { pregnant.push(record); if (r.expected_delivery_date && r.expected_delivery_date <= thirtyDaysFromNow && r.expected_delivery_date >= today) dueSoon.push(record); } if (r.performed_date && r.performed_date >= startDate) { recentAI.push(record); if (r.pregnancy_confirmed === null) pendingConfirmation.push(record); } });
   const performedRecords = aiRecords?.filter(r => r.performed_date) || [];
   const confirmedCount = performedRecords.filter(r => r.pregnancy_confirmed === true).length;
   const successRate = performedRecords.length > 0 ? Math.round((confirmedCount / performedRecords.length) * 100) : 0;
   return { period_days: days, total_ai_procedures: recentAI.length, success_rate: `${successRate}%`, currently_pregnant: pregnant.length, due_within_30_days: dueSoon.length, pending_confirmation: pendingConfirmation.length, pregnant_animals: pregnant.slice(0, 10), due_soon: dueSoon, recent_ai: recentAI.slice(0, 10) };
 }
 
 async function getWeightHistory(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const days = args.days || 90;
   const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
   let query = supabase.from('weight_records').select(`id, weight_kg, measurement_date, notes, animals!inner(id, name, ear_tag, farm_id, livestock_type, current_weight_kg)`).eq('animals.farm_id', farmId).eq('animals.is_deleted', false).gte('measurement_date', startDate).order('measurement_date', { ascending: false });
   if (args.animal_identifier) { const { data: animal } = await supabase.from('animals').select('id').eq('farm_id', farmId).eq('is_deleted', false).or(`ear_tag.eq.${args.animal_identifier},name.ilike.%${args.animal_identifier}%`).limit(1).single(); if (animal) query = query.eq('animal_id', animal.id); }
   const { data: weightRecords, error } = await query.limit(100);
   if (error) return { error: error.message };
   const animalWeights: Record<string, { name: string; ear_tag: string; type: string; current: number | null; oldest: number | null; newest: number | null; gain: number | null; records: number }> = {};
   weightRecords?.forEach((r: any) => { const animalId = r.animals?.id; const name = r.animals?.name || 'Unknown'; const ear_tag = r.animals?.ear_tag || 'N/A'; const type = r.animals?.livestock_type || 'Unknown'; if (!animalWeights[animalId]) animalWeights[animalId] = { name, ear_tag, type, current: r.animals?.current_weight_kg, oldest: null, newest: null, gain: null, records: 0 }; animalWeights[animalId].records++; if (!animalWeights[animalId].newest) animalWeights[animalId].newest = r.weight_kg; animalWeights[animalId].oldest = r.weight_kg; });
   Object.values(animalWeights).forEach(a => { if (a.newest && a.oldest) a.gain = Math.round((a.newest - a.oldest) * 10) / 10; });
   const animalList = Object.values(animalWeights).sort((a, b) => (b.gain || 0) - (a.gain || 0));
   return { period_days: days, total_measurements: weightRecords?.length || 0, animals_measured: Object.keys(animalWeights).length, animal_weights: animalList.slice(0, 15), top_gainers: animalList.filter(a => (a.gain || 0) > 0).slice(0, 5), needing_attention: animalList.filter(a => (a.gain || 0) < 0).slice(0, 5) };
 }
 
 async function getFeedingSummary(args: any, supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const days = args.days || 7;
   const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
   let query = supabase.from('feeding_records').select(`id, record_datetime, feed_type, kilograms, cost_per_kg_at_time, animals!inner(id, name, ear_tag, farm_id)`).eq('animals.farm_id', farmId).eq('animals.is_deleted', false).gte('record_datetime', startDate).order('record_datetime', { ascending: false });
   if (args.feed_type) query = query.ilike('feed_type', `%${args.feed_type}%`);
   const { data: feedingRecords, error } = await query.limit(200);
   if (error) return { error: error.message };
   const byFeedType: Record<string, { kg: number; cost: number }> = {};
   let totalKg = 0; let totalCost = 0;
   feedingRecords?.forEach((r: any) => { const type = r.feed_type || 'Unknown'; const kg = Number(r.kilograms) || 0; const costPerKg = Number(r.cost_per_kg_at_time) || 0; const cost = kg * costPerKg; if (!byFeedType[type]) byFeedType[type] = { kg: 0, cost: 0 }; byFeedType[type].kg += kg; byFeedType[type].cost += cost; totalKg += kg; totalCost += cost; });
   const { data: inventory } = await supabase.from('feed_inventory').select('feed_type, quantity_kg, category').eq('farm_id', farmId);
   const inventorySummary = inventory?.map(i => ({ type: i.feed_type, category: i.category, remaining_kg: i.quantity_kg })) || [];
   return { period_days: days, total_feed_consumed_kg: Math.round(totalKg * 10) / 10, total_cost: Math.round(totalCost * 100) / 100, by_feed_type: Object.entries(byFeedType).map(([type, data]) => ({ feed_type: type, kg: Math.round(data.kg * 10) / 10, cost: Math.round(data.cost * 100) / 100 })), current_inventory: inventorySummary, total_records: feedingRecords?.length || 0 };
 }
 
 async function getConversationContext(args: any, supabase: SupabaseClient, userId?: string) {
   if (!userId) return { error: "User not authenticated" };
   const hours = args.hours || 24;
   const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
   const { data: recentQueries, error } = await supabase.from('doc_aga_queries').select('question, answer, created_at').eq('user_id', userId).gte('created_at', sinceTime).order('created_at', { ascending: false }).limit(10);
   if (error) return { error: error.message };
   if (!recentQueries || recentQueries.length === 0) return { has_recent_context: false, message: "No recent conversations found" };
   return { has_recent_context: true, hours_covered: hours, total_recent_queries: recentQueries.length, recent_conversations: recentQueries.slice(0, 5).map(q => ({ question: q.question.slice(0, 200), answer_preview: q.answer?.slice(0, 200), time: q.created_at })) };
 }
 
 async function getFarmContext(supabase: SupabaseClient, farmId: string | undefined) {
   if (!farmId) return { error: "No farm found for user" };
   const { data: farm, error: farmError } = await supabase.from('farms').select('name, created_at').eq('id', farmId).single();
   if (farmError || !farm) return { error: "Farm not found" };
   const { data: farmAnimals } = await supabase.from('animals').select('id').eq('farm_id', farmId).eq('is_deleted', false);
   const farmAnimalIds = farmAnimals?.map(a => a.id) || [];
   if (farmAnimalIds.length === 0) return { farm_name: farm.name, farm_created: farm.created_at ? new Date(farm.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' }) : null, current_date: new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' }), total_animals: 0, message: `This farm was created but has no animals or records yet.` };
   const [milkResult, healthResult, aiResult] = await Promise.all([
     supabase.from('milking_records').select('record_date').in('animal_id', farmAnimalIds).order('record_date', { ascending: true }),
     supabase.from('health_records').select('visit_date').in('animal_id', farmAnimalIds).order('visit_date', { ascending: true }),
     supabase.from('ai_records').select('performed_date').in('animal_id', farmAnimalIds).not('performed_date', 'is', null).order('performed_date', { ascending: true })
   ]);
   const milkDates = milkResult.data?.map(r => r.record_date) || [];
   const healthDates = healthResult.data?.map(r => r.visit_date) || [];
   const aiDates = aiResult.data?.map(r => r.performed_date) || [];
   const formatDate = (date: Date | null) => date ? date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' }) : null;
   return { farm_name: farm.name, farm_created: formatDate(farm.created_at ? new Date(farm.created_at) : null), current_date: formatDate(new Date()), total_animals: farmAnimalIds.length, data_coverage: { milk_records: { earliest: milkDates[0] || null, latest: milkDates[milkDates.length - 1] || null, total_records: milkDates.length }, health_records: { earliest: healthDates[0] || null, latest: healthDates[healthDates.length - 1] || null, total_records: healthDates.length }, breeding_records: { earliest: aiDates[0] || null, latest: aiDates[aiDates.length - 1] || null, total_records: aiDates.length } }, message: `Farm "${farm.name}" has ${farmAnimalIds.length} animals. Milk: ${milkDates.length}, Health: ${healthDates.length}, AI: ${aiDates.length} records.` };
 }