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
    const { pendingId, action, rejectionReason } = await req.json();

    if (!pendingId || !action) {
      return new Response(
        JSON.stringify({ error: 'pendingId and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "approve" or "reject"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} attempting to ${action} activity ${pendingId}`);

    // Verify user can review this activity
    const { data: pending, error: pendingError } = await supabaseAdmin
      .from('pending_activities')
      .select('farm_id, submitted_by, activity_type')
      .eq('id', pendingId)
      .single();

    if (pendingError || !pending) {
      return new Response(
        JSON.stringify({ error: 'Activity not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check permissions using RPC
    const { data: isOwner, error: ownerError } = await supabaseAdmin.rpc('is_farm_owner', {
      _user_id: user.id,
      _farm_id: pending.farm_id
    });

    const { data: isManager, error: managerError } = await supabaseAdmin.rpc('is_farm_manager', {
      _user_id: user.id,
      _farm_id: pending.farm_id
    });

    if (ownerError || managerError) {
      console.error('Permission check error:', { ownerError, managerError });
      return new Response(
        JSON.stringify({ error: 'Permission check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isOwner && !isManager) {
      return new Response(
        JSON.stringify({ error: 'Only farm owners and managers can review activities' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'approve') {
      console.log(`Approving activity ${pendingId}`);
      
      const { data, error } = await supabaseAdmin.rpc('approve_pending_activity', {
        _pending_id: pendingId,
        _approved_by: user.id,
        _is_auto: false
      });

      if (error) {
        console.error('Approval error:', error);
        throw error;
      }

      console.log(`Activity ${pendingId} approved successfully`);

      return new Response(
        JSON.stringify({ success: true, message: 'Activity approved', data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      console.log(`Rejecting activity ${pendingId}`);
      
      // Update status to rejected
      const { error: updateError } = await supabaseAdmin
        .from('pending_activities')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason || 'No reason provided'
        })
        .eq('id', pendingId);

      if (updateError) {
        console.error('Rejection error:', updateError);
        throw updateError;
      }

      // Notify farmhand
      await supabaseAdmin.from('notifications').insert({
        user_id: pending.submitted_by,
        type: 'activity_rejected',
        title: 'Activity Rejected',
        body: `Your ${pending.activity_type} submission was rejected. Reason: ${rejectionReason || 'No reason provided'}`
      });

      console.log(`Activity ${pendingId} rejected successfully`);

      return new Response(
        JSON.stringify({ success: true, message: 'Activity rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback return (should never reach here)
    return new Response(
      JSON.stringify({ error: 'Invalid action processed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );


  } catch (error) {
    console.error('Error in review-pending-activity:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
