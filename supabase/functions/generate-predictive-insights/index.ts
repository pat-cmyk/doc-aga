import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { farmId } = await req.json();
    if (!farmId) {
      return new Response(JSON.stringify({ error: 'farmId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch historical data in parallel
    const [
      milkingResult,
      animalsResult,
      aiRecordsResult,
      healthRecordsResult,
      preventiveResult,
      heatRecordsResult
    ] = await Promise.all([
      // Milk production last 90 days
      supabase
        .from('milking_records')
        .select('record_date, liters, animal_id')
        .gte('record_date', ninetyDaysAgo.toISOString().split('T')[0])
        .order('record_date', { ascending: true }),
      
      // Animals
      supabase
        .from('animals')
        .select('id, name, ear_tag, gender, birth_date, livestock_type, life_stage, current_weight_kg')
        .eq('farm_id', farmId)
        .eq('is_deleted', false),
      
      // AI/Breeding records
      supabase
        .from('ai_records')
        .select('animal_id, scheduled_date, performed_date, pregnancy_confirmed, expected_delivery_date')
        .in('animal_id', (await supabase.from('animals').select('id').eq('farm_id', farmId).eq('is_deleted', false)).data?.map(a => a.id) || []),
      
      // Health records last 90 days
      supabase
        .from('health_records')
        .select('animal_id, visit_date, diagnosis, treatment')
        .gte('visit_date', ninetyDaysAgo.toISOString().split('T')[0]),
      
      // Preventive health schedules
      supabase
        .from('preventive_health_schedules')
        .select('animal_id, schedule_type, treatment_name, scheduled_date, status')
        .eq('farm_id', farmId),
      
      // Heat records last 90 days
      supabase
        .from('heat_records')
        .select('animal_id, detected_at, intensity')
        .eq('farm_id', farmId)
        .gte('detected_at', ninetyDaysAgo.toISOString().split('T')[0])
    ]);

    const milkRecords = milkingResult.data || [];
    const animals = animalsResult.data || [];
    const aiRecords = aiRecordsResult.data || [];
    const healthRecords = healthRecordsResult.data || [];
    const preventiveSchedules = preventiveResult.data || [];
    const heatRecords = heatRecordsResult.data || [];

    // Calculate milk statistics
    const dailyMilkTotals: Record<string, number> = {};
    milkRecords.forEach(record => {
      const date = record.record_date;
      dailyMilkTotals[date] = (dailyMilkTotals[date] || 0) + (record.liters || 0);
    });

    const sortedDates = Object.keys(dailyMilkTotals).sort();
    const recentMilkAvg = sortedDates.slice(-14).reduce((sum, date) => sum + dailyMilkTotals[date], 0) / 14 || 0;
    const previousMilkAvg = sortedDates.slice(-28, -14).reduce((sum, date) => sum + dailyMilkTotals[date], 0) / 14 || 0;
    const milkTrend = previousMilkAvg > 0 ? ((recentMilkAvg - previousMilkAvg) / previousMilkAvg) * 100 : 0;

    // Breeding statistics
    const confirmedPregnancies = aiRecords.filter(r => r.pregnancy_confirmed).length;
    const performedAI = aiRecords.filter(r => r.performed_date).length;
    const aiSuccessRate = performedAI > 0 ? (confirmedPregnancies / performedAI) * 100 : 0;
    const upcomingDeliveries = aiRecords.filter(r => 
      r.pregnancy_confirmed && 
      r.expected_delivery_date && 
      new Date(r.expected_delivery_date) > now &&
      new Date(r.expected_delivery_date) < new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    );

    // Heat detection patterns
    const heatsByAnimal: Record<string, Date[]> = {};
    heatRecords.forEach(hr => {
      if (!heatsByAnimal[hr.animal_id]) heatsByAnimal[hr.animal_id] = [];
      heatsByAnimal[hr.animal_id].push(new Date(hr.detected_at));
    });

    // Health statistics
    const overdueVaccinations = preventiveSchedules.filter(s => 
      s.status === 'scheduled' && 
      s.scheduled_date && 
      new Date(s.scheduled_date) < now
    ).length;

    const upcomingVaccinations = preventiveSchedules.filter(s =>
      s.status === 'scheduled' &&
      s.scheduled_date &&
      new Date(s.scheduled_date) >= now &&
      new Date(s.scheduled_date) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    ).length;

    const recentHealthIssues = healthRecords.filter(hr => 
      new Date(hr.visit_date) >= thirtyDaysAgo
    ).length;

    // Build context for AI
    const context = {
      farmStats: {
        totalAnimals: animals.length,
        femaleAnimals: animals.filter(a => a.gender?.toLowerCase() === 'female').length,
        maleAnimals: animals.filter(a => a.gender?.toLowerCase() === 'male').length,
      },
      milkProduction: {
        recentDailyAverage: Math.round(recentMilkAvg * 10) / 10,
        previousDailyAverage: Math.round(previousMilkAvg * 10) / 10,
        trendPercent: Math.round(milkTrend * 10) / 10,
        totalLast30Days: sortedDates.slice(-30).reduce((sum, date) => sum + dailyMilkTotals[date], 0),
      },
      breeding: {
        aiSuccessRate: Math.round(aiSuccessRate),
        currentlyPregnant: confirmedPregnancies,
        upcomingDeliveries: upcomingDeliveries.length,
        nextDeliveryDate: upcomingDeliveries[0]?.expected_delivery_date || null,
        animalsWithHeatHistory: Object.keys(heatsByAnimal).length,
      },
      health: {
        overdueVaccinations,
        upcomingVaccinations,
        recentHealthIssues,
        scheduledTreatments: preventiveSchedules.filter(s => s.status === 'scheduled').length,
      }
    };

    // Call Lovable AI for predictions
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a livestock farm analytics AI assistant providing predictive insights for Filipino farmers. 
Analyze the farm data and provide predictions in Taglish (mix of Tagalog and English).
You must respond with ONLY valid JSON in this exact format:
{
  "milk": {
    "forecast7Days": number (predicted total liters for next 7 days),
    "trend": "up" | "down" | "stable",
    "confidence": number (0-100),
    "explanation": string (brief Taglish explanation, max 100 chars)
  },
  "breeding": {
    "nextHeatPredictions": [{ "animalId": string, "predictedDate": string, "confidence": number }] (max 3),
    "deliveryAlerts": [{ "animalId": string, "dueDate": string, "daysUntil": number }] (max 3),
    "successRateForecast": number (0-100),
    "explanation": string (brief Taglish explanation, max 100 chars)
  },
  "health": {
    "riskLevel": "low" | "medium" | "high",
    "potentialIssues": string[] (max 3 items),
    "overdueCount": number,
    "recommendation": string (brief Taglish recommendation, max 100 chars)
  }
}`
          },
          {
            role: 'user',
            content: `Analyze this farm data and provide predictions:\n${JSON.stringify(context, null, 2)}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      // Return fallback predictions based on raw data
      return new Response(JSON.stringify({
        predictions: {
          milk: {
            forecast7Days: Math.round(recentMilkAvg * 7),
            trend: milkTrend > 5 ? 'up' : milkTrend < -5 ? 'down' : 'stable',
            confidence: 60,
            explanation: 'Based on recent production trends'
          },
          breeding: {
            nextHeatPredictions: [],
            deliveryAlerts: upcomingDeliveries.slice(0, 3).map(d => ({
              animalId: d.animal_id,
              dueDate: d.expected_delivery_date,
              daysUntil: Math.ceil((new Date(d.expected_delivery_date!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
            })),
            successRateForecast: Math.round(aiSuccessRate),
            explanation: 'Based on historical AI success rate'
          },
          health: {
            riskLevel: overdueVaccinations > 3 ? 'high' : overdueVaccinations > 0 ? 'medium' : 'low',
            potentialIssues: overdueVaccinations > 0 ? ['Overdue vaccinations detected'] : [],
            overdueCount: overdueVaccinations,
            recommendation: overdueVaccinations > 0 ? 'Schedule overdue vaccinations soon' : 'Keep up with preventive care'
          }
        },
        generatedAt: now.toISOString(),
        dataSource: 'fallback'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    // Parse AI response
    let predictions;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        predictions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      // Return fallback
      predictions = {
        milk: {
          forecast7Days: Math.round(recentMilkAvg * 7),
          trend: milkTrend > 5 ? 'up' : milkTrend < -5 ? 'down' : 'stable',
          confidence: 60,
          explanation: 'Based on recent production data'
        },
        breeding: {
          nextHeatPredictions: [],
          deliveryAlerts: upcomingDeliveries.slice(0, 3).map(d => ({
            animalId: d.animal_id,
            dueDate: d.expected_delivery_date,
            daysUntil: Math.ceil((new Date(d.expected_delivery_date!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          })),
          successRateForecast: Math.round(aiSuccessRate),
          explanation: 'Based on historical breeding data'
        },
        health: {
          riskLevel: overdueVaccinations > 3 ? 'high' : overdueVaccinations > 0 ? 'medium' : 'low',
          potentialIssues: [],
          overdueCount: overdueVaccinations,
          recommendation: 'Continue regular health monitoring'
        }
      };
    }

    console.log('Generated predictions for farm:', farmId);

    return new Response(JSON.stringify({
      predictions,
      generatedAt: now.toISOString(),
      dataSource: 'ai'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating predictions:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
