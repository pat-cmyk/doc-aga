-- ============================================================================
-- CAIN Cooperative Hub Operations
-- Extends the cooperative module from read-only dashboard into a full
-- operational platform for the Milk-In, Feed-Out system.
--
-- New tables:
--   1. coop_milk_price_schedule  — Standing milk price list by species
--   2. coop_milk_receivings      — Milk delivered to hub by member farms
--   3. coop_feed_inventory       — Hub's own feed stock
--   4. coop_feed_disbursements   — Feed released to member farms
--   5. coop_soa_periods          — Bi-monthly Statement of Account
--
-- All operational records are IMMUTABLE (reversal + correction pairs).
-- ============================================================================

-- ============================================================================
-- TABLE 1: coop_milk_price_schedule (append-only)
-- ============================================================================

CREATE TABLE public.coop_milk_price_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  species TEXT NOT NULL,
  price_per_liter NUMERIC NOT NULL CHECK (price_per_liter >= 0),
  effective_date DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cooperative_id, species, effective_date)
);

ALTER TABLE public.coop_milk_price_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cooperative admin can manage price schedule"
  ON public.coop_milk_price_schedule FOR ALL
  USING (public.is_cooperative_admin(auth.uid(), cooperative_id));

CREATE INDEX idx_coop_milk_price_schedule_lookup
  ON public.coop_milk_price_schedule (cooperative_id, species, effective_date DESC);

-- ============================================================================
-- TABLE 2: coop_milk_receivings (immutable — reversal/correction pairs)
-- ============================================================================

CREATE TABLE public.coop_milk_receivings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  receiving_date DATE NOT NULL,
  session TEXT NOT NULL CHECK (session IN ('AM', 'PM', 'Full Day')),
  volume_liters NUMERIC NOT NULL CHECK (volume_liters > 0),
  species TEXT NOT NULL,
  milk_quality TEXT NOT NULL DEFAULT 'good' CHECK (milk_quality IN ('good', 'rejected')),
  price_per_liter NUMERIC NOT NULL CHECK (price_per_liter >= 0),
  total_value NUMERIC GENERATED ALWAYS AS (volume_liters * price_per_liter) STORED,
  received_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  farm_milk_deductions JSONB,
  -- Immutability columns
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reversed')),
  entry_type TEXT NOT NULL DEFAULT 'original' CHECK (entry_type IN ('original', 'reversal', 'correction')),
  original_receiving_id UUID REFERENCES public.coop_milk_receivings(id),
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coop_milk_receivings ENABLE ROW LEVEL SECURITY;

-- Coop admin: full SELECT, INSERT via RPC, UPDATE only status column
CREATE POLICY "Cooperative admin can view milk receivings"
  ON public.coop_milk_receivings FOR SELECT
  USING (public.is_cooperative_admin(auth.uid(), cooperative_id));

CREATE POLICY "Cooperative admin can insert milk receivings"
  ON public.coop_milk_receivings FOR INSERT
  WITH CHECK (public.is_cooperative_admin(auth.uid(), cooperative_id));

CREATE POLICY "Cooperative admin can update milk receiving status"
  ON public.coop_milk_receivings FOR UPDATE
  USING (public.is_cooperative_admin(auth.uid(), cooperative_id));

-- Farm owners can view their own receivings
CREATE POLICY "Farm owners can view own milk receivings"
  ON public.coop_milk_receivings FOR SELECT
  USING (public.is_farm_owner(auth.uid(), farm_id));

CREATE INDEX idx_coop_milk_receivings_coop_date
  ON public.coop_milk_receivings (cooperative_id, receiving_date DESC);
CREATE INDEX idx_coop_milk_receivings_farm
  ON public.coop_milk_receivings (farm_id, receiving_date DESC);
CREATE INDEX idx_coop_milk_receivings_active
  ON public.coop_milk_receivings (cooperative_id, farm_id)
  WHERE status = 'active';

-- ============================================================================
-- TABLE 3: coop_feed_inventory (hub's own feed stock)
-- ============================================================================

CREATE TABLE public.coop_feed_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'roughage' CHECK (category IN ('concentrates', 'roughage', 'minerals', 'supplements')),
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg >= 0),
  cost_per_kg NUMERIC NOT NULL CHECK (cost_per_kg >= 0),
  purchase_date DATE,
  supplier TEXT,
  batch_number TEXT,
  expiry_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coop_feed_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cooperative admin can manage feed inventory"
  ON public.coop_feed_inventory FOR ALL
  USING (public.is_cooperative_admin(auth.uid(), cooperative_id));

CREATE INDEX idx_coop_feed_inventory_coop
  ON public.coop_feed_inventory (cooperative_id);
