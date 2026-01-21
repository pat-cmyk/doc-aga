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
    const phNow = new Date(Date.now() + (8 * 60 * 60 * 1000));
    const phDate = phNow.toISOString().split('T')[0];
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fourteenDaysFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // For financial data - current month
    const monthStart = new Date(phNow.getFullYear(), phNow.getMonth(), 1).toISOString().split('T')[0];
    
    // Today's start/end for activity compliance
    const todayStart = `${phDate}T00:00:00`;
    const todayEnd = `${phDate}T23:59:59`;

    // Step 1: First fetch farm and animals to get animal IDs
    const [farmResult, animalsResult] = await Promise.all([
      supabase.from('farms').select('name, livestock_type').eq('id', farmId).single(),
      supabase.from('animals').select('id, name, ear_tag, life_stage, milking_stage, livestock_type, current_weight_kg, sex')
        .eq('farm_id', farmId).eq('is_deleted', false)
    ]);

    const farm = farmResult.data;
    const animals = animalsResult.data || [];
    const animalIds = animals.map(a => a.id);
    
    // Calculate lactating animals for compliance calculation
    const lactatingAnimals = animals.filter(a => a.milking_stage && a.milking_stage !== 'Dry Period');
    const lactatingCount = lactatingAnimals.length;
    const lactatingAnimalIds = lactatingAnimals.map(a => a.id);

    // Step 2: Fetch all animal-related data filtered by this farm's animal IDs
    const [
      milkingResult,
      healthResult,
      pregnantResult,
      upcomingVaccinesResult,
      upcomingDewormingResult,
      feedInventoryResult,
      recentEventsResult,
      // NEW: Today's feeding records
      feedingTodayResult,
      // NEW: Today's milking records for compliance
      milkingTodayResult,
      // NEW: 30-day milk stats for trend
      thirtyDayStatsResult,
      // NEW: Financial data
      revenuesResult,
      expensesResult
    ] = await Promise.all([
      animalIds.length > 0 
        ? supabase.from('milking_records')
            .select('liters, record_date, animal_id')
            .gte('record_date', weekAgo)
            .in('animal_id', animalIds)
        : Promise.resolve({ data: [] }),
      animalIds.length > 0
        ? supabase.from('health_records')
            .select('diagnosis, treatment, visit_date, animal_id')
            .gte('visit_date', weekAgo)
            .in('animal_id', animalIds)
            .order('visit_date', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] }),
      animalIds.length > 0
        ? supabase.from('ai_records')
            .select('animal_id, expected_delivery_date, pregnancy_confirmed')
            .eq('pregnancy_confirmed', true)
            .not('expected_delivery_date', 'is', null)
            .in('animal_id', animalIds)
        : Promise.resolve({ data: [] }),
      animalIds.length > 0
        ? supabase.from('preventive_health_schedules')
            .select('animal_id, treatment_type, treatment_name, scheduled_date')
            .eq('status', 'scheduled')
            .eq('schedule_type', 'vaccination')
            .lte('scheduled_date', fourteenDaysFromNow)
            .in('animal_id', animalIds)
            .order('scheduled_date')
        : Promise.resolve({ data: [] }),
      animalIds.length > 0
        ? supabase.from('preventive_health_schedules')
            .select('animal_id, treatment_type, treatment_name, scheduled_date')
            .eq('status', 'scheduled')
            .eq('schedule_type', 'deworming')
            .lte('scheduled_date', fourteenDaysFromNow)
            .in('animal_id', animalIds)
            .order('scheduled_date')
        : Promise.resolve({ data: [] }),
      supabase.from('feed_inventory').select('feed_type, quantity_kg, reorder_threshold').eq('farm_id', farmId),
      animalIds.length > 0
        ? supabase.from('animal_events')
            .select('event_type, event_date, notes, animal_id')
            .gte('event_date', weekAgo)
            .in('animal_id', animalIds)
            .order('event_date', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
      // NEW: Today's feeding records
      animalIds.length > 0
        ? supabase.from('feeding_records')
            .select('id, animal_id')
            .gte('record_datetime', todayStart)
            .lte('record_datetime', todayEnd)
            .in('animal_id', animalIds)
        : Promise.resolve({ data: [] }),
      // NEW: Today's milking records (for compliance)
      lactatingAnimalIds.length > 0
        ? supabase.from('milking_records')
            .select('id, animal_id, session')
            .eq('record_date', phDate)
            .in('animal_id', lactatingAnimalIds)
        : Promise.resolve({ data: [] }),
      // NEW: 30-day daily farm stats
      supabase.from('daily_farm_stats')
        .select('stat_date, total_milk_liters')
        .eq('farm_id', farmId)
        .gte('stat_date', thirtyDaysAgo)
        .order('stat_date', { ascending: true }),
      // NEW: Monthly revenues
      supabase.from('farm_revenues')
        .select('amount')
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .gte('transaction_date', monthStart),
      // NEW: Monthly expenses
      supabase.from('farm_expenses')
        .select('amount')
        .eq('farm_id', farmId)
        .eq('is_deleted', false)
        .neq('allocation_type', 'Personal')
        .gte('expense_date', monthStart)
    ]);

    const milkingRecords = milkingResult.data || [];
    const healthRecords = healthResult.data || [];
    const pregnantAnimals = pregnantResult.data || [];
    const upcomingVaccines = upcomingVaccinesResult.data || [];
    const upcomingDeworming = upcomingDewormingResult.data || [];
    const feedInventory = feedInventoryResult.data || [];
    const recentEvents = recentEventsResult.data || [];
    const feedingToday = feedingTodayResult.data || [];
    const milkingToday = milkingTodayResult.data || [];
    const thirtyDayStats = thirtyDayStatsResult.data || [];
    const revenues = revenuesResult.data || [];
    const expenses = expensesResult.data || [];

    // Calculate metrics
    const totalAnimals = animals.length;
    const todayMilk = milkingRecords.filter(r => r.record_date === phDate).reduce((sum, r) => sum + (r.liters || 0), 0);
    
    // Calculate yesterday's milk
    const yesterdayDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const phYesterday = new Date(yesterdayDate.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const yesterdayMilk = milkingRecords.filter(r => r.record_date === phYesterday).reduce((sum, r) => sum + (r.liters || 0), 0);
    
    const weekMilkTotal = milkingRecords.reduce((sum, r) => sum + (r.liters || 0), 0);
    const avgDailyMilk = weekMilkTotal / 7;

    // === NEW: Activity Compliance Calculation ===
    // Feeding compliance
    const feedingDone = feedingToday.length > 0;
    const feedingRecordsCount = feedingToday.length;
    const animalsWithFeedingToday = new Set(feedingToday.map(f => f.animal_id)).size;
    
    // Milking compliance (AM + PM sessions expected per lactating animal)
    const currentHour = phNow.getHours();
    // Before 12pm: only AM expected, After 12pm: both AM and PM expected
    const expectedSessionsPerAnimal = currentHour < 12 ? 1 : 2;
    const expectedTotalSessions = lactatingCount * expectedSessionsPerAnimal;
    
    const amSessions = milkingToday.filter(m => m.session === 'AM').length;
    const pmSessions = milkingToday.filter(m => m.session === 'PM').length;
    const completedSessions = amSessions + pmSessions;
    
    const milkingCompliancePercent = expectedTotalSessions > 0 
      ? Math.round((completedSessions / expectedTotalSessions) * 100)
      : 100; // If no lactating animals, compliance is 100%

    // === NEW: 30-Day Milk Trend Calculation ===
    let milkTrend: 'up' | 'down' | 'stable' = 'stable';
    let milkTrendPercent = 0;
    
    if (thirtyDayStats.length >= 14) {
      // Split into last 7 days vs previous 7 days
      const last7 = thirtyDayStats.slice(-7);
      const previous7 = thirtyDayStats.slice(-14, -7);
      
      const last7Avg = last7.reduce((sum, s) => sum + (s.total_milk_liters || 0), 0) / last7.length;
      const previous7Avg = previous7.reduce((sum, s) => sum + (s.total_milk_liters || 0), 0) / previous7.length;
      
      if (previous7Avg > 0) {
        milkTrendPercent = Math.round(((last7Avg - previous7Avg) / previous7Avg) * 100);
        
        if (milkTrendPercent > 5) {
          milkTrend = 'up';
        } else if (milkTrendPercent < -5) {
          milkTrend = 'down';
        }
      }
    }

    // === NEW: Financial Health Calculation ===
    const monthlyRevenue = revenues.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const monthlyExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = monthlyRevenue - monthlyExpenses;
    
    let financialStatus: 'profitable' | 'breakeven' | 'loss' = 'breakeven';
    if (netProfit > 1000) {
      financialStatus = 'profitable';
    } else if (netProfit < -1000) {
      financialStatus = 'loss';
    }

    // Detect all livestock types on the farm with detailed breakdown
    const livestockTypes = [...new Set(animals.map(a => a.livestock_type).filter(Boolean))];
    const hasMultipleTypes = livestockTypes.length > 1;
    
    // Create detailed breakdown per species
    const speciesBreakdown = livestockTypes.map(type => {
      const animalsOfType = animals.filter(a => a.livestock_type === type);
      const lactatingOfType = animalsOfType.filter(a => a.milking_stage && a.milking_stage !== 'Dry Period').length;
      return {
        type,
        total: animalsOfType.length,
        lactating: lactatingOfType
      };
    });
    
    // Create human-readable species description
    const livestockTypesDescription = hasMultipleTypes 
      ? speciesBreakdown.map(s => `${s.total} ${s.type}`).join(', ')
      : (livestockTypes[0] || farm?.livestock_type || 'livestock');

    // Animals needing attention
    const overdueVaccines = upcomingVaccines.filter(v => v.scheduled_date < phDate).length;
    const overdueDeworming = upcomingDeworming.filter(d => d.scheduled_date < phDate).length;

    // Low feed inventory
    const lowFeedItems = feedInventory.filter(f => f.reorder_threshold && f.quantity_kg <= f.reorder_threshold);

    // Upcoming deliveries (next 30 days)
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcomingDeliveries = pregnantAnimals.filter(p => p.expected_delivery_date && p.expected_delivery_date <= thirtyDaysFromNow);

    // Build context for AI - including new metrics
    const contextData = {
      farmName: farm?.name || 'Your Farm',
      livestockType: farm?.livestock_type || 'cattle',
      livestockTypes,
      livestockTypesDescription,
      hasMultipleTypes,
      totalAnimals,
      lactatingAnimals: lactatingCount,
      todayMilk,
      yesterdayMilk,
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
      phYesterday,
      dayOfWeek: ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'][today.getDay()],
      // NEW metrics
      feedingDone,
      feedingRecordsCount,
      animalsWithFeedingToday,
      milkingCompliancePercent,
      completedMilkingSessions: completedSessions,
      expectedMilkingSessions: expectedTotalSessions,
      amSessionsDone: amSessions,
      pmSessionsDone: pmSessions,
      milkTrend,
      milkTrendPercent,
      financialStatus,
      monthlyRevenue: Math.round(monthlyRevenue),
      monthlyExpenses: Math.round(monthlyExpenses),
      netProfit: Math.round(netProfit)
    };

    // Generate AI summary using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const speciesRule = hasMultipleTypes 
      ? `This farm has MULTIPLE species: ${speciesBreakdown.map(s => `${s.total} ${s.type}`).join(', ')}. You MUST use inclusive language like "lahat ng ating mga hayop" or "ating mga baka at kambing". NEVER mention only one species in tips or summary.`
      : `This farm has only ${livestockTypes[0] || 'livestock'}.`;

const systemPrompt = `You are Doc Aga, a friendly Filipino veterinarian AI assistant for farmers. Generate a personalized morning brief in Taglish (mix of Tagalog and English). Keep it warm, encouraging, and actionable.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. DATE PRECISION: Only say "kahapon" when referencing yesterday's data, and "ngayon" for today's data.
2. SPECIES ACCURACY: ${speciesRule}
3. NO STATUS DUPLICATION: Do NOT mention milking/feeding completion status in summary or alerts - another dashboard section already shows this. Focus on INSIGHTS and PATTERNS instead.
4. FINANCIAL SIMPLICITY:
   - If profitable: Brief positive mention in highlights (e.g., "Kumikita ang farm ngayong buwan!")
   - If breakeven: No financial mention needed
   - If loss: Gentle alert "Mag-ingat po sa gastos - mas mataas ang expenses kaysa income ngayong buwan"
5. MILK TRENDS: Only mention if significant change (>5%). Use simple language: "Tumaas/Bumaba ang milk production vs last week"
6. PRIORITY ORDER for alerts (ONLY include if truly urgent):
   a. Animal health emergencies
   b. Overdue vaccinations/deworming (more than 3 days overdue)
   c. Financial concerns (only if in loss)
   d. Low feed stock (only if critical)
   e. Upcoming deliveries in next 7 days

Format your response as a JSON object with these fields:
- greeting: A warm Taglish greeting mentioning the day
- summary: 2-3 sentence overview with insights (milk trends, herd health patterns, achievements)
- highlights: Array of 2-4 positive highlights or achievements (include financial if profitable)
- alerts: Array of TRULY URGENT items only (not daily task reminders)
- tip: One practical tip for the day (MUST follow species rule above)

Keep each field concise. Use "po" for respect. Be encouraging even when there are issues.`;

    const speciesBreakdownText = speciesBreakdown.map(s => `- ${s.type}: ${s.total} total, ${s.lactating} lactating`).join('\n');
    
    // Build activity status text
    const activityStatusText = `
ACTIVITY STATUS (Today - ${phDate}):
- Feeding Done: ${feedingDone ? 'Yes ✅' : 'No ❌'} (${feedingRecordsCount} records, ${animalsWithFeedingToday} animals fed)
- Milking Compliance: ${milkingCompliancePercent}% (${completedSessions}/${expectedTotalSessions} sessions)
  - AM Sessions: ${amSessions}/${lactatingCount} done
  - PM Sessions: ${currentHour >= 12 ? `${pmSessions}/${lactatingCount} done` : 'Not yet time'}`;

    // Build trend text
    const trendText = thirtyDayStats.length >= 14 
      ? `
30-DAY MILK TREND:
- Trend: ${milkTrend === 'up' ? '📈 UP' : milkTrend === 'down' ? '📉 DOWN' : '➡️ STABLE'} (${milkTrendPercent >= 0 ? '+' : ''}${milkTrendPercent}%)
- ${milkTrend === 'up' ? 'Production is increasing vs last week' : milkTrend === 'down' ? 'Production is decreasing vs last week' : 'Production is stable'}`
      : '\n30-DAY MILK TREND: Insufficient data yet';

    // Build financial text
    const financialText = `
FINANCIAL STATUS (This Month):
- Status: ${financialStatus.toUpperCase()}
- Revenue: ₱${monthlyRevenue.toLocaleString()}
- Expenses: ₱${monthlyExpenses.toLocaleString()}
- Net: ${netProfit >= 0 ? '+' : ''}₱${netProfit.toLocaleString()}`;
    
    const userPrompt = `Generate a morning brief for ${contextData.farmName} on ${contextData.dayOfWeek}, ${contextData.date}.

DATE REFERENCE (BE PRECISE):
- Today = ${contextData.date} (use "ngayon")
- Yesterday = ${contextData.phYesterday} (use "kahapon")
- Today's Milk: ${contextData.todayMilk}L
- Yesterday's Milk: ${contextData.yesterdayMilk}L

FARM COMPOSITION:
${speciesBreakdownText}
${hasMultipleTypes ? '\n⚠️ IMPORTANT: This is a MIXED SPECIES farm. Tips and summary must apply to ALL species or use inclusive language like "lahat ng ating mga hayop".' : ''}

Farm Metrics:
- Total Animals: ${contextData.totalAnimals}
- Total Lactating: ${contextData.lactatingAnimals}
- Weekly Average Milk: ${contextData.avgDailyMilk}L/day
- Pregnant Animals: ${contextData.pregnantCount}
- Upcoming Deliveries (30 days): ${contextData.upcomingDeliveries}
- Overdue Vaccinations: ${contextData.overdueVaccines}
- Overdue Deworming: ${contextData.overdueDeworming}
- Upcoming Vaccinations: ${contextData.upcomingVaccinesCount}
- Upcoming Deworming: ${contextData.upcomingDewormingCount}
- Recent Health Records: ${contextData.recentHealthIssues}
- Low Feed Stock: ${contextData.lowFeedItems.length > 0 ? contextData.lowFeedItems.join(', ') : 'None'}
- Recent Events: ${contextData.recentEvents.length > 0 ? contextData.recentEvents.join(', ') : 'None'}
${activityStatusText}
${trendText}
${financialText}`;

    console.log('Morning brief context:', JSON.stringify(contextData, null, 2));

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
          summary: `May ${totalAnimals} na hayop sa ${farm?.name || 'farm'}. ${lactatingCount > 0 ? `${lactatingCount} ang nag-gagatas ngayon.` : ''}`,
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
