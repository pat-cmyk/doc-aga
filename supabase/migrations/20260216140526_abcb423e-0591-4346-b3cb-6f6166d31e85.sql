
-- ============================================================
-- Milk-to-Calf Feeding + Rejected Milk Inventory
-- ============================================================

-- A. Add milk_quality columns to milk_inventory
ALTER TABLE public.milk_inventory ADD COLUMN milk_quality TEXT NOT NULL DEFAULT 'good';
ALTER TABLE public.milk_inventory ADD COLUMN milk_quality_rejection_reason TEXT;

-- B. Add milk_inventory_id column to feeding_records
ALTER TABLE public.feeding_records ADD COLUMN milk_inventory_id UUID REFERENCES public.milk_inventory(id);

-- C. Backfill existing rejected inventory rows from milking_records
-- Set milk_quality = 'rejected' on inventory rows whose milking_record has rejected quality
UPDATE public.milk_inventory mi
SET milk_quality = 'rejected'
FROM public.milking_records mr
WHERE mi.milking_record_id = mr.id
  AND mr.milk_quality = 'rejected';

-- D. Update trigger: sync_milk_inventory_on_insert()
-- Rejected milk now stays available and trackable instead of being zeroed out
CREATE OR REPLACE FUNCTION sync_milk_inventory_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.milk_inventory (
    farm_id, animal_id, milking_record_id, record_date,
    liters_original, liters_remaining, is_available, client_generated_id,
    milk_quality, milk_quality_rejection_reason
  )
  SELECT 
    a.farm_id,
    NEW.animal_id,
    NEW.id,
    NEW.record_date,
    NEW.liters,
    NEW.liters,
    NOT COALESCE(NEW.is_sold, false),
    NEW.client_generated_id,
    COALESCE(NEW.milk_quality, 'good'),
    NEW.milk_quality_rejection_reason
  FROM animals a WHERE a.id = NEW.animal_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- E. Update trigger: sync_milk_inventory_on_update()
-- Quality changes update milk_quality instead of zeroing inventory
CREATE OR REPLACE FUNCTION sync_milk_inventory_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If milk_quality changed, update inventory quality (keep available for feeding)
  IF NEW.milk_quality IS DISTINCT FROM OLD.milk_quality THEN
    UPDATE public.milk_inventory
    SET milk_quality = COALESCE(NEW.milk_quality, 'good'),
        milk_quality_rejection_reason = NEW.milk_quality_rejection_reason,
        is_available = CASE 
          WHEN COALESCE(NEW.is_sold, false) THEN false 
          ELSE true 
        END,
        liters_remaining = CASE
          WHEN OLD.milk_quality = 'rejected' AND NEW.milk_quality = 'good' THEN NEW.liters
          ELSE liters_remaining
        END,
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- F. Restore previously zeroed-out rejected milk inventory rows so they become feedable
UPDATE public.milk_inventory mi
SET is_available = true,
    liters_remaining = mi.liters_original
FROM public.milking_records mr
WHERE mi.milking_record_id = mr.id
  AND mr.milk_quality = 'rejected'
  AND mi.milk_quality = 'rejected'
  AND mi.is_available = false
  AND mi.liters_remaining = 0
  AND mr.is_sold = false;
