import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Deduct feed from inventory using FIFO strategy
 */
async function deductFeedInventory(
  supabase: any,
  farmId: string,
  activityData: any
): Promise<void> {
  try {
    const feedType = activityData.feed_type;
    const totalKg = activityData.total_kg || activityData.quantity;
    const originalQuantity = activityData.quantity;
    const originalUnit = activityData.unit || 'kg';

    // Strategy 1: Try exact match (case-insensitive)
    let { data: inventoryItems } = await supabase
      .from('feed_inventory')
      .select('*')
      .eq('farm_id', farmId)
      .ilike('feed_type', feedType)
      .gt('quantity_kg', 0)
      .order('created_at', { ascending: true });

    // Strategy 2: If no exact match, try fuzzy contains
    if (!inventoryItems || inventoryItems.length === 0) {
      console.log(`No exact match for "${feedType}", trying fuzzy match...`);
      ({ data: inventoryItems } = await supabase
        .from('feed_inventory')
        .select('*')
        .eq('farm_id', farmId)
        .ilike('feed_type', `%${feedType}%`)
        .gt('quantity_kg', 0)
        .order('created_at', { ascending: true }));
    }

    // Strategy 3: Special case for "hay" - also search for variations with "bale"
    if ((!inventoryItems || inventoryItems.length === 0) && feedType.toLowerCase().includes('hay')) {
      console.log(`No match for "hay", trying "bale" variations...`);
      ({ data: inventoryItems } = await supabase
        .from('feed_inventory')
        .select('*')
        .eq('farm_id', farmId)
        .or('feed_type.ilike.%bale%,feed_type.ilike.%hay%')
        .gt('quantity_kg', 0)
        .order('created_at', { ascending: true }));
    }

    // Strategy 4: For "concentrates" - search for items containing that word
    if ((!inventoryItems || inventoryItems.length === 0) && feedType.toLowerCase().includes('concentrate')) {
      console.log(`Searching for concentrate products...`);
      ({ data: inventoryItems } = await supabase
        .from('feed_inventory')
        .select('*')
        .eq('farm_id', farmId)
        .ilike('feed_type', '%concentrate%')
        .gt('quantity_kg', 0)
        .order('created_at', { ascending: true }));
    }

    // Strategy 5: Extract first significant word (e.g., "corn" from "corn silage")
    if (!inventoryItems || inventoryItems.length === 0) {
      const significantWord = feedType.split(' ')[0];
      if (significantWord.length > 3) {
        console.log(`No matches found, trying first word: "${significantWord}"...`);
        ({ data: inventoryItems } = await supabase
          .from('feed_inventory')
          .select('*')
          .eq('farm_id', farmId)
          .ilike('feed_type', `%${significantWord}%`)
          .gt('quantity_kg', 0)
          .order('created_at', { ascending: true }));
      }
    }

    console.log(`Feed type: "${feedType}" → Found ${inventoryItems?.length || 0} inventory items`);

    if (!inventoryItems || inventoryItems.length === 0) {
      console.warn(`⚠ No inventory found for feed type: "${feedType}"`);
      return;
    }

    let remainingToDeduct = totalKg;

    for (const item of inventoryItems) {
      if (remainingToDeduct <= 0) break;

      const deductAmount = Math.min(Number(item.quantity_kg), remainingToDeduct);
      const newBalance = Number(item.quantity_kg) - deductAmount;

      // Update inventory
      await supabase
        .from('feed_inventory')
        .update({
          quantity_kg: newBalance,
          last_updated: new Date().toISOString()
        })
        .eq('id', item.id);

      // Create consumption transaction
      await supabase
        .from('feed_stock_transactions')
        .insert({
          feed_inventory_id: item.id,
          transaction_type: 'consumption',
          quantity_change_kg: -deductAmount,
          balance_after: newBalance,
          notes: `Approved feeding: ${originalQuantity} ${originalUnit} distributed`,
          created_by: null
        });

      remainingToDeduct -= deductAmount;
      console.log(`✅ Deducted ${deductAmount} kg from ${item.feed_type}, remaining: ${remainingToDeduct} kg`);
    }

    if (remainingToDeduct > 0) {
      console.warn(`⚠ Could not deduct full amount. Remaining: ${remainingToDeduct} kg`);
    }
  } catch (error) {
    console.error('❌ Error deducting from inventory:', error);
    // Don't throw - we don't want to fail the approval if inventory deduction fails
  }
}

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
      .select('farm_id, submitted_by, activity_type, activity_data')
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

      // Deduct inventory if this is a feeding activity
      if (pending.activity_type === 'feeding') {
        await deductFeedInventory(supabaseAdmin, pending.farm_id, pending.activity_data);
      }

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
