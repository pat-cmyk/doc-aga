import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to calculate median
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

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

    // PHASE 1: Fetch farm's animals first (needed to filter other queries)
    const animalsResult = await supabase
      .from('animals')
      .select('id, name, ear_tag, gender, birth_date, livestock_type, life_stage, current_weight_kg')
      .eq('farm_id', farmId)
      .eq('is_deleted', false);
    
    const animals = animalsResult.data || [];
    const farmAnimalIds = animals.map(a => a.id);
    
    console.log(`Fetching data for farm ${farmId} with ${farmAnimalIds.length} animals`);
    
    // PHASE 2: Fetch farm-specific records using animal IDs
    const [
      milkingResult,
      aiRecordsResult,
      healthRecordsResult,
      preventiveResult,
      heatRecordsResult
    ] = await Promise.all([
      // Milk production last 90 days - FILTERED BY FARM'S ANIMALS
      farmAnimalIds.length > 0 
        ? supabase
            .from('milking_records')
            .select('record_date, liters, animal_id')
            .in('animal_id', farmAnimalIds)
            .gte('record_date', ninetyDaysAgo.toISOString().split('T')[0])
            .order('record_date', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      
      // AI/Breeding records - FILTERED BY FARM'S ANIMALS
      farmAnimalIds.length > 0
        ? supabase
            .from('ai_records')
            .select('animal_id, scheduled_date, performed_date, pregnancy_confirmed, expected_delivery_date')
            .in('animal_id', farmAnimalIds)
        : Promise.resolve({ data: [], error: null }),
      
      // Health records last 90 days - FILTERED BY FARM'S ANIMALS
      farmAnimalIds.length > 0
        ? supabase
            .from('health_records')
            .select('animal_id, visit_date, diagnosis, treatment')
            .in('animal_id', farmAnimalIds)
            .gte('visit_date', ninetyDaysAgo.toISOString().split('T')[0])
        : Promise.resolve({ data: [], error: null }),
      
      // Preventive health schedules - already filtered by farm_id
      supabase
        .from('preventive_health_schedules')
        .select('animal_id, schedule_type, treatment_name, scheduled_date, status')
        .eq('farm_id', farmId),
      
      // Heat records last 90 days - already filtered by farm_id
      supabase
        .from('heat_records')
        .select('animal_id, detected_at, intensity')
        .eq('farm_id', farmId)
        .gte('detected_at', ninetyDaysAgo.toISOString().split('T')[0])
    ]);

    const milkRecords = milkingResult.data || [];
    const aiRecords = aiRecordsResult.data || [];
    const healthRecords = healthRecordsResult.data || [];
    const preventiveSchedules = preventiveResult.data || [];
    const heatRecords = heatRecordsResult.data || [];
    
    console.log(`Farm ${farmId} data: ${milkRecords.length} milk records, ${healthRecords.length} health records, ${aiRecords.length} AI records`);

    // Calculate milk statistics with historical bounds
    const dailyMilkTotals: Record<string, number> = {};
    milkRecords.forEach(record => {
      const date = record.record_date;
      dailyMilkTotals[date] = (dailyMilkTotals[date] || 0) + (record.liters || 0);
    });

    const sortedDates = Object.keys(dailyMilkTotals).sort();
    const dailyValues = sortedDates.map(date => dailyMilkTotals[date]);
    
    // Calculate historical bounds for conservative predictions
    const maxDailyProduction = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
    const minDailyProduction = dailyValues.length > 0 ? Math.min(...dailyValues) : 0;
    const medianDailyProduction = calculateMedian(dailyValues);
    
    const recentMilkAvg = sortedDates.slice(-14).reduce((sum, date) => sum + dailyMilkTotals[date], 0) / Math.max(sortedDates.slice(-14).length, 1) || 0;
    const previousMilkAvg = sortedDates.slice(-28, -14).reduce((sum, date) => sum + dailyMilkTotals[date], 0) / Math.max(sortedDates.slice(-28, -14).length, 1) || 0;
    const milkTrend = previousMilkAvg > 0 ? ((recentMilkAvg - previousMilkAvg) / previousMilkAvg) * 100 : 0;

    // Conservative bounds for 7-day prediction
    const max7DayPossible = maxDailyProduction * 7;
    const conservative7DayEstimate = Math.round(recentMilkAvg * 7 * 0.95); // 5% conservative buffer
    
    // Data quality factor for confidence scoring (0-1)
    const daysWithData = sortedDates.length;
    const dataQualityFactor = Math.min(daysWithData / 30, 1);

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

    // Build context for AI with capacity constraints
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
        // Historical bounds for conservative predictions
        maxDailyRecorded: Math.round(maxDailyProduction * 10) / 10,
        minDailyRecorded: Math.round(minDailyProduction * 10) / 10,
        medianDaily: Math.round(medianDailyProduction * 10) / 10,
        max7DayPossible: Math.round(max7DayPossible * 10) / 10,
        daysWithData: daysWithData,
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

    // Conservative max confidence based on data quality
    const maxAllowedConfidence = Math.round(60 + (dataQualityFactor * 25)); // 60-85% max

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
            content: `You are a CONSERVATIVE livestock farm analytics AI assistant providing realistic predictive insights for Filipino farmers.
Analyze the farm data and provide predictions in Taglish (mix of Tagalog and English).

CRITICAL CONSTRAINTS - You MUST follow these rules strictly:
1. MILK PREDICTIONS:
   - The farm's MAXIMUM recorded daily production is ${maxDailyProduction}L - NEVER predict above this per day
   - The farm's recent daily average is ${recentMilkAvg.toFixed(1)}L
   - Your forecast7Days MUST be between ${Math.round(minDailyProduction * 7)}L and ${Math.round(maxDailyProduction * 7)}L
   - Use CONSERVATIVE estimates - predict slightly BELOW recent average, never above historical maximum
   - A realistic 7-day forecast should be around ${conservative7DayEstimate}L (95% of recent average)

2. CONFIDENCE SCORES:
   - Maximum allowed confidence is ${maxAllowedConfidence}% based on available data (${daysWithData} days)
   - Use lower confidence (50-65%) if trends are unstable or data is limited
   - Never give confidence above 85% regardless of data quality

3. BE REALISTIC:
   - Farmers trust conservative predictions more than optimistic ones
   - Under-promise, don't over-promise
   - If unsure, lean toward lower predictions with lower confidence

You must respond with ONLY valid JSON in this exact format:
{
  "milk": {
    "forecast7Days": number (predicted total liters for next 7 days - MUST be <= ${Math.round(max7DayPossible)}),
    "trend": "up" | "down" | "stable",
    "confidence": number (0-${maxAllowedConfidence}, be conservative),
    "explanation": string (brief Taglish explanation, max 100 chars)
  },
  "breeding": {
    "nextHeatPredictions": [{ "animalId": string, "predictedDate": string, "confidence": number }] (max 3),
    "deliveryAlerts": [{ "animalId": string, "dueDate": string, "daysUntil": number }] (max 3),
    "successRateForecast": number (0-100, based on historical ${aiSuccessRate.toFixed(0)}%),
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
            content: `Analyze this farm data and provide CONSERVATIVE predictions:\n${JSON.stringify(context, null, 2)}`
          }
        ],
        temperature: 0.2, // Lower temperature for more consistent/conservative outputs
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      // Return conservative fallback predictions based on raw data
      return new Response(JSON.stringify({
        predictions: {
          milk: {
            forecast7Days: conservative7DayEstimate,
            trend: milkTrend > 5 ? 'up' : milkTrend < -5 ? 'down' : 'stable',
            confidence: Math.min(55, Math.round(45 + dataQualityFactor * 15)),
            explanation: `Based sa ${daysWithData} days ng production history`
          },
          breeding: {
            nextHeatPredictions: [],
            deliveryAlerts: upcomingDeliveries.slice(0, 3).map(d => ({
              animalId: d.animal_id,
              dueDate: d.expected_delivery_date,
              daysUntil: Math.ceil((new Date(d.expected_delivery_date!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
            })),
            successRateForecast: Math.round(aiSuccessRate * 0.9), // 10% conservative buffer
            explanation: 'Based on historical AI success rate'
          },
          health: {
            riskLevel: overdueVaccinations > 3 ? 'high' : overdueVaccinations > 0 ? 'medium' : 'low',
            potentialIssues: overdueVaccinations > 0 ? ['Overdue vaccinations detected'] : [],
            overdueCount: overdueVaccinations,
            recommendation: overdueVaccinations > 0 ? 'I-schedule na ang overdue vaccinations' : 'Ituloy ang regular preventive care'
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
      // Return conservative fallback
      predictions = {
        milk: {
          forecast7Days: conservative7DayEstimate,
          trend: milkTrend > 5 ? 'up' : milkTrend < -5 ? 'down' : 'stable',
          confidence: Math.min(55, Math.round(45 + dataQualityFactor * 15)),
          explanation: `Based sa ${daysWithData} days ng production data`
        },
        breeding: {
          nextHeatPredictions: [],
          deliveryAlerts: upcomingDeliveries.slice(0, 3).map(d => ({
            animalId: d.animal_id,
            dueDate: d.expected_delivery_date,
            daysUntil: Math.ceil((new Date(d.expected_delivery_date!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
          })),
          successRateForecast: Math.round(aiSuccessRate * 0.9),
          explanation: 'Based on historical breeding data'
        },
        health: {
          riskLevel: overdueVaccinations > 3 ? 'high' : overdueVaccinations > 0 ? 'medium' : 'low',
          potentialIssues: [],
          overdueCount: overdueVaccinations,
          recommendation: 'Ituloy ang regular health monitoring'
        }
      };
    }

    // POST-VALIDATION: Clamp predictions to realistic bounds
    if (predictions.milk) {
      // Clamp milk forecast to never exceed historical maximum
      const aiPrediction = predictions.milk.forecast7Days;
      
      if (aiPrediction > max7DayPossible) {
        console.log(`Clamping milk prediction from ${aiPrediction}L to ${conservative7DayEstimate}L (max possible: ${max7DayPossible}L)`);
        predictions.milk.forecast7Days = conservative7DayEstimate;
        predictions.milk.confidence = Math.min(predictions.milk.confidence, 60);
        predictions.milk.explanation = `Conservative estimate based sa ${daysWithData} days history`;
      }
      
      // Ensure prediction is not unrealistically high (>110% of max possible)
      if (predictions.milk.forecast7Days > max7DayPossible * 1.1) {
        predictions.milk.forecast7Days = conservative7DayEstimate;
        predictions.milk.confidence = Math.min(predictions.milk.confidence, 55);
      }
      
      // Cap confidence to max allowed based on data quality
      predictions.milk.confidence = Math.min(predictions.milk.confidence, maxAllowedConfidence);
      
      // Ensure minimum bounds
      predictions.milk.forecast7Days = Math.max(predictions.milk.forecast7Days, 0);
    }

    // Cap breeding success rate confidence
    if (predictions.breeding) {
      predictions.breeding.successRateForecast = Math.min(
        predictions.breeding.successRateForecast,
        Math.round(aiSuccessRate * 1.1) // Don't predict more than 10% above historical
      );
    }

    console.log('Generated conservative predictions for farm:', farmId, {
      originalMilkPrediction: content,
      finalMilkPrediction: predictions.milk?.forecast7Days,
      maxPossible: max7DayPossible,
      dataQuality: dataQualityFactor
    });

    return new Response(JSON.stringify({
      predictions,
      generatedAt: now.toISOString(),
      dataSource: 'ai',
      bounds: {
        maxDailyRecorded: maxDailyProduction,
        max7DayPossible: max7DayPossible,
        conservative7DayEstimate: conservative7DayEstimate,
        dataQualityFactor: dataQualityFactor
      }
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
