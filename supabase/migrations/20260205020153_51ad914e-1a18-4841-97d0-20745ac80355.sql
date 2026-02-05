-- ============================================================================
-- SSOT Data Category Migration: RLS Policies + RPC Updates
-- ============================================================================
-- This migration addresses the data category (live/demo) segregation gap
-- by adding missing government RLS policies and updating RPCs to support
-- data_category_filter parameter.
-- ============================================================================

-- ============================================================================
-- PART 1: ADD MISSING RLS POLICIES FOR GOVERNMENT ACCESS
-- ============================================================================
-- These tables are queried by Doc Aga AI and government analytics but lack
-- government SELECT policies, causing queries to return 0 results.

-- ai_records: Needed for breeding/pregnancy analytics
CREATE POLICY "government_view_ai_records" ON public.ai_records
  FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- milking_records: Needed for milk production analytics
CREATE POLICY "government_view_milking_records" ON public.milking_records
  FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- feeding_records: Needed for feed security analytics
CREATE POLICY "government_view_feeding_records" ON public.feeding_records
  FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- weight_records: Needed for growth analytics
CREATE POLICY "government_view_weight_records" ON public.weight_records
  FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- ============================================================================
-- PART 2: UPDATE RPCs WITH data_category_filter PARAMETER
-- ============================================================================

