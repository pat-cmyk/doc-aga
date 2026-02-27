-- Fix: sync_milk_inventory_on_update trigger
-- When quality changes, also update liters_original and record_date
-- to prevent data loss when both quality AND liters change simultaneously
CREATE OR REPLACE FUNCTION sync_milk_inventory_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If milk_quality changed, update inventory quality + liters + date
  IF NEW.milk_quality IS DISTINCT FROM OLD.milk_quality THEN
    UPDATE public.milk_inventory
    SET milk_quality = COALESCE(NEW.milk_quality, 'good'),
        milk_quality_rejection_reason = NEW.milk_quality_rejection_reason,
        is_available = CASE 
          WHEN COALESCE(NEW.is_sold, false) THEN false 
          ELSE true 
        END,
        liters_original = NEW.liters,
        liters_remaining = CASE
          WHEN NEW.milk_quality = 'good' THEN NEW.liters
          ELSE liters_remaining
        END,
        record_date = NEW.record_date,
        updated_at = now()
    WHERE milking_record_id = NEW.id;
    RETURN NEW;
  END IF;

  -- If is_sold changed to true, mark inventory unavailable
  IF NEW.is_sold = true AND (OLD.is_sold = false OR OLD.is_sold IS NULL) THEN
    UPDATE public.milk_inventory
    SET is_available = false, 
        liters_remaining = 0,
        updated_at = now()
    WHERE milking_record_id = NEW.id;
  END IF;
  
  -- If liters changed, update inventory
  IF NEW.liters != OLD.liters THEN
    UPDATE public.milk_inventory
    SET liters_original = NEW.liters,
        liters_remaining = GREATEST(0, liters_remaining + (NEW.liters - OLD.liters)),
        updated_at = now()
    WHERE milking_record_id = NEW.id;
  END IF;

  -- If record_date changed (without quality change), sync it
  IF NEW.record_date != OLD.record_date AND NEW.milk_quality IS NOT DISTINCT FROM OLD.milk_quality THEN
    UPDATE public.milk_inventory
    SET record_date = NEW.record_date,
        updated_at = now()
    WHERE milking_record_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;