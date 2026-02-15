-- Drop the redundant trigger that creates duplicate feed purchase expenses
DROP TRIGGER IF EXISTS trigger_feed_purchase_expense ON public.feed_inventory;
DROP FUNCTION IF EXISTS create_feed_purchase_expense();