CREATE INDEX idx_coop_feed_inventory_category
  ON public.coop_feed_inventory (category);

-- ============================================================================
-- TABLE 4: coop_feed_disbursements (immutable — reversal/correction pairs)
-- ============================================================================

CREATE TABLE public.coop_feed_disbursements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  coop_feed_inventory_id UUID NOT NULL REFERENCES public.coop_feed_inventory(id),
  disbursement_date DATE NOT NULL,
  feed_type TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity_kg NUMERIC NOT NULL CHECK (quantity_kg > 0),
  cost_per_kg NUMERIC NOT NULL CHECK (cost_per_kg >= 0),
  total_cost NUMERIC GENERATED ALWAYS AS (quantity_kg * cost_per_kg) STORED,
  disbursed_by UUID NOT NULL REFERENCES auth.users(id),
  farm_feed_inventory_id UUID REFERENCES public.feed_inventory(id),
  notes TEXT,
  -- Immutability columns
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reversed')),
  entry_type TEXT NOT NULL DEFAULT 'original' CHECK (entry_type IN ('original', 'reversal', 'correction')),
  original_disbursement_id UUID REFERENCES public.coop_feed_disbursements(id),
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coop_feed_disbursements ENABLE ROW LEVEL SECURITY;

-- Coop admin: full SELECT, INSERT via RPC, UPDATE only status column
CREATE POLICY "Cooperative admin can view feed disbursements"
  ON public.coop_feed_disbursements FOR SELECT
  USING (public.is_cooperative_admin(auth.uid(), cooperative_id));

CREATE POLICY "Cooperative admin can insert feed disbursements"
  ON public.coop_feed_disbursements FOR INSERT
  WITH CHECK (public.is_cooperative_admin(auth.uid(), cooperative_id));

CREATE POLICY "Cooperative admin can update feed disbursement status"
  ON public.coop_feed_disbursements FOR UPDATE
  USING (public.is_cooperative_admin(auth.uid(), cooperative_id));

-- Farm owners can view their own disbursements
CREATE POLICY "Farm owners can view own feed disbursements"
  ON public.coop_feed_disbursements FOR SELECT
  USING (public.is_farm_owner(auth.uid(), farm_id));

CREATE INDEX idx_coop_feed_disbursements_coop_date
  ON public.coop_feed_disbursements (cooperative_id, disbursement_date DESC);
CREATE INDEX idx_coop_feed_disbursements_farm
  ON public.coop_feed_disbursements (farm_id, disbursement_date DESC);
CREATE INDEX idx_coop_feed_disbursements_active
  ON public.coop_feed_disbursements (cooperative_id, farm_id)
  WHERE status = 'active';

-- ============================================================================
-- TABLE 5: coop_soa_periods (Statement of Account)
-- ============================================================================

CREATE TABLE public.coop_soa_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_milk_liters NUMERIC NOT NULL DEFAULT 0,
  total_milk_value NUMERIC NOT NULL DEFAULT 0,
  total_feed_kg NUMERIC NOT NULL DEFAULT 0,
  total_feed_cost NUMERIC NOT NULL DEFAULT 0,
  net_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'settled')),
  finalized_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  notes TEXT,
  revision_number INTEGER NOT NULL DEFAULT 1,
  previous_soa_id UUID REFERENCES public.coop_soa_periods(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cooperative_id, farm_id, period_start, revision_number)
);

ALTER TABLE public.coop_soa_periods ENABLE ROW LEVEL SECURITY;

-- Coop admin: full access via RPC
CREATE POLICY "Cooperative admin can manage SOA"
  ON public.coop_soa_periods FOR ALL
  USING (public.is_cooperative_admin(auth.uid(), cooperative_id));

-- Farm owners can view their own SOA
CREATE POLICY "Farm owners can view own SOA"
  ON public.coop_soa_periods FOR SELECT
  USING (public.is_farm_owner(auth.uid(), farm_id));

CREATE INDEX idx_coop_soa_coop_period
  ON public.coop_soa_periods (cooperative_id, period_start DESC);
CREATE INDEX idx_coop_soa_farm
  ON public.coop_soa_periods (farm_id, period_start DESC);
CREATE INDEX idx_coop_soa_status
  ON public.coop_soa_periods (status)
  WHERE status != 'settled';


