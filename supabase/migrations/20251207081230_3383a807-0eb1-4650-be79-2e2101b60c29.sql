-- Phase 1: Financial Module Expansion - "Lactation Ledger" Foundation

-- =====================================================
-- 0. CREATE HELPER FUNCTION FOR updated_at (if not exists)
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- 1. CREATE farm_revenues TABLE
-- =====================================================
CREATE TABLE public.farm_revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  source text NOT NULL CHECK (source IN ('Milk Sales', 'Livestock Sales', 'Byproduct', 'Other')),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  linked_animal_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
  linked_milk_log_id uuid REFERENCES public.milking_records(id) ON DELETE SET NULL,
  notes text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.farm_revenues IS 'Tracks all farm income sources including milk sales, livestock sales, and byproducts';

-- Enable RLS
ALTER TABLE public.farm_revenues ENABLE ROW LEVEL SECURITY;

-- RLS Policies for farm_revenues
CREATE POLICY "Farm members can view revenues"
ON public.farm_revenues FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM farms f
    LEFT JOIN farm_memberships fm ON fm.farm_id = f.id
    WHERE f.id = farm_revenues.farm_id
    AND (f.owner_id = auth.uid() OR (fm.user_id = auth.uid() AND fm.invitation_status = 'accepted'))
  )
);

CREATE POLICY "Farm owners and managers can insert revenues"
ON public.farm_revenues FOR INSERT
TO authenticated
WITH CHECK (is_farm_owner_or_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners and managers can update revenues"
ON public.farm_revenues FOR UPDATE
TO authenticated
USING (is_farm_owner_or_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners can delete revenues"
ON public.farm_revenues FOR DELETE
TO authenticated
USING (is_farm_owner(auth.uid(), farm_id));

-- =====================================================
-- 2. CREATE biological_asset_valuations TABLE
-- =====================================================
CREATE TABLE public.biological_asset_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  animal_id uuid NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  valuation_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric NOT NULL CHECK (weight_kg > 0),
  market_price_per_kg numeric NOT NULL CHECK (market_price_per_kg >= 0),
  estimated_value numeric GENERATED ALWAYS AS (weight_kg * market_price_per_kg) STORED,
  is_sold boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.biological_asset_valuations IS 'Tracks livestock valuation as biological assets per IAS 41 accounting standards - useful for investor/VC analytics';

-- Enable RLS
ALTER TABLE public.biological_asset_valuations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for biological_asset_valuations
CREATE POLICY "Farm members can view valuations"
ON public.biological_asset_valuations FOR SELECT
TO authenticated
USING (can_access_farm(farm_id));

CREATE POLICY "Farm owners and managers can insert valuations"
ON public.biological_asset_valuations FOR INSERT
TO authenticated
WITH CHECK (is_farm_owner_or_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners and managers can update valuations"
ON public.biological_asset_valuations FOR UPDATE
TO authenticated
USING (is_farm_owner_or_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners can delete valuations"
ON public.biological_asset_valuations FOR DELETE
TO authenticated
USING (is_farm_owner(auth.uid(), farm_id));

-- =====================================================
-- 3. ADD allocation_type TO farm_expenses
-- =====================================================
ALTER TABLE public.farm_expenses
ADD COLUMN IF NOT EXISTS allocation_type text DEFAULT 'Operational'
CHECK (allocation_type IN ('Operational', 'Capital', 'Personal'));

COMMENT ON COLUMN public.farm_expenses.allocation_type IS 
'Expense classification: Operational (daily farm costs), Capital (long-term investments), Personal (household/non-farm)';

-- =====================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_farm_revenues_farm_date ON public.farm_revenues(farm_id, transaction_date DESC);
CREATE INDEX idx_farm_revenues_source ON public.farm_revenues(source);
CREATE INDEX idx_farm_revenues_not_deleted ON public.farm_revenues(farm_id) WHERE is_deleted = false;

CREATE INDEX idx_biological_valuations_farm_animal ON public.biological_asset_valuations(farm_id, animal_id);
CREATE INDEX idx_biological_valuations_date ON public.biological_asset_valuations(valuation_date DESC);

CREATE INDEX IF NOT EXISTS idx_farm_expenses_allocation ON public.farm_expenses(allocation_type);

-- =====================================================
-- 5. ENABLE REALTIME FOR REVENUES
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.farm_revenues;

-- =====================================================
-- 6. CREATE updated_at TRIGGER FOR farm_revenues
-- =====================================================
CREATE TRIGGER update_farm_revenues_updated_at
BEFORE UPDATE ON public.farm_revenues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();