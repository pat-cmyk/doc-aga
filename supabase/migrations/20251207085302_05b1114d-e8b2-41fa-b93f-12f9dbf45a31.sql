-- =====================================================
-- PHASE 1: Create market_prices table
-- =====================================================
CREATE TABLE public.market_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_type text NOT NULL,
  region text,
  province text,
  municipality text,
  price_per_kg numeric NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL CHECK (source IN ('farmer_sale', 'farmer_input', 'regional_aggregate', 'da_bulletin', 'system_default')),
  reported_by uuid REFERENCES auth.users(id),
  farm_id uuid REFERENCES public.farms(id),
  animal_id uuid REFERENCES public.animals(id),
  notes text,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;

-- Indexes for efficient price lookups
CREATE INDEX idx_market_prices_lookup ON public.market_prices (livestock_type, province, effective_date DESC);
CREATE INDEX idx_market_prices_region ON public.market_prices (livestock_type, region, effective_date DESC);
CREATE INDEX idx_market_prices_source ON public.market_prices (source, effective_date DESC);

-- RLS Policies
-- All authenticated users can view prices (market intelligence)
CREATE POLICY "Authenticated users can view market prices"
ON public.market_prices FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Farm owners/managers can insert their own prices
CREATE POLICY "Farm members can insert market prices"
ON public.market_prices FOR INSERT
WITH CHECK (
  reported_by = auth.uid() OR
  (farm_id IS NOT NULL AND (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id)))
);

-- Government users can insert DA bulletin data
CREATE POLICY "Government can insert DA prices"
ON public.market_prices FOR INSERT
WITH CHECK (has_role(auth.uid(), 'government'::user_role));

-- Admins can update (verify prices)
CREATE POLICY "Admins can update market prices"
ON public.market_prices FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

-- =====================================================
-- PHASE 2: Price Resolution Function
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_market_price(
  p_livestock_type text,
  p_farm_id uuid DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_province text DEFAULT NULL
) RETURNS TABLE(price numeric, source text, effective_date date) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resolved_price numeric;
  resolved_source text;
  resolved_date date;
  farm_record RECORD;