-- ============================================================================
-- RPC: get_active_coop_price
-- Returns the current effective price for a species
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_active_coop_price(
  _cooperative_id UUID,
  _species TEXT
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT price_per_liter
  FROM public.coop_milk_price_schedule
  WHERE cooperative_id = _cooperative_id
    AND species = _species
    AND effective_date <= CURRENT_DATE
  ORDER BY effective_date DESC
  LIMIT 1
$$;


-- ============================================================================
-- RPC: set_coop_milk_price
-- Sets a new price for a species (append-only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_coop_milk_price(
  _cooperative_id UUID,
  _species TEXT,
  _price_per_liter NUMERIC,
  _effective_date DATE,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id UUID;
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RAISE EXCEPTION 'error:not_authorized';
  END IF;

  INSERT INTO public.coop_milk_price_schedule (
    cooperative_id, species, price_per_liter, effective_date, notes, created_by
  ) VALUES (
    _cooperative_id, _species, _price_per_liter, _effective_date, _notes, auth.uid()
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;


-- ============================================================================
-- RPC: get_coop_price_schedule
-- Returns full price history for a cooperative
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_coop_price_schedule(
  _cooperative_id UUID
)
RETURNS TABLE (
  id UUID,
  species TEXT,
  price_per_liter NUMERIC,
  effective_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ps.id, ps.species, ps.price_per_liter, ps.effective_date,
    ps.notes, ps.created_by, ps.created_at
  FROM public.coop_milk_price_schedule ps
  WHERE ps.cooperative_id = _cooperative_id
  ORDER BY ps.effective_date DESC, ps.species
$$;


-- ============================================================================
-- RPC: record_coop_milk_receiving
-- Records milk delivered by a member farm + FIFO deduction from farm inventory
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

  -- FIFO deduction from farm's milk_inventory (best-effort)
  _remaining := _volume_liters;
  FOR _inv IN
    SELECT mi.id, mi.liters_remaining
    FROM public.milk_inventory mi
    WHERE mi.farm_id = _farm_id
      AND mi.is_available = true
      AND mi.milk_quality = 'good'
      AND mi.liters_remaining >= 0.05
    ORDER BY mi.record_date ASC
  LOOP
    EXIT WHEN _remaining <= 0;

    _deduct_amount := LEAST(_remaining, _inv.liters_remaining);

    UPDATE public.milk_inventory
    SET liters_remaining = liters_remaining - _deduct_amount,
        is_available = CASE WHEN liters_remaining - _deduct_amount < 0.05 THEN false ELSE true END,
        updated_at = now()
    WHERE id = _inv.id;

    _deductions := _deductions || jsonb_build_array(
      jsonb_build_object('milk_inventory_id', _inv.id, 'liters_deducted', _deduct_amount)
    );

    _remaining := _remaining - _deduct_amount;
  END LOOP;

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
-- RPC: get_coop_milk_receivings
-- Returns milk receivings for a cooperative within a date range
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_coop_milk_receivings(
  _cooperative_id UUID,
  _date_from DATE DEFAULT NULL,
  _date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  farm_id UUID,
  farm_name TEXT,
  receiving_date DATE,
  session TEXT,
  volume_liters NUMERIC,
  species TEXT,
  milk_quality TEXT,
  price_per_liter NUMERIC,
  total_value NUMERIC,
  received_by UUID,
  notes TEXT,
  status TEXT,
  entry_type TEXT,
  original_receiving_id UUID,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mr.id, mr.farm_id, f.name AS farm_name,
    mr.receiving_date, mr.session, mr.volume_liters,
    mr.species, mr.milk_quality, mr.price_per_liter, mr.total_value,
    mr.received_by, mr.notes, mr.status, mr.entry_type,
    mr.original_receiving_id, mr.reversal_reason, mr.created_at
  FROM public.coop_milk_receivings mr
  JOIN public.farms f ON f.id = mr.farm_id
  WHERE mr.cooperative_id = _cooperative_id
    AND (_date_from IS NULL OR mr.receiving_date >= _date_from)
    AND (_date_to IS NULL OR mr.receiving_date <= _date_to)
  ORDER BY mr.receiving_date DESC, mr.created_at DESC
$$;


-- ============================================================================
-- RPC: add_coop_feed_stock
-- Adds feed to the hub's inventory
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_coop_feed_stock(
  _cooperative_id UUID,
  _feed_type TEXT,
  _category TEXT,
  _quantity_kg NUMERIC,
  _cost_per_kg NUMERIC,
  _purchase_date DATE DEFAULT NULL,
  _supplier TEXT DEFAULT NULL,
  _batch_number TEXT DEFAULT NULL,
  _expiry_date DATE DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id UUID;
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RAISE EXCEPTION 'error:not_authorized';
  END IF;

  INSERT INTO public.coop_feed_inventory (
    cooperative_id, feed_type, category, quantity_kg, cost_per_kg,
    purchase_date, supplier, batch_number, expiry_date, notes, created_by
  ) VALUES (
    _cooperative_id, _feed_type, _category, _quantity_kg, _cost_per_kg,
    _purchase_date, _supplier, _batch_number, _expiry_date, _notes, auth.uid()
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;


-- ============================================================================
-- RPC: get_coop_feed_inventory
-- Returns the hub's current feed stock
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_coop_feed_inventory(
  _cooperative_id UUID
)
RETURNS TABLE (
  id UUID,
  feed_type TEXT,
  category TEXT,
  quantity_kg NUMERIC,
  cost_per_kg NUMERIC,
  total_value NUMERIC,
  purchase_date DATE,
  supplier TEXT,
  batch_number TEXT,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fi.id, fi.feed_type, fi.category, fi.quantity_kg, fi.cost_per_kg,
    (fi.quantity_kg * fi.cost_per_kg) AS total_value,
    fi.purchase_date, fi.supplier, fi.batch_number, fi.expiry_date,
    fi.notes, fi.created_at, fi.last_updated
  FROM public.coop_feed_inventory fi
  WHERE fi.cooperative_id = _cooperative_id
    AND fi.quantity_kg > 0
  ORDER BY fi.category, fi.feed_type
$$;


-- ============================================================================
-- RPC: record_coop_feed_disbursement
-- Disburses feed to a member farm, deducts from hub, creates farm inventory
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_coop_feed_disbursement(
  _cooperative_id UUID,
  _farm_id UUID,
  _coop_feed_inventory_id UUID,
  _quantity_kg NUMERIC,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _new_id UUID;
  _farm_inv_id UUID;
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

  -- Get the feed inventory item and lock it
  SELECT * INTO _inv
  FROM public.coop_feed_inventory
  WHERE id = _coop_feed_inventory_id
    AND cooperative_id = _cooperative_id
  FOR UPDATE;

  IF _inv IS NULL THEN
    RAISE EXCEPTION 'error:inventory_not_found';
  END IF;

  IF _inv.quantity_kg < _quantity_kg THEN
    RAISE EXCEPTION 'error:insufficient_stock';
  END IF;

  -- Deduct from hub inventory
  UPDATE public.coop_feed_inventory
  SET quantity_kg = quantity_kg - _quantity_kg,
      last_updated = now()
  WHERE id = _coop_feed_inventory_id;

  -- Create feed_inventory entry on the farm side
  INSERT INTO public.feed_inventory (
    farm_id, feed_type, category, quantity_kg, unit, weight_per_unit,
    cost_per_unit, purchase_date, supplier, notes, created_by
  ) VALUES (
    _farm_id, _inv.feed_type, _inv.category, _quantity_kg, 'kg', 1,
    _inv.cost_per_kg, CURRENT_DATE, 'Cooperative Hub', _notes, auth.uid()
  )
  RETURNING id INTO _farm_inv_id;

  -- Insert the disbursement record
  INSERT INTO public.coop_feed_disbursements (
    cooperative_id, farm_id, coop_feed_inventory_id, disbursement_date,
    feed_type, category, quantity_kg, cost_per_kg, disbursed_by,
    farm_feed_inventory_id, notes, status, entry_type
  ) VALUES (
    _cooperative_id, _farm_id, _coop_feed_inventory_id, CURRENT_DATE,
    _inv.feed_type, _inv.category, _quantity_kg, _inv.cost_per_kg,
    auth.uid(), _farm_inv_id, _notes, 'active', 'original'
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;


-- ============================================================================
-- RPC: get_coop_feed_disbursements
-- Returns feed disbursements for a cooperative within a date range
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_coop_feed_disbursements(
  _cooperative_id UUID,
  _date_from DATE DEFAULT NULL,
  _date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  farm_id UUID,
  farm_name TEXT,
  disbursement_date DATE,
  feed_type TEXT,
  category TEXT,
  quantity_kg NUMERIC,
  cost_per_kg NUMERIC,
  total_cost NUMERIC,
  disbursed_by UUID,
  notes TEXT,
  status TEXT,
  entry_type TEXT,
  original_disbursement_id UUID,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fd.id, fd.farm_id, f.name AS farm_name,
    fd.disbursement_date, fd.feed_type, fd.category,
    fd.quantity_kg, fd.cost_per_kg, fd.total_cost,
    fd.disbursed_by, fd.notes, fd.status, fd.entry_type,
    fd.original_disbursement_id, fd.reversal_reason, fd.created_at
  FROM public.coop_feed_disbursements fd
  JOIN public.farms f ON f.id = fd.farm_id
  WHERE fd.cooperative_id = _cooperative_id
    AND (_date_from IS NULL OR fd.disbursement_date >= _date_from)
    AND (_date_to IS NULL OR fd.disbursement_date <= _date_to)
  ORDER BY fd.disbursement_date DESC, fd.created_at DESC
$$;


-- ============================================================================
-- RPC: correct_coop_milk_receiving
-- Creates reversal + correction pair for a milk receiving
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
BEGIN
  -- Get the original record
  SELECT * INTO _orig
  FROM public.coop_milk_receivings
  WHERE id = _original_id;

  IF _orig IS NULL THEN
    RAISE EXCEPTION 'error:receiving_not_found';
  END IF;

  -- Auth check
  IF NOT public.is_cooperative_admin(auth.uid(), _orig.cooperative_id) THEN
    RAISE EXCEPTION 'error:not_authorized';
  END IF;

  -- Cannot reverse an already-reversed record
  IF _orig.status = 'reversed' THEN
    RAISE EXCEPTION 'error:already_reversed';
  END IF;

  -- Mark original as reversed
  UPDATE public.coop_milk_receivings
  SET status = 'reversed'
  WHERE id = _original_id;

  -- Reverse farm milk_inventory deductions (restore liters)
  IF _orig.farm_milk_deductions IS NOT NULL THEN
    FOR _deduction IN
      SELECT * FROM jsonb_to_recordset(_orig.farm_milk_deductions)
        AS x(milk_inventory_id UUID, liters_deducted NUMERIC)
    LOOP
      UPDATE public.milk_inventory
      SET liters_remaining = liters_remaining + _deduction.liters_deducted,
          is_available = true,
          updated_at = now()
      WHERE id = _deduction.milk_inventory_id;
    END LOOP;
  END IF;

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

  -- FIFO deduction for the corrected volume (same logic as record_coop_milk_receiving)
  _remaining := _new_volume_liters;
  FOR _inv IN
    SELECT mi.id, mi.liters_remaining
    FROM public.milk_inventory mi
    WHERE mi.farm_id = _orig.farm_id
      AND mi.is_available = true
      AND mi.milk_quality = 'good'
      AND mi.liters_remaining >= 0.05
    ORDER BY mi.record_date ASC
  LOOP
    EXIT WHEN _remaining <= 0;

    _deduct_amount := LEAST(_remaining, _inv.liters_remaining);

    UPDATE public.milk_inventory
    SET liters_remaining = liters_remaining - _deduct_amount,
        is_available = CASE WHEN liters_remaining - _deduct_amount < 0.05 THEN false ELSE true END,
        updated_at = now()
    WHERE id = _inv.id;

    _new_deductions := _new_deductions || jsonb_build_array(
      jsonb_build_object('milk_inventory_id', _inv.id, 'liters_deducted', _deduct_amount)
    );

    _remaining := _remaining - _deduct_amount;
  END LOOP;

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


-- ============================================================================
-- RPC: correct_coop_feed_disbursement
-- Creates reversal + correction pair for a feed disbursement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.correct_coop_feed_disbursement(
  _original_id UUID,
  _new_quantity_kg NUMERIC,
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
  _new_farm_inv_id UUID;
  _inv RECORD;
BEGIN
  -- Get the original record
  SELECT * INTO _orig
  FROM public.coop_feed_disbursements
  WHERE id = _original_id;

  IF _orig IS NULL THEN
    RAISE EXCEPTION 'error:disbursement_not_found';
  END IF;

  -- Auth check
  IF NOT public.is_cooperative_admin(auth.uid(), _orig.cooperative_id) THEN
    RAISE EXCEPTION 'error:not_authorized';
  END IF;

  -- Cannot reverse an already-reversed record
  IF _orig.status = 'reversed' THEN
    RAISE EXCEPTION 'error:already_reversed';
  END IF;

  -- Get hub inventory item (for re-disbursement)
  SELECT * INTO _inv
  FROM public.coop_feed_inventory
  WHERE id = _orig.coop_feed_inventory_id
  FOR UPDATE;

  -- Mark original as reversed
  UPDATE public.coop_feed_disbursements
  SET status = 'reversed'
  WHERE id = _original_id;

  -- Restore hub inventory (add back original amount)
  UPDATE public.coop_feed_inventory
  SET quantity_kg = quantity_kg + _orig.quantity_kg,
      last_updated = now()
  WHERE id = _orig.coop_feed_inventory_id;

  -- Zero out the farm-side feed_inventory entry
  IF _orig.farm_feed_inventory_id IS NOT NULL THEN
    UPDATE public.feed_inventory
    SET quantity_kg = 0,
        last_updated = now()
    WHERE id = _orig.farm_feed_inventory_id;
  END IF;

  -- Create reversal entry
  INSERT INTO public.coop_feed_disbursements (
    cooperative_id, farm_id, coop_feed_inventory_id, disbursement_date,
    feed_type, category, quantity_kg, cost_per_kg, disbursed_by, notes,
    status, entry_type, original_disbursement_id, reversal_reason
  ) VALUES (
    _orig.cooperative_id, _orig.farm_id, _orig.coop_feed_inventory_id,
    _orig.disbursement_date, _orig.feed_type, _orig.category,
    _orig.quantity_kg, _orig.cost_per_kg, auth.uid(), _orig.notes,
    'reversed', 'reversal', _original_id, _reason
  )
  RETURNING id INTO _reversal_id;

  -- Verify sufficient stock for correction
  IF _inv.quantity_kg + _orig.quantity_kg < _new_quantity_kg THEN
    RAISE EXCEPTION 'error:insufficient_stock';
  END IF;

  -- Deduct corrected amount from hub
  UPDATE public.coop_feed_inventory
  SET quantity_kg = quantity_kg - _new_quantity_kg,
      last_updated = now()
  WHERE id = _orig.coop_feed_inventory_id;

  -- Create new farm-side feed_inventory entry
  INSERT INTO public.feed_inventory (
    farm_id, feed_type, category, quantity_kg, unit, weight_per_unit,
    cost_per_unit, purchase_date, supplier, notes, created_by
  ) VALUES (
    _orig.farm_id, _orig.feed_type, _orig.category, _new_quantity_kg,
    'kg', 1, _orig.cost_per_kg, CURRENT_DATE, 'Cooperative Hub',
    _orig.notes, auth.uid()
  )
  RETURNING id INTO _new_farm_inv_id;

  -- Create correction entry
  INSERT INTO public.coop_feed_disbursements (
    cooperative_id, farm_id, coop_feed_inventory_id, disbursement_date,
    feed_type, category, quantity_kg, cost_per_kg, disbursed_by,
    farm_feed_inventory_id, notes,
    status, entry_type, original_disbursement_id, reversal_reason
  ) VALUES (
    _orig.cooperative_id, _orig.farm_id, _orig.coop_feed_inventory_id,
    _orig.disbursement_date, _orig.feed_type, _orig.category,
    _new_quantity_kg, _orig.cost_per_kg, auth.uid(),
    _new_farm_inv_id, _orig.notes,
    'active', 'correction', _original_id, _reason
  )
  RETURNING id INTO _correction_id;

  RETURN _correction_id;
END;
$$;


-- ============================================================================
-- RPC: compute_coop_soa
-- Computes Statement of Account for a farm within a period
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_coop_soa(
  _cooperative_id UUID,
  _farm_id UUID,
  _period_start DATE,
  _period_end DATE
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _milk_liters NUMERIC;
  _milk_value NUMERIC;
  _feed_kg NUMERIC;
  _feed_cost NUMERIC;
  _milk_lines JSON;
  _feed_lines JSON;
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RAISE EXCEPTION 'error:not_authorized';
  END IF;

  -- Aggregate milk receivings (active only, good quality)
  SELECT
    COALESCE(SUM(volume_liters), 0),
    COALESCE(SUM(total_value), 0)
  INTO _milk_liters, _milk_value
  FROM public.coop_milk_receivings
  WHERE cooperative_id = _cooperative_id
    AND farm_id = _farm_id
    AND status = 'active'
    AND milk_quality = 'good'
    AND receiving_date BETWEEN _period_start AND _period_end;

  -- Aggregate feed disbursements (active only)
  SELECT
    COALESCE(SUM(quantity_kg), 0),
    COALESCE(SUM(total_cost), 0)
  INTO _feed_kg, _feed_cost
  FROM public.coop_feed_disbursements
  WHERE cooperative_id = _cooperative_id
    AND farm_id = _farm_id
    AND status = 'active'
    AND disbursement_date BETWEEN _period_start AND _period_end;

  -- Milk line items
  SELECT COALESCE(json_agg(row_to_json(m)), '[]'::JSON) INTO _milk_lines
  FROM (
    SELECT receiving_date, session, volume_liters, species, price_per_liter, total_value,
           entry_type, original_receiving_id
    FROM public.coop_milk_receivings
    WHERE cooperative_id = _cooperative_id
      AND farm_id = _farm_id
      AND status = 'active'
      AND receiving_date BETWEEN _period_start AND _period_end
    ORDER BY receiving_date, created_at
  ) m;

  -- Feed line items
  SELECT COALESCE(json_agg(row_to_json(f)), '[]'::JSON) INTO _feed_lines
  FROM (
    SELECT disbursement_date, feed_type, category, quantity_kg, cost_per_kg, total_cost,
           entry_type, original_disbursement_id
    FROM public.coop_feed_disbursements
    WHERE cooperative_id = _cooperative_id
      AND farm_id = _farm_id
      AND status = 'active'
      AND disbursement_date BETWEEN _period_start AND _period_end
    ORDER BY disbursement_date, created_at
  ) f;

  RETURN json_build_object(
    'farm_id', _farm_id,
    'period_start', _period_start,
    'period_end', _period_end,
    'total_milk_liters', _milk_liters,
    'total_milk_value', _milk_value,
    'total_feed_kg', _feed_kg,
    'total_feed_cost', _feed_cost,
    'net_balance', _milk_value - _feed_cost,
    'milk_line_items', _milk_lines,
    'feed_line_items', _feed_lines
  );
END;
$$;


-- ============================================================================
-- RPC: finalize_coop_soa
-- Creates or updates an SOA period record and locks it
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finalize_coop_soa(
  _cooperative_id UUID,
  _farm_id UUID,
  _period_start DATE,
  _period_end DATE,
  _notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _soa_data JSON;
  _existing RECORD;
  _new_revision INTEGER;
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN 'error:not_authorized';
  END IF;

  -- Compute current totals
  _soa_data := public.compute_coop_soa(_cooperative_id, _farm_id, _period_start, _period_end);

  -- Check for existing SOA for this period
  SELECT * INTO _existing
  FROM public.coop_soa_periods
  WHERE cooperative_id = _cooperative_id
    AND farm_id = _farm_id
    AND period_start = _period_start
  ORDER BY revision_number DESC
  LIMIT 1;

  IF _existing IS NOT NULL AND _existing.status = 'finalized' THEN
    -- Re-computation: create new revision
    _new_revision := _existing.revision_number + 1;

    INSERT INTO public.coop_soa_periods (
      cooperative_id, farm_id, period_start, period_end,
      total_milk_liters, total_milk_value, total_feed_kg, total_feed_cost,
      net_balance, status, finalized_at, notes,
      revision_number, previous_soa_id, created_by
    ) VALUES (
      _cooperative_id, _farm_id, _period_start, _period_end,
      (_soa_data->>'total_milk_liters')::NUMERIC,
      (_soa_data->>'total_milk_value')::NUMERIC,
      (_soa_data->>'total_feed_kg')::NUMERIC,
      (_soa_data->>'total_feed_cost')::NUMERIC,
      (_soa_data->>'net_balance')::NUMERIC,
      'finalized', now(), _notes,
      _new_revision, _existing.id, auth.uid()
    );
  ELSIF _existing IS NOT NULL AND _existing.status = 'draft' THEN
    -- Update existing draft
    UPDATE public.coop_soa_periods
    SET total_milk_liters = (_soa_data->>'total_milk_liters')::NUMERIC,
        total_milk_value = (_soa_data->>'total_milk_value')::NUMERIC,
        total_feed_kg = (_soa_data->>'total_feed_kg')::NUMERIC,
        total_feed_cost = (_soa_data->>'total_feed_cost')::NUMERIC,
        net_balance = (_soa_data->>'net_balance')::NUMERIC,
        status = 'finalized',
        finalized_at = now(),
        notes = COALESCE(_notes, notes)
    WHERE id = _existing.id;
  ELSE
    -- Create new SOA
    INSERT INTO public.coop_soa_periods (
      cooperative_id, farm_id, period_start, period_end,
      total_milk_liters, total_milk_value, total_feed_kg, total_feed_cost,
      net_balance, status, finalized_at, notes, created_by
    ) VALUES (
      _cooperative_id, _farm_id, _period_start, _period_end,
      (_soa_data->>'total_milk_liters')::NUMERIC,
      (_soa_data->>'total_milk_value')::NUMERIC,
      (_soa_data->>'total_feed_kg')::NUMERIC,
      (_soa_data->>'total_feed_cost')::NUMERIC,
      (_soa_data->>'net_balance')::NUMERIC,
      'finalized', now(), _notes, auth.uid()
    );
  END IF;

  RETURN 'success';
END;
$$;


-- ============================================================================
-- RPC: settle_coop_soa
-- Marks a finalized SOA as settled (payment made)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.settle_coop_soa(
  _cooperative_id UUID,
  _farm_id UUID,
  _period_start DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN 'error:not_authorized';
  END IF;

  UPDATE public.coop_soa_periods
  SET status = 'settled', settled_at = now()
  WHERE cooperative_id = _cooperative_id
    AND farm_id = _farm_id
    AND period_start = _period_start
    AND status = 'finalized'
    AND revision_number = (
      SELECT MAX(revision_number) FROM public.coop_soa_periods
      WHERE cooperative_id = _cooperative_id
        AND farm_id = _farm_id
        AND period_start = _period_start
    );

  IF NOT FOUND THEN
    RETURN 'error:soa_not_found_or_not_finalized';
  END IF;

  RETURN 'success';
END;
$$;


-- ============================================================================
-- FARMER-SIDE RPCs (read-only, verifies farm ownership)
-- ============================================================================

-- Get farmer's coop membership info
CREATE OR REPLACE FUNCTION public.get_my_coop_membership(
  _farm_id UUID
)
RETURNS TABLE (
  cooperative_id UUID,
  cooperative_name TEXT,
  invitation_status TEXT,
  accepted_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS cooperative_id,
    c.name AS cooperative_name,
    cm.invitation_status,
    cm.accepted_at
  FROM public.cooperative_memberships cm
  JOIN public.cooperatives c ON c.id = cm.cooperative_id
  WHERE cm.farm_id = _farm_id
    AND cm.invitation_status = 'accepted'
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = _farm_id AND f.owner_id = auth.uid()
    )
  LIMIT 1
$$;


-- Get farmer's milk deliveries to the coop
CREATE OR REPLACE FUNCTION public.get_my_coop_milk_deliveries(
  _farm_id UUID,
  _date_from DATE DEFAULT NULL,
  _date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  receiving_date DATE,
  session TEXT,
  volume_liters NUMERIC,
  species TEXT,
  milk_quality TEXT,
  price_per_liter NUMERIC,
  total_value NUMERIC,
  status TEXT,
  entry_type TEXT,
  original_receiving_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mr.id, mr.receiving_date, mr.session, mr.volume_liters,
    mr.species, mr.milk_quality, mr.price_per_liter, mr.total_value,
    mr.status, mr.entry_type, mr.original_receiving_id, mr.created_at
  FROM public.coop_milk_receivings mr
  WHERE mr.farm_id = _farm_id
    AND (_date_from IS NULL OR mr.receiving_date >= _date_from)
    AND (_date_to IS NULL OR mr.receiving_date <= _date_to)
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = _farm_id AND f.owner_id = auth.uid()
    )
  ORDER BY mr.receiving_date DESC, mr.created_at DESC
$$;


-- Get farmer's feed receipts from the coop
CREATE OR REPLACE FUNCTION public.get_my_coop_feed_receipts(
  _farm_id UUID,
  _date_from DATE DEFAULT NULL,
  _date_to DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  disbursement_date DATE,
  feed_type TEXT,
  category TEXT,
  quantity_kg NUMERIC,
  cost_per_kg NUMERIC,
  total_cost NUMERIC,
  status TEXT,
  entry_type TEXT,
  original_disbursement_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fd.id, fd.disbursement_date, fd.feed_type, fd.category,
    fd.quantity_kg, fd.cost_per_kg, fd.total_cost,
    fd.status, fd.entry_type, fd.original_disbursement_id, fd.created_at
  FROM public.coop_feed_disbursements fd
  WHERE fd.farm_id = _farm_id
    AND (_date_from IS NULL OR fd.disbursement_date >= _date_from)
    AND (_date_to IS NULL OR fd.disbursement_date <= _date_to)
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = _farm_id AND f.owner_id = auth.uid()
    )
  ORDER BY fd.disbursement_date DESC, fd.created_at DESC
$$;


-- Get farmer's SOA
CREATE OR REPLACE FUNCTION public.get_my_coop_soa(
  _farm_id UUID,
  _period_start DATE DEFAULT NULL,
  _period_end DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  cooperative_name TEXT,
  period_start DATE,
  period_end DATE,
  total_milk_liters NUMERIC,
  total_milk_value NUMERIC,
  total_feed_kg NUMERIC,
  total_feed_cost NUMERIC,
  net_balance NUMERIC,
  status TEXT,
  revision_number INTEGER,
  finalized_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  notes TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    soa.id, c.name AS cooperative_name,
    soa.period_start, soa.period_end,
    soa.total_milk_liters, soa.total_milk_value,
    soa.total_feed_kg, soa.total_feed_cost,
    soa.net_balance, soa.status, soa.revision_number,
    soa.finalized_at, soa.settled_at, soa.notes
  FROM public.coop_soa_periods soa
  JOIN public.cooperatives c ON c.id = soa.cooperative_id
  WHERE soa.farm_id = _farm_id
    AND (_period_start IS NULL OR soa.period_start >= _period_start)
    AND (_period_end IS NULL OR soa.period_end <= _period_end)
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = _farm_id AND f.owner_id = auth.uid()
    )
  ORDER BY soa.period_start DESC, soa.revision_number DESC
$$;
