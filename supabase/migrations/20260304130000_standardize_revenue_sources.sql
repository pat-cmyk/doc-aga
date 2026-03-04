-- Standardize revenue source names to match SSOT constants in src/lib/revenueCategories.ts
-- Fixes: "Milk Sales" (plural) → "Milk Sale" (singular) and other legacy names

-- Step 1: Drop the old CHECK constraint on the source column
-- The original constraint name is auto-generated — drop all constraints on the source column
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.farm_revenues'::regclass
      AND att.attname = 'source'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.farm_revenues DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  END LOOP;
END $$;

-- Step 2: Update existing records with legacy source names
UPDATE public.farm_revenues SET source = 'Milk Sale' WHERE source = 'Milk Sales';
UPDATE public.farm_revenues SET source = 'Animal Sale' WHERE source = 'Livestock Sales';
UPDATE public.farm_revenues SET source = 'Other Income' WHERE source IN ('Byproduct', 'Other');

-- Step 3: Add updated CHECK constraint matching REVENUE_SOURCES in revenueCategories.ts
ALTER TABLE public.farm_revenues
ADD CONSTRAINT farm_revenues_source_check
CHECK (source IN ('Milk Sale', 'Animal Sale', 'Government Subsidy', 'Breeding Service', 'Manure Sale', 'Other Income'));

-- Step 4: Update fix_missing_milk_revenues RPC to use standardized source name
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
    VALUES (p_farm_id, v_user_id, milk_record.sale_amount, 'Milk Sale', milk_record.record_date, milk_record.id, 'Auto-fixed by admin');
    fixed_count := fixed_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'fixed_count', fixed_count);
END;
$$;

-- Step 5: Update sync_milk_sale_to_revenue trigger function to use standardized source name
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
        'Milk Sale',
        COALESCE(NEW.record_date, CURRENT_DATE),
        NEW.id,
        'Auto-synced from milk sale'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