BEGIN
  -- Get farm location if farm_id provided
  IF p_farm_id IS NOT NULL THEN
    SELECT f.region, f.province INTO farm_record FROM farms f WHERE f.id = p_farm_id;
    p_region := COALESCE(p_region, farm_record.region);
    p_province := COALESCE(p_province, farm_record.province);
  END IF;

  -- Priority 1: Recent sale from same farm (last 90 days)
  SELECT 
    (a.sale_price / NULLIF(a.current_weight_kg, 0)),
    'farmer_sale',
    a.exit_date
  INTO resolved_price, resolved_source, resolved_date
  FROM animals a
  WHERE a.farm_id = p_farm_id
    AND a.livestock_type = p_livestock_type
    AND a.exit_reason = 'sold'
    AND a.sale_price IS NOT NULL
    AND a.current_weight_kg > 0
    AND a.exit_date >= CURRENT_DATE - INTERVAL '90 days'
  ORDER BY a.exit_date DESC
  LIMIT 1;
  
  IF resolved_price IS NOT NULL THEN 
    RETURN QUERY SELECT resolved_price, resolved_source, resolved_date;
    RETURN;
  END IF;

  -- Priority 2: Farmer-input local price (same province, last 30 days)
  SELECT mp.price_per_kg, 'farmer_input', mp.effective_date
  INTO resolved_price, resolved_source, resolved_date
  FROM market_prices mp
  WHERE mp.livestock_type = p_livestock_type
    AND mp.province = p_province
    AND mp.source = 'farmer_input'
    AND mp.effective_date >= CURRENT_DATE - INTERVAL '30 days'
  ORDER BY mp.effective_date DESC
  LIMIT 1;
  
  IF resolved_price IS NOT NULL THEN 
    RETURN QUERY SELECT resolved_price, resolved_source, resolved_date;
    RETURN;
  END IF;

  -- Priority 3: Regional aggregate (peer sales from same province, last 90 days)
  SELECT 
    AVG(a.sale_price / NULLIF(a.current_weight_kg, 0)),
    'regional_aggregate',
    MAX(a.exit_date)
  INTO resolved_price, resolved_source, resolved_date
  FROM animals a
  JOIN farms f ON a.farm_id = f.id
  WHERE a.livestock_type = p_livestock_type
    AND f.province = p_province
    AND a.exit_reason = 'sold'
    AND a.sale_price IS NOT NULL
    AND a.current_weight_kg > 0
    AND a.exit_date >= CURRENT_DATE - INTERVAL '90 days';
  
  IF resolved_price IS NOT NULL THEN 
    RETURN QUERY SELECT resolved_price, resolved_source, resolved_date;
    RETURN;
  END IF;

  -- Priority 4: DA Bulletin price (region level)
  SELECT mp.price_per_kg, 'da_bulletin', mp.effective_date
  INTO resolved_price, resolved_source, resolved_date
  FROM market_prices mp
  WHERE mp.livestock_type = p_livestock_type
    AND mp.region = p_region
    AND mp.source = 'da_bulletin'
  ORDER BY mp.effective_date DESC
  LIMIT 1;
  
  IF resolved_price IS NOT NULL THEN 
    RETURN QUERY SELECT resolved_price, resolved_source, resolved_date;
    RETURN;
  END IF;

  -- Priority 5: National DA average
  SELECT mp.price_per_kg, 'da_bulletin', mp.effective_date
  INTO resolved_price, resolved_source, resolved_date
  FROM market_prices mp
  WHERE mp.livestock_type = p_livestock_type
    AND mp.region IS NULL
    AND mp.source = 'da_bulletin'
  ORDER BY mp.effective_date DESC
  LIMIT 1;
  
  IF resolved_price IS NOT NULL THEN 
    RETURN QUERY SELECT resolved_price, resolved_source, resolved_date;
    RETURN;
  END IF;

  -- Fallback: System defaults by livestock type
  resolved_source := 'system_default';
  resolved_date := CURRENT_DATE;
  resolved_price := CASE p_livestock_type
    WHEN 'cattle' THEN 300
    WHEN 'carabao' THEN 280
    WHEN 'goat' THEN 350
    WHEN 'sheep' THEN 320
    ELSE 300
  END;
  
  RETURN QUERY SELECT resolved_price, resolved_source, resolved_date;
END;
$$;

-- =====================================================
-- PHASE 3: Automatic Price Capture from Animal Sales
-- =====================================================
CREATE OR REPLACE FUNCTION public.capture_sale_price() 
RETURNS trigger 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  farm_record RECORD;
  price_per_kg numeric;
