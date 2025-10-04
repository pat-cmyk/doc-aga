-- Enable realtime for orders and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Trigger function to notify merchant on new order
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
    'Order ' || NEW.order_number || ' from ' || COALESCE(farmer_name, 'Customer') || ' - Total: KES ' || NEW.total_amount
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_created
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_merchant_new_order();

-- Trigger function to notify farmer on order status change
CREATE OR REPLACE FUNCTION public.notify_farmer_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_message TEXT;
BEGIN
  -- Only notify on status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Create user-friendly status message
    status_message := CASE NEW.status
      WHEN 'in_process' THEN 'Your order is being processed'
      WHEN 'in_transit' THEN 'Your order has been shipped'
      WHEN 'delivered' THEN 'Your order has been delivered'
      WHEN 'cancelled' THEN 'Your order has been cancelled'
      ELSE 'Order status updated'
    END;
    
    -- Create notification for farmer
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (
      NEW.farmer_id,
      'order_status_changed',
      'Order Update',
      'Order ' || NEW.order_number || ': ' || status_message
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_status_change
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_farmer_order_update();

-- Trigger function to update product stock on order
CREATE OR REPLACE FUNCTION public.update_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reduce product stock quantity
  UPDATE products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_items_created
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_product_stock();