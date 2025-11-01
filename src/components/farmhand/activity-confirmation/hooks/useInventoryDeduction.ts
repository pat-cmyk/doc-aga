import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to handle feed inventory deduction using FIFO strategy
 * Attempts multiple matching strategies to find appropriate inventory items
 */
export const useInventoryDeduction = () => {
  /**
   * Deduct feed from inventory using FIFO (First In, First Out) strategy
   * Uses multiple fallback strategies for matching feed types
   */
  const deductFromInventory = async (
    feedType: string,
    totalKg: number,
    originalQuantity: number,
    originalUnit: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current farm ID
      const { data: membership } = await supabase
        .from('farm_memberships')
        .select('farm_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) return;

      // Strategy 1: Try exact match (case-insensitive)
      let { data: inventoryItems } = await supabase
        .from('feed_inventory')
        .select('*')
        .eq('farm_id', membership.farm_id)
        .ilike('feed_type', feedType)
        .gt('quantity_kg', 0)
        .order('created_at', { ascending: true });

      // Strategy 2: If no exact match, try fuzzy contains
      if (!inventoryItems || inventoryItems.length === 0) {
        console.log(`No exact match for "${feedType}", trying fuzzy match...`);
        ({ data: inventoryItems } = await supabase
          .from('feed_inventory')
          .select('*')
          .eq('farm_id', membership.farm_id)
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
          .eq('farm_id', membership.farm_id)
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
          .eq('farm_id', membership.farm_id)
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
            .eq('farm_id', membership.farm_id)
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
            notes: `Bulk feeding: ${originalQuantity} ${originalUnit} distributed proportionally`,
            created_by: user.id
          });

        remainingToDeduct -= deductAmount;
        console.log(`Deducted ${deductAmount} kg from ${item.feed_type}, remaining: ${remainingToDeduct} kg`);
      }

      if (remainingToDeduct > 0) {
        console.warn(`Could not deduct full amount. Remaining: ${remainingToDeduct} kg`);
      }
    } catch (error) {
      console.error('Error deducting from inventory:', error);
      // Don't throw - we don't want to fail the feeding record if inventory deduction fails
    }
  };

  return { deductFromInventory };
};
