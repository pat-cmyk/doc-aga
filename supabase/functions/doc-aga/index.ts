import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeToolCall } from "./tools.ts";

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Fetch user's farms
    const { data: farms } = await supabase
      .from('farms')
      .select('id, name')
      .eq('owner_id', user.id)
      .eq('is_deleted', false);
    
    const farmId = farms?.[0]?.id;
    
    // Fetch FAQ knowledge base
    const { data: faqs } = await supabase.from('doc_aga_faqs').select('*').eq('is_active', true);
    const faqContext = faqs?.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') || '';
    
    const systemPrompt = `You are Doc Aga, an expert farm assistant with access to the user's farm data and the ability to manage animal records.

Your knowledge base includes:
${faqContext}

You can access and modify farm data using these tools:
- get_animal_profile: Get detailed information about a specific animal
- search_animals: Search for animals by various criteria
- add_health_record: Create a health record for an animal
- add_milking_record: Log milking production for an animal
- get_farm_overview: Get farm statistics and overview

Guidelines:
- When users ask about specific animals, use get_animal_profile or search_animals to fetch accurate data
- When users report health issues or treatments, offer to create health records
- When users mention milk production, offer to log milking records
- Always confirm before creating records
- Provide clear, practical advice based on proven farming practices
- Be conversational and remember the context of previous messages`;

    const tools = [
      {
        type: "function",
        function: {
          name: "get_animal_profile",
          description: "Get complete profile information for a specific animal including health records, milking data, and parentage",
          parameters: {
            type: "object",
            properties: {
              ear_tag: { type: "string", description: "The animal's ear tag identifier" },
              name: { type: "string", description: "The animal's name" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_animals",
          description: "Search for animals by breed, stage, gender, or other criteria",
          parameters: {
            type: "object",
            properties: {
              breed: { type: "string", description: "Animal breed" },
              life_stage: { type: "string", description: "Life stage (calf, heifer, lactating, dry, etc.)" },
              milking_stage: { type: "string", description: "Milking stage" },
              gender: { type: "string", description: "Gender (male/female)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_health_record",
          description: "Create a new health record for an animal",
          parameters: {
            type: "object",
            properties: {
              animal_identifier: { type: "string", description: "Animal ear tag or name" },
              diagnosis: { type: "string", description: "Health diagnosis or condition" },
              treatment: { type: "string", description: "Treatment administered" },
              notes: { type: "string", description: "Additional notes" },
              visit_date: { type: "string", description: "Date of visit (YYYY-MM-DD)" }
            },
            required: ["animal_identifier", "visit_date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_milking_record",
          description: "Log milk production for an animal",
          parameters: {
            type: "object",
            properties: {
              animal_identifier: { type: "string", description: "Animal ear tag or name" },
              liters: { type: "number", description: "Liters of milk produced" },
              record_date: { type: "string", description: "Date of milking (YYYY-MM-DD)" }
            },
            required: ["animal_identifier", "liters", "record_date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_farm_overview",
          description: "Get farm statistics and overview",
          parameters: { type: "object", properties: {} }
        }
      }
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if response contains tool calls (non-streaming check)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      
      // Handle tool calls
      if (data.choices?.[0]?.message?.tool_calls) {
        const toolCalls = data.choices[0].message.tool_calls;
        const toolResults = [];
        
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          const result = await executeToolCall(toolName, toolArgs, supabase, farmId);
          toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(result)
          });
        }
        
        // Make a second request with tool results
        const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
              data.choices[0].message,
              ...toolResults
            ],
            stream: true,
          }),
        });
        
        if (!followUpResponse.ok) {
          const errorText = await followUpResponse.text();
          console.error("Follow-up AI gateway error:", followUpResponse.status, errorText);
          return new Response(JSON.stringify({ error: "AI gateway error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        return new Response(followUpResponse.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // Return the streaming response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: any) {
    console.error("doc-aga error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});