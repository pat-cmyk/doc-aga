-- Create feed_inventory table
CREATE TABLE public.feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL,
  quantity_kg NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  cost_per_unit NUMERIC,
  reorder_threshold NUMERIC,
  supplier TEXT,
  notes TEXT,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create feed_stock_transactions table for audit trail
CREATE TABLE public.feed_stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_inventory_id UUID NOT NULL REFERENCES public.feed_inventory(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('addition', 'consumption', 'adjustment')),
  quantity_change_kg NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feed_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_stock_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for feed_inventory
CREATE POLICY "Farm members can view feed inventory"
  ON public.feed_inventory FOR SELECT
  USING (can_access_farm(farm_id));

CREATE POLICY "Farm owners and managers can insert feed inventory"
  ON public.feed_inventory FOR INSERT
  WITH CHECK (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners and managers can update feed inventory"
  ON public.feed_inventory FOR UPDATE
  USING (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners can delete feed inventory"
  ON public.feed_inventory FOR DELETE
  USING (is_farm_owner(auth.uid(), farm_id));

-- RLS policies for feed_stock_transactions
CREATE POLICY "Farm members can view transactions"
  ON public.feed_stock_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.feed_inventory fi
      WHERE fi.id = feed_stock_transactions.feed_inventory_id
        AND can_access_farm(fi.farm_id)
    )
  );

CREATE POLICY "Farm owners and managers can insert transactions"
  ON public.feed_stock_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.feed_inventory fi
      WHERE fi.id = feed_stock_transactions.feed_inventory_id
        AND (is_farm_owner(auth.uid(), fi.farm_id) OR is_farm_manager(auth.uid(), fi.farm_id))
    )
  );

-- Create indexes for performance
CREATE INDEX idx_feed_inventory_farm_id ON public.feed_inventory(farm_id);
CREATE INDEX idx_feed_stock_transactions_feed_inventory_id ON public.feed_stock_transactions(feed_inventory_id);
CREATE INDEX idx_feed_stock_transactions_created_at ON public.feed_stock_transactions(created_at DESC);