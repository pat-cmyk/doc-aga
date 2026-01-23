-- RPC function to fix animal weights by syncing from latest weight_records
CREATE OR REPLACE FUNCTION fix_animal_weights(p_farm_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count INT := 0;
  animal_record RECORD;
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can fix animal weights';
  END IF;

  FOR animal_record IN 
    SELECT a.id, a.current_weight_kg, 
           (SELECT wr.weight_kg FROM weight_records wr
            WHERE wr.animal_id = a.id 
            ORDER BY wr.measurement_date DESC LIMIT 1) as latest_weight
    FROM animals a
    WHERE a.farm_id = p_farm_id 
      AND a.is_deleted = false
  LOOP
    IF animal_record.latest_weight IS NOT NULL 
       AND animal_record.latest_weight != COALESCE(animal_record.current_weight_kg, 0) THEN
      UPDATE animals SET current_weight_kg = animal_record.latest_weight, updated_at = now() WHERE id = animal_record.id;
      fixed_count := fixed_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object('success', true, 'fixed_count', fixed_count);
END;
$$;

-- RPC function to fix missing milk revenue entries
CREATE OR REPLACE FUNCTION fix_missing_milk_revenues(p_farm_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count INT := 0;
  milk_record RECORD;
  v_user_id UUID;
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can fix milk revenues';
  END IF;

  -- Get farm owner for user_id
  SELECT owner_id INTO v_user_id FROM farms WHERE id = p_farm_id;

  FOR milk_record IN 
    SELECT mr.id, mr.record_date, mr.sale_amount, a.farm_id
    FROM milking_records mr
    JOIN animals a ON a.id = mr.animal_id
    WHERE a.farm_id = p_farm_id
      AND mr.is_sold = true
      AND mr.sale_amount IS NOT NULL
      AND mr.sale_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM farm_revenues fr 
        WHERE fr.linked_milk_log_id = mr.id
      )
  LOOP
    INSERT INTO farm_revenues (farm_id, user_id, amount, source, transaction_date, linked_milk_log_id, notes)
    VALUES (p_farm_id, v_user_id, milk_record.sale_amount, 'Milk Sales', milk_record.record_date, milk_record.id, 'Auto-fixed by admin');
    fixed_count := fixed_count + 1;
  END LOOP;
  
  RETURN json_build_object('success', true, 'fixed_count', fixed_count);
END;
$$;

-- RPC function to fix valuation calculations
CREATE OR REPLACE FUNCTION fix_valuation_calculations(p_farm_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fixed_count INT := 0;
  val_record RECORD;
  expected_value NUMERIC;
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can fix valuations';
  END IF;

  FOR val_record IN 
    SELECT v.id, v.weight_kg, v.market_price_per_kg, v.estimated_value
    FROM animal_valuations v
    JOIN animals a ON a.id = v.animal_id
    WHERE a.farm_id = p_farm_id
      AND v.weight_kg IS NOT NULL
      AND v.market_price_per_kg IS NOT NULL
  LOOP
    expected_value := val_record.weight_kg * val_record.market_price_per_kg;
    IF ABS(COALESCE(val_record.estimated_value, 0) - expected_value) > 1 THEN
      UPDATE animal_valuations SET estimated_value = expected_value, updated_at = now() WHERE id = val_record.id;
      fixed_count := fixed_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object('success', true, 'fixed_count', fixed_count);
END;
$$;

-- RPC function to get all farms with owner info for admin integrity checks
CREATE OR REPLACE FUNCTION get_all_farms_for_integrity_check()
RETURNS TABLE(
  farm_id UUID,
  farm_name TEXT,
  owner_id UUID,
  owner_email TEXT,
  owner_name TEXT,
  animal_count BIGINT,
  last_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can access this function';
  END IF;

  RETURN QUERY
  SELECT 
    f.id as farm_id,
    f.name as farm_name,
    f.owner_id,
    p.email as owner_email,
    p.full_name as owner_name,
    (SELECT COUNT(*) FROM animals a WHERE a.farm_id = f.id AND a.is_deleted = false) as animal_count,
    f.updated_at as last_activity
  FROM farms f
  LEFT JOIN profiles p ON p.id = f.owner_id
  WHERE f.is_deleted = false
  ORDER BY f.name;
END;
$$;

-- Create integrity fix log table for audit
CREATE TABLE IF NOT EXISTS integrity_fix_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  fix_type TEXT NOT NULL,
  items_fixed INT DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE integrity_fix_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can view/insert
CREATE POLICY "Super admins can view integrity fix logs"
  ON integrity_fix_log FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert integrity fix logs"
  ON integrity_fix_log FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));