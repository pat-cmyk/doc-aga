-- Add linking column to farm_expenses
ALTER TABLE public.farm_expenses 
ADD COLUMN linked_feed_inventory_id uuid REFERENCES public.feed_inventory(id);

-- Create index for efficient lookups
CREATE INDEX idx_farm_expenses_linked_feed ON public.farm_expenses(linked_feed_inventory_id) WHERE linked_feed_inventory_id IS NOT NULL;

-- Create function to auto-create expense when feed is purchased with cost
CREATE OR REPLACE FUNCTION public.create_feed_purchase_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_cost numeric;
  expense_description text;
BEGIN
  -- Only create expense if cost_per_unit is provided and > 0
  IF NEW.cost_per_unit IS NOT NULL AND NEW.cost_per_unit > 0 THEN
    -- Calculate total cost based on quantity
    total_cost := NEW.quantity_kg * NEW.cost_per_unit;
    
    -- Build description
    expense_description := 'Feed Purchase: ' || NEW.feed_type || ' - ' || 
                          NEW.quantity_kg || ' ' || NEW.unit;
    
    -- Insert expense record
    INSERT INTO public.farm_expenses (
      farm_id,
      user_id,
      amount,
      category,
      description,
      expense_date,
      allocation_type,
      linked_feed_inventory_id
    ) VALUES (
      NEW.farm_id,
      COALESCE(NEW.created_by, auth.uid()),
      total_cost,
      'Feed & Supplements',
      expense_description,
      CURRENT_DATE,
      'Operational',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on feed_inventory insert
CREATE TRIGGER trigger_feed_purchase_expense
AFTER INSERT ON public.feed_inventory
FOR EACH ROW
EXECUTE FUNCTION public.create_feed_purchase_expense();