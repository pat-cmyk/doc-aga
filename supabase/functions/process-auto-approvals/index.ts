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
          notes: `Auto-approved feeding: ${originalQuantity} ${originalUnit} distributed`,
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting auto-approval process...');

    // Find activities ready for auto-approval
    const { data: pendingActivities, error: fetchError } = await supabase
      .from('pending_activities')
      .select('id, farm_id, activity_type, submitted_by, activity_data')
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
          
          // Deduct inventory if this is a feeding activity
          if (activity.activity_type === 'feeding') {
            await deductFeedInventory(supabase, activity.farm_id, activity.activity_data);
          }
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