-- 2.1: get_government_milk_analytics
CREATE OR REPLACE FUNCTION public.get_government_milk_analytics(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT 'live'
)
RETURNS TABLE (
  report_date DATE,
  cattle_milk_liters NUMERIC,
  goat_milk_liters NUMERIC,
  carabao_milk_liters NUMERIC,
  total_milk_liters NUMERIC,
  cattle_farms_milking BIGINT,
  goat_farms_milking BIGINT,
  carabao_farms_milking BIGINT,
  avg_cattle_price NUMERIC,
  avg_goat_price NUMERIC,
  avg_carabao_price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has government role
  IF NOT has_role(auth.uid(), 'government'::user_role) THEN
    RAISE EXCEPTION 'Access denied: government role required';
  END IF;

  RETURN QUERY
  WITH daily_milk AS (
    SELECT
      mr.milking_date AS report_date,
      a.livestock_type,
      SUM(mr.liters) AS total_liters,
      COUNT(DISTINCT f.id) AS farms_milking,
      AVG(mr.price_per_liter) FILTER (WHERE mr.price_per_liter > 0) AS avg_price
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    JOIN farms f ON a.farm_id = f.id
    WHERE mr.milking_date >= start_date
      AND mr.milking_date <= end_date
      AND a.is_deleted = false
      AND f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
    GROUP BY mr.milking_date, a.livestock_type
  )
  SELECT
    dm.report_date,
    COALESCE(SUM(dm.total_liters) FILTER (WHERE dm.livestock_type = 'cattle'), 0) AS cattle_milk_liters,
    COALESCE(SUM(dm.total_liters) FILTER (WHERE dm.livestock_type = 'goat'), 0) AS goat_milk_liters,
    COALESCE(SUM(dm.total_liters) FILTER (WHERE dm.livestock_type = 'carabao'), 0) AS carabao_milk_liters,
    COALESCE(SUM(dm.total_liters), 0) AS total_milk_liters,
    COALESCE(SUM(dm.farms_milking) FILTER (WHERE dm.livestock_type = 'cattle'), 0) AS cattle_farms_milking,
    COALESCE(SUM(dm.farms_milking) FILTER (WHERE dm.livestock_type = 'goat'), 0) AS goat_farms_milking,
    COALESCE(SUM(dm.farms_milking) FILTER (WHERE dm.livestock_type = 'carabao'), 0) AS carabao_farms_milking,
    AVG(dm.avg_price) FILTER (WHERE dm.livestock_type = 'cattle') AS avg_cattle_price,
    AVG(dm.avg_price) FILTER (WHERE dm.livestock_type = 'goat') AS avg_goat_price,
    AVG(dm.avg_price) FILTER (WHERE dm.livestock_type = 'carabao') AS avg_carabao_price
  FROM daily_milk dm
  GROUP BY dm.report_date
  ORDER BY dm.report_date;
END;
$$;

-- 2.2: get_regional_feed_security
CREATE OR REPLACE FUNCTION public.get_regional_feed_security(
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT 'live'
)
RETURNS TABLE (
  region TEXT,
  province TEXT,
  total_farms BIGINT,
  critical_feed_farms BIGINT,
  low_feed_farms BIGINT,
  adequate_feed_farms BIGINT,
  total_roughage_kg NUMERIC,
  total_concentrate_kg NUMERIC,
  avg_feed_stock_days NUMERIC,
  critical_percentage NUMERIC,
  low_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has government role
  IF NOT has_role(auth.uid(), 'government'::user_role) THEN
    RAISE EXCEPTION 'Access denied: government role required';
  END IF;

  RETURN QUERY
  WITH farm_feed AS (
    SELECT
      f.id AS farm_id,
      f.region,
      f.province,
      COALESCE(SUM(fi.quantity_kg) FILTER (WHERE fi.category = 'roughage' OR fi.feed_type ILIKE '%hay%' OR fi.feed_type ILIKE '%grass%'), 0) AS roughage_kg,
      COALESCE(SUM(fi.quantity_kg) FILTER (WHERE fi.category = 'concentrate' OR fi.feed_type ILIKE '%feed%' OR fi.feed_type ILIKE '%grain%'), 0) AS concentrate_kg,
      -- Estimate days of feed based on animal count and consumption rate
      CASE 
        WHEN (SELECT COUNT(*) FROM animals a WHERE a.farm_id = f.id AND a.is_deleted = false AND a.exit_date IS NULL) > 0
        THEN SUM(fi.quantity_kg) / GREATEST((SELECT COUNT(*) FROM animals a WHERE a.farm_id = f.id AND a.is_deleted = false AND a.exit_date IS NULL) * 10, 1)
        ELSE NULL
      END AS estimated_days
    FROM farms f
    LEFT JOIN feed_inventory fi ON fi.farm_id = f.id
    WHERE f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
    GROUP BY f.id, f.region, f.province
  )
  SELECT
    ff.region,
    ff.province,
    COUNT(DISTINCT ff.farm_id) AS total_farms,
    COUNT(DISTINCT ff.farm_id) FILTER (WHERE ff.estimated_days IS NOT NULL AND ff.estimated_days < 7) AS critical_feed_farms,
    COUNT(DISTINCT ff.farm_id) FILTER (WHERE ff.estimated_days IS NOT NULL AND ff.estimated_days >= 7 AND ff.estimated_days < 30) AS low_feed_farms,
    COUNT(DISTINCT ff.farm_id) FILTER (WHERE ff.estimated_days IS NULL OR ff.estimated_days >= 30) AS adequate_feed_farms,
    SUM(ff.roughage_kg) AS total_roughage_kg,
    SUM(ff.concentrate_kg) AS total_concentrate_kg,
    AVG(ff.estimated_days) AS avg_feed_stock_days,
    CASE WHEN COUNT(DISTINCT ff.farm_id) > 0 
      THEN (COUNT(DISTINCT ff.farm_id) FILTER (WHERE ff.estimated_days IS NOT NULL AND ff.estimated_days < 7)::NUMERIC / COUNT(DISTINCT ff.farm_id)) * 100
      ELSE 0 END AS critical_percentage,
    CASE WHEN COUNT(DISTINCT ff.farm_id) > 0 
      THEN (COUNT(DISTINCT ff.farm_id) FILTER (WHERE ff.estimated_days IS NOT NULL AND ff.estimated_days >= 7 AND ff.estimated_days < 30)::NUMERIC / COUNT(DISTINCT ff.farm_id)) * 100
      ELSE 0 END AS low_percentage
  FROM farm_feed ff
  GROUP BY ff.region, ff.province
  ORDER BY ff.region, ff.province;
END;
$$;

-- 2.3: get_regional_market_prices
CREATE OR REPLACE FUNCTION public.get_regional_market_prices(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT 'live'
)
RETURNS TABLE (
  livestock_type TEXT,
  region TEXT,
  avg_price_per_kg NUMERIC,
  min_price NUMERIC,
  max_price NUMERIC,
  price_volatility NUMERIC,
  sample_count BIGINT,
  latest_price NUMERIC,
  latest_date DATE,
  price_trend TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has government role
  IF NOT has_role(auth.uid(), 'government'::user_role) THEN
    RAISE EXCEPTION 'Access denied: government role required';
  END IF;

  RETURN QUERY
  WITH price_data AS (
    SELECT
      a.livestock_type,
      f.region,
      bav.market_price_per_kg AS price,
      bav.valuation_date,
      ROW_NUMBER() OVER (PARTITION BY a.livestock_type, f.region ORDER BY bav.valuation_date DESC) AS rn
    FROM biological_asset_valuations bav
    JOIN animals a ON bav.animal_id = a.id
    JOIN farms f ON bav.farm_id = f.id
    WHERE bav.valuation_date >= start_date
      AND bav.valuation_date <= end_date
      AND f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region = region_filter)
  ),
  aggregated AS (
    SELECT
      pd.livestock_type,
      pd.region,
      AVG(pd.price) AS avg_price_per_kg,
      MIN(pd.price) AS min_price,
      MAX(pd.price) AS max_price,
      STDDEV(pd.price) AS price_volatility,
      COUNT(*) AS sample_count,
      MAX(pd.price) FILTER (WHERE pd.rn = 1) AS latest_price,
      MAX(pd.valuation_date) FILTER (WHERE pd.rn = 1) AS latest_date
    FROM price_data pd
    GROUP BY pd.livestock_type, pd.region
  ),
  with_trend AS (
    SELECT
      agg.*,
      -- Simple trend calculation: compare first half avg to second half avg
      CASE 
        WHEN agg.avg_price_per_kg > agg.min_price * 1.1 THEN 'rising'
        WHEN agg.avg_price_per_kg < agg.max_price * 0.9 THEN 'falling'
        ELSE 'stable'
      END AS price_trend
    FROM aggregated agg
  )
  SELECT
    wt.livestock_type,
    wt.region,
    wt.avg_price_per_kg,
    wt.min_price,
    wt.max_price,
    COALESCE(wt.price_volatility, 0) AS price_volatility,
    wt.sample_count,
    wt.latest_price,
    wt.latest_date,
    wt.price_trend
  FROM with_trend wt
  ORDER BY wt.livestock_type, wt.region;
END;
$$;

-- 2.4: get_farm_compliance_metrics
CREATE OR REPLACE FUNCTION public.get_farm_compliance_metrics(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT 'live'
)
RETURNS TABLE (
  region TEXT,
  province TEXT,
  total_farms BIGINT,
  farms_with_milking_logs BIGINT,
  farms_with_feeding_logs BIGINT,
  farms_with_health_logs BIGINT,
  avg_milking_completion NUMERIC,
  avg_feeding_completion NUMERIC,
  high_compliance_farms BIGINT,
  low_compliance_farms BIGINT,
  compliance_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has government role
  IF NOT has_role(auth.uid(), 'government'::user_role) THEN
    RAISE EXCEPTION 'Access denied: government role required';
  END IF;

  RETURN QUERY
  WITH farm_activity AS (
    SELECT
      f.id AS farm_id,
      f.region,
      f.province,
      -- Count distinct dates with milking logs
      (SELECT COUNT(DISTINCT mr.milking_date) 
       FROM milking_records mr 
       JOIN animals a ON mr.animal_id = a.id 
       WHERE a.farm_id = f.id 
         AND mr.milking_date >= start_date 
         AND mr.milking_date <= end_date) AS milking_days,
      -- Count distinct dates with feeding logs
      (SELECT COUNT(DISTINCT DATE(fr.record_datetime)) 
       FROM feeding_records fr 
       JOIN animals a ON fr.animal_id = a.id 
       WHERE a.farm_id = f.id 
         AND fr.record_datetime >= start_date 
         AND fr.record_datetime <= end_date) AS feeding_days,
      -- Count health logs
      (SELECT COUNT(*) 
       FROM health_records hr 
       JOIN animals a ON hr.animal_id = a.id 
       WHERE a.farm_id = f.id 
         AND hr.check_date >= start_date 
         AND hr.check_date <= end_date) AS health_logs,
      -- Total days in range
      (end_date - start_date + 1) AS total_days
    FROM farms f
    WHERE f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
  )
  SELECT
    fa.region,
    fa.province,
    COUNT(DISTINCT fa.farm_id) AS total_farms,
    COUNT(DISTINCT fa.farm_id) FILTER (WHERE fa.milking_days > 0) AS farms_with_milking_logs,
    COUNT(DISTINCT fa.farm_id) FILTER (WHERE fa.feeding_days > 0) AS farms_with_feeding_logs,
    COUNT(DISTINCT fa.farm_id) FILTER (WHERE fa.health_logs > 0) AS farms_with_health_logs,
    AVG(CASE WHEN fa.total_days > 0 THEN (fa.milking_days::NUMERIC / fa.total_days) * 100 ELSE 0 END) AS avg_milking_completion,
    AVG(CASE WHEN fa.total_days > 0 THEN (fa.feeding_days::NUMERIC / fa.total_days) * 100 ELSE 0 END) AS avg_feeding_completion,
    -- High compliance: >70% activity
    COUNT(DISTINCT fa.farm_id) FILTER (
      WHERE fa.total_days > 0 AND ((fa.milking_days + fa.feeding_days)::NUMERIC / (fa.total_days * 2)) >= 0.7
    ) AS high_compliance_farms,
    -- Low compliance: <30% activity
    COUNT(DISTINCT fa.farm_id) FILTER (
      WHERE fa.total_days > 0 AND ((fa.milking_days + fa.feeding_days)::NUMERIC / (fa.total_days * 2)) < 0.3
    ) AS low_compliance_farms,
    -- Overall compliance rate
    CASE WHEN COUNT(DISTINCT fa.farm_id) > 0
      THEN (COUNT(DISTINCT fa.farm_id) FILTER (
        WHERE fa.total_days > 0 AND ((fa.milking_days + fa.feeding_days)::NUMERIC / (fa.total_days * 2)) >= 0.5
      )::NUMERIC / COUNT(DISTINCT fa.farm_id)) * 100
      ELSE 0 END AS compliance_rate
  FROM farm_activity fa
  GROUP BY fa.region, fa.province
  ORDER BY fa.region, fa.province;
END;
$$;