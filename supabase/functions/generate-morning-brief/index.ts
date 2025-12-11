import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { farmId } = await req.json();
    if (!farmId) {
      return new Response(JSON.stringify({ error: 'farmId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Gather farm data for the brief
    const today = new Date();
    const phDate = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Parallel fetch all data
    const [
      farmResult,
      animalsResult,
      milkingResult,
      healthResult,
      pregnantResult,
      upcomingVaccinesResult,
      upcomingDewormingResult,
      feedInventoryResult,
      recentEventsResult
    ] = await Promise.all([
      supabase.from('farms').select('name, livestock_type').eq('id', farmId).single(),
      supabase.from('animals').select('id, name, ear_tag, life_stage, milking_stage, livestock_type, current_weight_kg').eq('farm_id', farmId).eq('is_deleted', false),
      supabase.from('milking_records').select('liters, record_date, animal_id').gte('record_date', weekAgo).in('animal_id', (await supabase.from('animals').select('id').eq('farm_id', farmId).eq('is_deleted', false)).data?.map(a => a.id) || []),
      supabase.from('health_records').select('diagnosis, treatment, visit_date, animal_id').gte('visit_date', weekAgo).order('visit_date', { ascending: false }).limit(10),
      supabase.from('ai_records').select('animal_id, expected_delivery_date, pregnancy_confirmed').eq('pregnancy_confirmed', true).not('expected_delivery_date', 'is', null),
      supabase.from('preventive_health_schedules').select('animal_id, treatment_type, treatment_name, scheduled_date').eq('status', 'scheduled').eq('treatment_type', 'vaccination').lte('scheduled_date', new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).order('scheduled_date'),
      supabase.from('preventive_health_schedules').select('animal_id, treatment_type, treatment_name, scheduled_date').eq('status', 'scheduled').eq('treatment_type', 'deworming').lte('scheduled_date', new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).order('scheduled_date'),
      supabase.from('feed_inventory').select('feed_type, quantity_kg, reorder_threshold').eq('farm_id', farmId),
      supabase.from('animal_events').select('event_type, event_date, notes, animal_id').gte('event_date', weekAgo).order('event_date', { ascending: false }).limit(5)
    ]);

    const farm = farmResult.data;
    const animals = animalsResult.data || [];
    const milkingRecords = milkingResult.data || [];
    const healthRecords = healthResult.data || [];
    const pregnantAnimals = pregnantResult.data || [];
    const upcomingVaccines = upcomingVaccinesResult.data || [];
    const upcomingDeworming = upcomingDewormingResult.data || [];
    const feedInventory = feedInventoryResult.data || [];
    const recentEvents = recentEventsResult.data || [];

    // Calculate metrics
    const totalAnimals = animals.length;
    const lactatingAnimals = animals.filter(a => a.milking_stage && a.milking_stage !== 'Dry Period').length;
    const todayMilk = milkingRecords.filter(r => r.record_date === phDate).reduce((sum, r) => sum + (r.liters || 0), 0);
    const weekMilkTotal = milkingRecords.reduce((sum, r) => sum + (r.liters || 0), 0);
    const avgDailyMilk = weekMilkTotal / 7;

    // Animals needing attention
    const overdueVaccines = upcomingVaccines.filter(v => v.scheduled_date < phDate).length;
    const overdueDeworming = upcomingDeworming.filter(d => d.scheduled_date < phDate).length;

    // Low feed inventory
    const lowFeedItems = feedInventory.filter(f => f.reorder_threshold && f.quantity_kg <= f.reorder_threshold);

    // Upcoming deliveries (next 30 days)
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcomingDeliveries = pregnantAnimals.filter(p => p.expected_delivery_date && p.expected_delivery_date <= thirtyDaysFromNow);

    // Build context for AI
    const contextData = {
      farmName: farm?.name || 'Your Farm',
      livestockType: farm?.livestock_type || 'cattle',
      totalAnimals,
      lactatingAnimals,
      todayMilk,
      avgDailyMilk: avgDailyMilk.toFixed(1),
      pregnantCount: pregnantAnimals.length,
      upcomingDeliveries: upcomingDeliveries.length,
      overdueVaccines,
      overdueDeworming,
      upcomingVaccinesCount: upcomingVaccines.length,
      upcomingDewormingCount: upcomingDeworming.length,
      recentHealthIssues: healthRecords.length,
      lowFeedItems: lowFeedItems.map(f => f.feed_type),
      recentEvents: recentEvents.map(e => e.event_type),
      date: phDate,
      dayOfWeek: ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'][today.getDay()]
    };

    // Generate AI summary using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are Doc Aga, a friendly Filipino veterinarian AI assistant for farmers. Generate a personalized morning brief in Taglish (mix of Tagalog and English). Keep it warm, encouraging, and actionable.

Format your response as a JSON object with these fields:
- greeting: A warm Taglish greeting mentioning the day
- summary: 2-3 sentence overview of the farm status
- highlights: Array of 2-4 positive highlights or achievements
- alerts: Array of urgent items needing attention (if any)
- tip: One practical tip for the day

Keep each field concise. Use "po" for respect. Be encouraging even when there are issues.`;

    const userPrompt = `Generate a morning brief for ${contextData.farmName} on ${contextData.dayOfWeek}, ${contextData.date}.

Farm Data:
- Total Animals: ${contextData.totalAnimals} ${contextData.livestockType}
- Lactating: ${contextData.lactatingAnimals}
- Today's Milk: ${contextData.todayMilk}L
- Weekly Average: ${contextData.avgDailyMilk}L/day
- Pregnant Animals: ${contextData.pregnantCount}
- Upcoming Deliveries (30 days): ${contextData.upcomingDeliveries}
- Overdue Vaccinations: ${contextData.overdueVaccines}
- Overdue Deworming: ${contextData.overdueDeworming}
- Upcoming Vaccinations: ${contextData.upcomingVaccinesCount}
- Upcoming Deworming: ${contextData.upcomingDewormingCount}
- Recent Health Records: ${contextData.recentHealthIssues}
- Low Feed Stock: ${contextData.lowFeedItems.length > 0 ? contextData.lowFeedItems.join(', ') : 'None'}
- Recent Events: ${contextData.recentEvents.length > 0 ? contextData.recentEvents.join(', ') : 'None'}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      
      // Return fallback brief if AI fails
      return new Response(JSON.stringify({
        brief: {
          greeting: `Magandang umaga po! Maligayang ${contextData.dayOfWeek}!`,
          summary: `May ${totalAnimals} na hayop sa ${farm?.name || 'farm'}. ${lactatingAnimals > 0 ? `${lactatingAnimals} ang nag-gagatas ngayon.` : ''}`,
          highlights: todayMilk > 0 ? [`${todayMilk}L na milk ngayong araw`] : ['Sana productive ang araw mo!'],
          alerts: overdueVaccines > 0 ? [`${overdueVaccines} overdue vaccines`] : [],
          tip: 'Huwag kalimutan i-check ang iyong mga hayop araw-araw.'
        },
        metrics: contextData,
        generatedAt: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const briefContent = aiData.choices?.[0]?.message?.content;
    
    let brief;
    try {
      brief = JSON.parse(briefContent);
    } catch {
      brief = {
        greeting: `Magandang umaga po! Maligayang ${contextData.dayOfWeek}!`,
        summary: briefContent || `May ${totalAnimals} na hayop sa farm.`,
        highlights: [],
        alerts: [],
        tip: ''
      };
    }

    return new Response(JSON.stringify({
      brief,
      metrics: contextData,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Morning brief error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