BEGIN
  -- Only for sales with valid price and weight
  IF NEW.exit_reason = 'sold' 
     AND NEW.sale_price IS NOT NULL 
     AND NEW.current_weight_kg IS NOT NULL
     AND NEW.current_weight_kg > 0 THEN
    
    price_per_kg := NEW.sale_price / NEW.current_weight_kg;
    
    SELECT f.region, f.province, f.municipality INTO farm_record 
    FROM farms f WHERE f.id = NEW.farm_id;
    
    INSERT INTO market_prices (
      livestock_type, region, province, municipality,
      price_per_kg, effective_date, source,
      farm_id, animal_id, notes
    ) VALUES (
      NEW.livestock_type,
      farm_record.region,
      farm_record.province,
      farm_record.municipality,
      price_per_kg,
      COALESCE(NEW.exit_date, CURRENT_DATE),
      'farmer_sale',
      NEW.farm_id,
      NEW.id,
      'Auto-captured from animal sale @ ₱' || NEW.sale_price::text || ' for ' || NEW.current_weight_kg::text || 'kg'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_capture_sale_price ON public.animals;
CREATE TRIGGER trg_capture_sale_price
AFTER UPDATE ON public.animals
FOR EACH ROW
WHEN (NEW.exit_reason = 'sold' AND (OLD.exit_reason IS DISTINCT FROM NEW.exit_reason OR OLD.sale_price IS DISTINCT FROM NEW.sale_price))
EXECUTE FUNCTION capture_sale_price();

-- =====================================================
-- PHASE 4: Seed DA Bulletin Prices (National & Regional)
-- =====================================================
INSERT INTO market_prices (livestock_type, region, price_per_kg, source, effective_date, notes, is_verified) VALUES
-- National averages (region = NULL)
('cattle', NULL, 300, 'da_bulletin', '2024-12-01', 'National average - DA Price Monitoring', true),
('carabao', NULL, 280, 'da_bulletin', '2024-12-01', 'National average - DA Price Monitoring', true),
('goat', NULL, 350, 'da_bulletin', '2024-12-01', 'National average - DA Price Monitoring', true),
('sheep', NULL, 320, 'da_bulletin', '2024-12-01', 'National average - DA Price Monitoring', true),

-- Region IV-A (CALABARZON)
('cattle', 'Region IV-A (CALABARZON)', 310, 'da_bulletin', '2024-12-01', 'CALABARZON regional price', true),
('carabao', 'Region IV-A (CALABARZON)', 290, 'da_bulletin', '2024-12-01', 'CALABARZON regional price', true),
('goat', 'Region IV-A (CALABARZON)', 360, 'da_bulletin', '2024-12-01', 'CALABARZON regional price', true),

-- Region III (Central Luzon)
('cattle', 'Region III (Central Luzon)', 305, 'da_bulletin', '2024-12-01', 'Central Luzon regional price', true),
('carabao', 'Region III (Central Luzon)', 285, 'da_bulletin', '2024-12-01', 'Central Luzon regional price', true),
('goat', 'Region III (Central Luzon)', 355, 'da_bulletin', '2024-12-01', 'Central Luzon regional price', true),

-- Region V (Bicol)
('cattle', 'Region V (Bicol Region)', 295, 'da_bulletin', '2024-12-01', 'Bicol regional price', true),
('carabao', 'Region V (Bicol Region)', 275, 'da_bulletin', '2024-12-01', 'Bicol regional price', true),
('goat', 'Region V (Bicol Region)', 345, 'da_bulletin', '2024-12-01', 'Bicol regional price', true),

-- Region VI (Western Visayas)
('cattle', 'Region VI (Western Visayas)', 290, 'da_bulletin', '2024-12-01', 'Western Visayas regional price', true),
('carabao', 'Region VI (Western Visayas)', 270, 'da_bulletin', '2024-12-01', 'Western Visayas regional price', true),
('goat', 'Region VI (Western Visayas)', 340, 'da_bulletin', '2024-12-01', 'Western Visayas regional price', true),

-- Region VII (Central Visayas)
('cattle', 'Region VII (Central Visayas)', 295, 'da_bulletin', '2024-12-01', 'Central Visayas regional price', true),
('carabao', 'Region VII (Central Visayas)', 275, 'da_bulletin', '2024-12-01', 'Central Visayas regional price', true),
('goat', 'Region VII (Central Visayas)', 350, 'da_bulletin', '2024-12-01', 'Central Visayas regional price', true),

-- Region X (Northern Mindanao)
('cattle', 'Region X (Northern Mindanao)', 285, 'da_bulletin', '2024-12-01', 'Northern Mindanao regional price', true),
('carabao', 'Region X (Northern Mindanao)', 265, 'da_bulletin', '2024-12-01', 'Northern Mindanao regional price', true),
('goat', 'Region X (Northern Mindanao)', 335, 'da_bulletin', '2024-12-01', 'Northern Mindanao regional price', true),

-- Region XI (Davao)
('cattle', 'Region XI (Davao Region)', 290, 'da_bulletin', '2024-12-01', 'Davao regional price', true),
('carabao', 'Region XI (Davao Region)', 270, 'da_bulletin', '2024-12-01', 'Davao regional price', true),
('goat', 'Region XI (Davao Region)', 340, 'da_bulletin', '2024-12-01', 'Davao regional price', true);