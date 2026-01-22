-- Phase 1: Milk Sales Revenue Sync Trigger
-- Automatically creates farm_revenues entry when milk is marked as sold

CREATE OR REPLACE FUNCTION public.sync_milk_sale_to_revenue()
RETURNS TRIGGER AS $$
DECLARE
  v_farm_id uuid;
  v_user_id uuid;
BEGIN
  -- Only trigger when is_sold changes to true
  IF NEW.is_sold = true AND (OLD.is_sold IS NULL OR OLD.is_sold = false) THEN
    -- Get farm_id from the animal
    SELECT farm_id INTO v_farm_id FROM animals WHERE id = NEW.animal_id;
    
    -- Get user_id (prefer created_by, fallback to animal's farm owner)
    v_user_id := COALESCE(NEW.created_by, (SELECT owner_id FROM farms WHERE id = v_farm_id));
    
    -- Only insert if there's no existing revenue entry for this milking record
    IF NOT EXISTS (
      SELECT 1 FROM farm_revenues 
      WHERE linked_milk_log_id = NEW.id
    ) THEN
      INSERT INTO farm_revenues (
        farm_id, 
        user_id, 
        amount, 
        source, 
        transaction_date, 
        linked_milk_log_id,
        notes
      ) VALUES (
        v_farm_id,
        v_user_id,
        COALESCE(NEW.sale_amount, 0),
        'Milk Sales',
        COALESCE(NEW.record_date, CURRENT_DATE),
        NEW.id,
        'Auto-synced from milk sale'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on milking_records
DROP TRIGGER IF EXISTS trigger_sync_milk_sale_to_revenue ON milking_records;
CREATE TRIGGER trigger_sync_milk_sale_to_revenue
  AFTER UPDATE OF is_sold ON milking_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_milk_sale_to_revenue();

-- Also trigger on INSERT for new records that are immediately marked as sold
DROP TRIGGER IF EXISTS trigger_sync_milk_sale_to_revenue_insert ON milking_records;
CREATE TRIGGER trigger_sync_milk_sale_to_revenue_insert
  AFTER INSERT ON milking_records
  FOR EACH ROW
  WHEN (NEW.is_sold = true)
  EXECUTE FUNCTION sync_milk_sale_to_revenue();

-- Phase 1b: Backfill orphaned milk sales
-- Find all milking_records where is_sold=true but no matching farm_revenues exists
INSERT INTO farm_revenues (farm_id, user_id, amount, source, transaction_date, linked_milk_log_id, notes)
SELECT DISTINCT ON (mr.id)
  a.farm_id,
  COALESCE(mr.created_by, f.owner_id),
  COALESCE(mr.sale_amount, 0),
  'Milk Sales',
  COALESCE(mr.record_date, mr.created_at::date),
  mr.id,
  'Backfilled from historical milk sale'
FROM milking_records mr
JOIN animals a ON a.id = mr.animal_id
JOIN farms f ON f.id = a.farm_id
LEFT JOIN farm_revenues fr ON fr.linked_milk_log_id = mr.id
WHERE mr.is_sold = true 
  AND mr.sale_amount IS NOT NULL 
  AND mr.sale_amount > 0
  AND fr.id IS NULL;

-- Phase 2: Weight Sync Trigger
-- Automatically updates animals.current_weight_kg when new weight_records are added

CREATE OR REPLACE FUNCTION public.sync_weight_to_animal()
RETURNS TRIGGER AS $$
BEGIN
  -- Update animals.current_weight_kg if this is the latest weight measurement
  UPDATE animals 
  SET 
    current_weight_kg = NEW.weight_kg,
    updated_at = NOW()
  WHERE id = NEW.animal_id
  AND NOT EXISTS (
    SELECT 1 FROM weight_records 
    WHERE animal_id = NEW.animal_id 
    AND measurement_date > NEW.measurement_date
    AND id != NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on weight_records
DROP TRIGGER IF EXISTS trigger_sync_weight_to_animal ON weight_records;
CREATE TRIGGER trigger_sync_weight_to_animal
  AFTER INSERT ON weight_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_weight_to_animal();

-- Also handle updates to weight_records
DROP TRIGGER IF EXISTS trigger_sync_weight_to_animal_update ON weight_records;
CREATE TRIGGER trigger_sync_weight_to_animal_update
  AFTER UPDATE OF weight_kg, measurement_date ON weight_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_weight_to_animal();

-- Phase 2b: Backfill current_weight_kg from weight_records
-- Update animals that have weight_records but no current_weight_kg set
UPDATE animals a
SET current_weight_kg = latest_weight.weight_kg,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (animal_id) 
    animal_id, 
    weight_kg
  FROM weight_records
  ORDER BY animal_id, measurement_date DESC
) latest_weight
WHERE a.id = latest_weight.animal_id
AND (a.current_weight_kg IS NULL OR a.current_weight_kg != latest_weight.weight_kg);

-- Phase 3: Create consistency check function for stats validation
CREATE OR REPLACE FUNCTION public.check_data_consistency(p_farm_id uuid, p_date date DEFAULT CURRENT_DATE - 1)
RETURNS TABLE (
  check_name text,
  expected_value numeric,
  actual_value numeric,
  is_consistent boolean
) AS $$
BEGIN
  -- Check 1: Milk production consistency
  RETURN QUERY
  SELECT 
    'milk_production'::text,
    COALESCE((
      SELECT SUM(liters) 
      FROM milking_records mr
      JOIN animals a ON a.id = mr.animal_id
      WHERE a.farm_id = p_farm_id 
      AND mr.record_date = p_date
    ), 0)::numeric as expected,
    COALESCE((
      SELECT total_milk_liters 
      FROM daily_farm_stats 
      WHERE farm_id = p_farm_id 
      AND stat_date = p_date
    ), 0)::numeric as actual,
    COALESCE((
      SELECT SUM(liters) 
      FROM milking_records mr
      JOIN animals a ON a.id = mr.animal_id
      WHERE a.farm_id = p_farm_id 
      AND mr.record_date = p_date
    ), 0) = COALESCE((
      SELECT total_milk_liters 
      FROM daily_farm_stats 
      WHERE farm_id = p_farm_id 
      AND stat_date = p_date
    ), 0) as is_match;

  -- Check 2: Milk sales revenue sync
  RETURN QUERY
  SELECT 
    'milk_sales_synced'::text,
    (SELECT COUNT(*) FROM milking_records mr
     JOIN animals a ON a.id = mr.animal_id
     WHERE a.farm_id = p_farm_id 
     AND mr.is_sold = true)::numeric as expected,
    (SELECT COUNT(*) FROM farm_revenues 
     WHERE farm_id = p_farm_id 
     AND linked_milk_log_id IS NOT NULL)::numeric as actual,
    (SELECT COUNT(*) FROM milking_records mr
     JOIN animals a ON a.id = mr.animal_id
     WHERE a.farm_id = p_farm_id 
     AND mr.is_sold = true) = 
    (SELECT COUNT(*) FROM farm_revenues 
     WHERE farm_id = p_farm_id 
     AND linked_milk_log_id IS NOT NULL) as is_match;

  -- Check 3: Weight sync consistency
  RETURN QUERY
  SELECT 
    'weight_synced'::text,
    (SELECT COUNT(*) FROM animals 
     WHERE farm_id = p_farm_id 
     AND is_deleted = false
     AND id IN (SELECT animal_id FROM weight_records))::numeric as expected,
    (SELECT COUNT(*) FROM animals a
     WHERE a.farm_id = p_farm_id 
     AND a.is_deleted = false
     AND a.current_weight_kg IS NOT NULL
     AND EXISTS (SELECT 1 FROM weight_records wr WHERE wr.animal_id = a.id))::numeric as actual,
    (SELECT COUNT(*) FROM animals 
     WHERE farm_id = p_farm_id 
     AND is_deleted = false
     AND id IN (SELECT animal_id FROM weight_records)) = 
    (SELECT COUNT(*) FROM animals a
     WHERE a.farm_id = p_farm_id 
     AND a.is_deleted = false
     AND a.current_weight_kg IS NOT NULL
     AND EXISTS (SELECT 1 FROM weight_records wr WHERE wr.animal_id = a.id)) as is_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;