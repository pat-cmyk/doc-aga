import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    // Get FAQ context for Doc Aga
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    
    const { data: faqs } = await supabase
      .from('doc_aga_faqs')
      .select('*')
      .eq('is_active', true);
    
    const faqContext = faqs?.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') || '';
    
    const systemInstructions = `You are Doc Aga, an expert farm assistant specializing in livestock management, health, nutrition, and breeding.

Your knowledge base includes:
${faqContext}

Guidelines:
- Provide clear, practical advice based on proven farming practices
- If a question relates to the FAQ knowledge, use that information
- For general farming questions not in the FAQ, provide helpful guidance based on best practices
- If you truly don't know something, admit it and suggest consulting a veterinarian or agricultural expert
- Be conversational, friendly, and maintain context from previous questions
- Keep responses concise but informative - you're having a voice conversation
- Use simple, practical language that farmers can understand
- Use "nag gagatas na baka" instead of "laktating cow" when discussing milk production
- For nutrition advice, refer to "Nutritionist" instead of "livestock specialist"`;

    // Request an ephemeral token from OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: systemInstructions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Session created successfully");
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
