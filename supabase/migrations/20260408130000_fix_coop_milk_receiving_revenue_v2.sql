-- ============================================================================
-- Fix v2: Coop milk receiving revenue handling
--
-- Problem: When record_coop_milk_receiving sets is_sold=true on each
-- milking_record, the sync_milk_sale_to_revenue trigger fires per-record,
-- creating hundreds of individual farm_revenues entries instead of one
-- consolidated "Cooperative Hub delivery" entry.
--
-- Also: revenue amount was based on _total_deducted (what was in inventory)
-- instead of _volume_liters (what was physically delivered to the hub).
--
-- Fix: Disable the trigger during the RPC execution, create one consolidated
-- revenue entry for the full delivery volume × price.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_coop_milk_receiving(
  _cooperative_id UUID,
  _farm_id UUID,
  _receiving_date DATE,
  _session TEXT,
  _volume_liters NUMERIC,
  _species TEXT,
  _milk_quality TEXT DEFAULT 'good',
  _price_per_liter NUMERIC DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id UUID;
  _price NUMERIC;
  _remaining NUMERIC;
  _inv RECORD;
  _deduct_amount NUMERIC;
  _deductions JSONB := '[]'::JSONB;
  _total_deducted NUMERIC := 0;
  _new_remaining NUMERIC;
  _is_fully_consumed BOOLEAN;
  _farm_owner_id UUID;
BEGIN
  -- Auth check
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RAISE EXCEPTION 'error:not_authorized';
  END IF;

  -- Verify farm is an accepted member
  IF NOT EXISTS (
    SELECT 1 FROM public.cooperative_memberships
    WHERE cooperative_id = _cooperative_id
      AND farm_id = _farm_id
      AND invitation_status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'error:farm_not_member';
  END IF;

  -- Resolve price: use provided price or fetch from schedule
  IF _price_per_liter IS NOT NULL THEN
    _price := _price_per_liter;
  ELSE
    _price := public.get_active_coop_price(_cooperative_id, _species);
    IF _price IS NULL THEN
      RAISE EXCEPTION 'error:no_price_set';
    END IF;
  END IF;

  -- Get farm owner for revenue entry
  SELECT owner_id INTO _farm_owner_id FROM public.farms WHERE id = _farm_id;

  -- Disable the sync_milk_sale_to_revenue trigger to prevent per-record revenue entries.
  -- We create ONE consolidated revenue entry at the end instead.
  ALTER TABLE public.milking_records DISABLE TRIGGER trigger_sync_milk_sale_to_revenue;

  -- FIFO deduction from farm's milk_inventory (best-effort)
  _remaining := _volume_liters;

  FOR _inv IN
    SELECT mi.id, mi.liters_remaining, mi.milking_record_id, mi.liters_original
    FROM public.milk_inventory mi
    WHERE mi.farm_id = _farm_id
      AND mi.is_available = true
      AND mi.milk_quality = 'good'
      AND mi.liters_remaining >= 0.05
    ORDER BY mi.record_date ASC
  LOOP
    EXIT WHEN _remaining <= 0;

    _deduct_amount := LEAST(_remaining, _inv.liters_remaining);
    _new_remaining := _inv.liters_remaining - _deduct_amount;
    _is_fully_consumed := _new_remaining < 0.05;

    -- Update milk_inventory
    UPDATE public.milk_inventory
    SET liters_remaining = GREATEST(0, _new_remaining),
        is_available = NOT _is_fully_consumed,
        updated_at = now()
    WHERE id = _inv.id;

    -- Update milking_records (trigger is disabled, no side-effects)
    IF _inv.milking_record_id IS NOT NULL THEN
      IF _is_fully_consumed THEN
        UPDATE public.milking_records
        SET price_per_liter = _price,
            is_sold = true,
            sale_amount = _inv.liters_original * _price
        WHERE id = _inv.milking_record_id;
      ELSE
        UPDATE public.milking_records
        SET price_per_liter = _price
        WHERE id = _inv.milking_record_id;
      END IF;
    END IF;

    _deductions := _deductions || jsonb_build_array(
      jsonb_build_object(
        'milk_inventory_id', _inv.id,
        'milking_record_id', _inv.milking_record_id,
        'liters_deducted', _deduct_amount
      )
    );

    _total_deducted := _total_deducted + _deduct_amount;
    _remaining := _remaining - _deduct_amount;
  END LOOP;

  -- Re-enable the trigger
  ALTER TABLE public.milking_records ENABLE TRIGGER trigger_sync_milk_sale_to_revenue;

  -- Create ONE consolidated farm_revenues entry for the FULL delivery volume.
  -- The coop physically received _volume_liters regardless of farm inventory state.
  IF _milk_quality = 'good' THEN
    INSERT INTO public.farm_revenues (
      farm_id, user_id, amount, source, transaction_date, notes, is_deleted
    ) VALUES (
      _farm_id,
      COALESCE(_farm_owner_id, auth.uid()),
      _volume_liters * _price,
      'Milk Sale',
      _receiving_date,
      'Cooperative Hub delivery: ' || _volume_liters || 'L @ ₱' || _price || '/L',
      false
    );
  END IF;

  -- Insert the receiving record
  INSERT INTO public.coop_milk_receivings (
    cooperative_id, farm_id, receiving_date, session, volume_liters,
    species, milk_quality, price_per_liter, received_by, notes,
    farm_milk_deductions, status, entry_type
  ) VALUES (
    _cooperative_id, _farm_id, _receiving_date, _session, _volume_liters,
    _species, _milk_quality, _price, auth.uid(), _notes,
    CASE WHEN _deductions != '[]'::JSONB THEN _deductions ELSE NULL END,
    'active', 'original'
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;


-- ============================================================================
-- Also fix correct_coop_milk_receiving to handle trigger suppression
-- ============================================================================

CREATE OR REPLACE FUNCTION public.correct_coop_milk_receiving(
  _original_id UUID,
  _new_volume_liters NUMERIC,
  _new_price_per_liter NUMERIC DEFAULT NULL,
  _reason TEXT DEFAULT 'Correction'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orig RECORD;
  _reversal_id UUID;
  _correction_id UUID;
  _price NUMERIC;
  _deduction RECORD;
  _remaining NUMERIC;
  _inv RECORD;
  _deduct_amount NUMERIC;
  _new_deductions JSONB := '[]'::JSONB;
  _total_deducted NUMERIC := 0;
  _new_remaining NUMERIC;
  _is_fully_consumed BOOLEAN;
  _farm_owner_id UUID;
BEGIN
  -- Get the original record
  SELECT * INTO _orig
  FROM public.coop_milk_receivings
  WHERE id = _original_id;

  IF _orig IS NULL THEN
    RAISE EXCEPTION 'error:receiving_not_found';
  END IF;

  IF NOT public.is_cooperative_admin(auth.uid(), _orig.cooperative_id) THEN
    RAISE EXCEPTION 'error:not_authorized';
  END IF;

  IF _orig.status = 'reversed' THEN
    RAISE EXCEPTION 'error:already_reversed';
  END IF;

  -- Get farm owner
  SELECT owner_id INTO _farm_owner_id FROM public.farms WHERE id = _orig.farm_id;

  -- Disable trigger during reversal + correction
  ALTER TABLE public.milking_records DISABLE TRIGGER trigger_sync_milk_sale_to_revenue;

  -- Mark original as reversed
  UPDATE public.coop_milk_receivings
  SET status = 'reversed'
  WHERE id = _original_id;

  -- Reverse farm milk_inventory deductions AND milking_records
  IF _orig.farm_milk_deductions IS NOT NULL THEN
    FOR _deduction IN
      SELECT * FROM jsonb_to_recordset(_orig.farm_milk_deductions)
        AS x(milk_inventory_id UUID, milking_record_id UUID, liters_deducted NUMERIC)
    LOOP
      UPDATE public.milk_inventory
      SET liters_remaining = liters_remaining + _deduction.liters_deducted,
          is_available = true,
          updated_at = now()
      WHERE id = _deduction.milk_inventory_id;

      IF _deduction.milking_record_id IS NOT NULL THEN
        UPDATE public.milking_records
        SET is_sold = false,
            sale_amount = NULL
        WHERE id = _deduction.milking_record_id;
      END IF;
    END LOOP;
  END IF;

  -- Soft-delete the consolidated revenue entry for this delivery
  UPDATE public.farm_revenues
  SET is_deleted = true, updated_at = now()
  WHERE farm_id = _orig.farm_id
    AND notes LIKE 'Cooperative Hub delivery:%'
    AND transaction_date = _orig.receiving_date
    AND is_deleted = false;

  -- Create reversal entry
  INSERT INTO public.coop_milk_receivings (
    cooperative_id, farm_id, receiving_date, session, volume_liters,
    species, milk_quality, price_per_liter, received_by, notes,
    status, entry_type, original_receiving_id, reversal_reason
  ) VALUES (
    _orig.cooperative_id, _orig.farm_id, _orig.receiving_date, _orig.session,
    _orig.volume_liters, _orig.species, _orig.milk_quality, _orig.price_per_liter,
    auth.uid(), _orig.notes,
    'reversed', 'reversal', _original_id, _reason
  )
  RETURNING id INTO _reversal_id;

  -- Resolve price for correction
  _price := COALESCE(_new_price_per_liter, _orig.price_per_liter);

  -- FIFO deduction for the corrected volume
  _remaining := _new_volume_liters;

  FOR _inv IN
    SELECT mi.id, mi.liters_remaining, mi.milking_record_id, mi.liters_original
    FROM public.milk_inventory mi
    WHERE mi.farm_id = _orig.farm_id
      AND mi.is_available = true
      AND mi.milk_quality = 'good'
      AND mi.liters_remaining >= 0.05
    ORDER BY mi.record_date ASC
  LOOP
    EXIT WHEN _remaining <= 0;

    _deduct_amount := LEAST(_remaining, _inv.liters_remaining);
    _new_remaining := _inv.liters_remaining - _deduct_amount;
    _is_fully_consumed := _new_remaining < 0.05;

    UPDATE public.milk_inventory
    SET liters_remaining = GREATEST(0, _new_remaining),
        is_available = NOT _is_fully_consumed,
        updated_at = now()
    WHERE id = _inv.id;

    IF _inv.milking_record_id IS NOT NULL THEN
      IF _is_fully_consumed THEN
        UPDATE public.milking_records
        SET price_per_liter = _price,
            is_sold = true,
            sale_amount = _inv.liters_original * _price
        WHERE id = _inv.milking_record_id;
      ELSE
        UPDATE public.milking_records
        SET price_per_liter = _price
        WHERE id = _inv.milking_record_id;
      END IF;
    END IF;

    _new_deductions := _new_deductions || jsonb_build_array(
      jsonb_build_object(
        'milk_inventory_id', _inv.id,
        'milking_record_id', _inv.milking_record_id,
        'liters_deducted', _deduct_amount
      )
    );

    _total_deducted := _total_deducted + _deduct_amount;
    _remaining := _remaining - _deduct_amount;
  END LOOP;

  -- Re-enable trigger
  ALTER TABLE public.milking_records ENABLE TRIGGER trigger_sync_milk_sale_to_revenue;

  -- Create ONE consolidated revenue for the correction
  IF _orig.milk_quality = 'good' THEN
    INSERT INTO public.farm_revenues (
      farm_id, user_id, amount, source, transaction_date, notes, is_deleted
    ) VALUES (
      _orig.farm_id,
      COALESCE(_farm_owner_id, auth.uid()),
      _new_volume_liters * _price,
      'Milk Sale',
      _orig.receiving_date,
      'Cooperative Hub delivery (corrected): ' || _new_volume_liters || 'L @ ₱' || _price || '/L',
      false
    );
  END IF;

  -- Create correction entry
  INSERT INTO public.coop_milk_receivings (
    cooperative_id, farm_id, receiving_date, session, volume_liters,
    species, milk_quality, price_per_liter, received_by, notes,
    farm_milk_deductions, status, entry_type, original_receiving_id, reversal_reason
  ) VALUES (
    _orig.cooperative_id, _orig.farm_id, _orig.receiving_date, _orig.session,
    _new_volume_liters, _orig.species, _orig.milk_quality, _price,
    auth.uid(), _orig.notes,
    CASE WHEN _new_deductions != '[]'::JSONB THEN _new_deductions ELSE NULL END,
    'active', 'correction', _original_id, _reason
  )
  RETURNING id INTO _correction_id;

  RETURN _correction_id;
END;
$$;
