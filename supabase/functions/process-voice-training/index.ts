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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { audio, sampleText, language, userId } = await req.json();

    if (!audio || !sampleText || !language || !userId) {
      throw new Error('Missing required fields');
    }

    // Decode base64 audio
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const audioBlob = new Blob([binaryAudio], { type: 'audio/webm' });

    // Upload to storage
    const fileName = `${userId}/${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from('voice-training-samples')
      .upload(fileName, audioBlob);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload audio');
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('voice-training-samples')
      .getPublicUrl(fileName);

    // Save to database
    const { error: dbError } = await supabase
      .from('voice_training_samples')
      .insert({
        user_id: userId,
        sample_text: sampleText,
        language: language,
        audio_url: publicUrl
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save sample');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Voice sample saved successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in process-voice-training:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
