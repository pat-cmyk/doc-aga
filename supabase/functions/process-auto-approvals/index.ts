import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting auto-approval process...');

    // Find activities ready for auto-approval
    const { data: pendingActivities, error: fetchError } = await supabase
      .from('pending_activities')
      .select('id, farm_id, activity_type, submitted_by')
      .eq('status', 'pending')
      .lte('auto_approve_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching pending activities:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingActivities?.length || 0} activities to auto-approve`);

    const results = [];
    for (const activity of pendingActivities || []) {
      // Check if farm has auto-approval enabled
      const { data: settings, error: settingsError } = await supabase
        .from('farm_approval_settings')
        .select('auto_approve_enabled')
        .eq('farm_id', activity.farm_id)
        .maybeSingle();

      if (settingsError) {
        console.error(`Error fetching settings for farm ${activity.farm_id}:`, settingsError);
        results.push({
          id: activity.id,
          success: false,
          error: settingsError.message
        });
        continue;
      }

      const autoApproveEnabled = settings?.auto_approve_enabled ?? true;

      if (autoApproveEnabled) {
        console.log(`Auto-approving activity ${activity.id}...`);
        
        const { data, error } = await supabase.rpc('approve_pending_activity', {
          _pending_id: activity.id,
          _approved_by: null, // System approval
          _is_auto: true
        });

        if (error) {
          console.error(`Error approving activity ${activity.id}:`, error);
        } else {
          console.log(`Successfully auto-approved activity ${activity.id}`);
        }

        results.push({
          id: activity.id,
          activity_type: activity.activity_type,
          success: !error,
          error: error?.message
        });
      } else {
        console.log(`Auto-approval disabled for farm ${activity.farm_id}, skipping activity ${activity.id}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Auto-approval complete: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ 
        processed: results.length, 
        succeeded: successCount,
        failed: failureCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Fatal error in auto-approval process:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
