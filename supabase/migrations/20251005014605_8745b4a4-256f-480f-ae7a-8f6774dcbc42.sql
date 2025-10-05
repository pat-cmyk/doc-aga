-- Update notification trigger to use PHP currency instead of KES
CREATE OR REPLACE FUNCTION public.notify_merchant_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merchant_user_id UUID;
  farmer_name TEXT;
BEGIN
  -- Get merchant's user_id
  SELECT user_id INTO merchant_user_id
  FROM merchants
  WHERE id = NEW.merchant_id;
  
  -- Get farmer's name
  SELECT full_name INTO farmer_name
  FROM profiles
  WHERE id = NEW.farmer_id;
  
  -- Create notification for merchant
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    merchant_user_id,
    'order_received',
    'New Order Received',
    'Order ' || NEW.order_number || ' from ' || COALESCE(farmer_name, 'Customer') || ' - Total: PHP ' || NEW.total_amount
  );
  
  RETURN NEW;
END;
$$;