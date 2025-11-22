import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription, farmId } = await req.json();

    if (!transcription) {
      throw new Error('No transcription provided');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get farm context for better analysis
    let farmContext = '';
    if (farmId) {
      const { data: farm } = await supabase
        .from('farms')
        .select('name, region, province, municipality, livestock_type')
        .eq('id', farmId)
        .single();

      if (farm) {
        farmContext = `Farm: ${farm.name}, Location: ${farm.municipality}, ${farm.province}, ${farm.region}, Livestock: ${farm.livestock_type}`;
      }
    }

    // Call Lovable AI for analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are an AI analyst for the Philippine Department of Agriculture's farmer feedback system. Your task is to analyze farmer concerns and categorize them for government action.

FARM CONTEXT:
${farmContext || 'No farm context available'}

CATEGORIES (choose ONE primary, up to 2 secondary):
1. policy_concern - Complaints about government policies, regulations, permits, or bureaucratic processes
2. market_access - Issues with selling products, market prices, distribution, or buyers
3. veterinary_support - Need for veterinary services, animal health, disease prevention, vaccines
4. training_request - Request for training, workshops, education on farming techniques
5. infrastructure - Roads, irrigation, electricity, farm facilities, equipment
6. financial_assistance - Loans, subsidies, grants, insurance, financial support
7. emergency_support - Natural disasters, urgent crises, immediate help needed
8. disease_outbreak - Reports of disease spreading among animals in the area
9. feed_shortage - Lack of animal feed, high feed prices, supply chain issues

PRIORITY SCORING (0-100):
- 90-100: CRITICAL - Life-threatening emergencies, disease outbreaks, disasters
- 70-89: HIGH - Significant financial impact, urgent veterinary needs, multiple animals affected
- 40-69: MEDIUM - Training requests, non-urgent support, general concerns
- 0-39: LOW - General inquiries, suggestions, feedback

SENTIMENT:
- urgent: Immediate action required, time-sensitive
- negative: Complaint, frustration, dissatisfaction
- neutral: General inquiry, information request
- positive: Appreciation, suggestion, feedback

ENTITY EXTRACTION:
- locations: Barangay, municipality, province names mentioned
- livestock_types: cattle, carabao, goat, sheep, swine, poultry
- diseases: Specific animal diseases mentioned
- programs: Government programs or agencies mentioned

Analyze the following farmer feedback and respond ONLY with a JSON object (no markdown, no explanation):

{
  "summary": "Brief 2-3 sentence summary in English",
  "primary_category": "category_name",
  "secondary_categories": ["category_name"],
  "tags": ["keyword1", "keyword2", "keyword3"],
  "sentiment": "urgent|negative|neutral|positive",
  "priority_score": 75,
  "detected_entities": {
    "locations": ["location1"],
    "livestock_types": ["type1"],
    "diseases": ["disease1"],
    "programs": ["program1"]
  },
  "suggested_department": "Department/Agency name",
  "actionable_insights": "What government should do"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Farmer feedback: "${transcription}"` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI analysis failed');
    }

    const aiResult = await response.json();
    const analysisText = aiResult.choices[0].message.content;

    // Parse AI response
    let analysis;
    try {
      // Remove markdown code blocks if present
      const cleanText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanText);
    } catch (e) {
      console.error('Failed to parse AI response:', analysisText);
      throw new Error('AI response parsing failed');
    }

    // Map priority score to enum
    let autoPriority = 'medium';
    if (analysis.priority_score >= 90) autoPriority = 'critical';
    else if (analysis.priority_score >= 70) autoPriority = 'high';
    else if (analysis.priority_score < 40) autoPriority = 'low';

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          ...analysis,
          auto_priority: autoPriority,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing feedback:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
