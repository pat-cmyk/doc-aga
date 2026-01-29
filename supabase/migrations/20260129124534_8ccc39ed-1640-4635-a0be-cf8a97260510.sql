-- ===================================================
-- Priority 1: Species-Based Milk Production Analytics
-- ===================================================

-- Create RPC for getting milk production broken down by species
CREATE OR REPLACE FUNCTION public.get_government_milk_analytics(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  report_date DATE,
  cattle_milk_liters NUMERIC,
  goat_milk_liters NUMERIC,
  carabao_milk_liters NUMERIC,
  total_milk_liters NUMERIC,
  cattle_farms_milking INT,
  goat_farms_milking INT,
  carabao_farms_milking INT,
  avg_cattle_price NUMERIC,
  avg_goat_price NUMERIC,
  avg_carabao_price NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH daily_milk AS (
    SELECT 
      mr.milking_date::DATE AS milk_date,
      a.livestock_type,
      f.id AS farm_id,
      SUM(mr.liters) AS daily_liters
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    JOIN farms f ON a.farm_id = f.id
    WHERE mr.milking_date >= start_date
      AND mr.milking_date <= end_date
      AND a.is_deleted = false
      AND f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
    GROUP BY mr.milking_date::DATE, a.livestock_type, f.id
  ),
  daily_prices AS (
    SELECT 
      mp.effective_date,
      mp.livestock_type,
      mp.price_per_kg AS price_per_liter
    FROM market_prices mp
    WHERE mp.source IN ('farmer_sale', 'farmer_input', 'regional_aggregate')
      AND mp.effective_date >= start_date
      AND mp.effective_date <= end_date
  ),
  aggregated AS (
    SELECT 
      dm.milk_date,
      SUM(CASE WHEN dm.livestock_type = 'Cattle' THEN dm.daily_liters ELSE 0 END) AS cattle_liters,
      SUM(CASE WHEN dm.livestock_type = 'Goat' THEN dm.daily_liters ELSE 0 END) AS goat_liters,
      SUM(CASE WHEN dm.livestock_type = 'Carabao' THEN dm.daily_liters ELSE 0 END) AS carabao_liters,
      SUM(dm.daily_liters) AS total_liters,
      COUNT(DISTINCT CASE WHEN dm.livestock_type = 'Cattle' THEN dm.farm_id END)::INT AS cattle_farms,
      COUNT(DISTINCT CASE WHEN dm.livestock_type = 'Goat' THEN dm.farm_id END)::INT AS goat_farms,
      COUNT(DISTINCT CASE WHEN dm.livestock_type = 'Carabao' THEN dm.farm_id END)::INT AS carabao_farms
    FROM daily_milk dm
    GROUP BY dm.milk_date
  )
  SELECT 
    a.milk_date AS report_date,
    COALESCE(a.cattle_liters, 0)::NUMERIC AS cattle_milk_liters,
    COALESCE(a.goat_liters, 0)::NUMERIC AS goat_milk_liters,
    COALESCE(a.carabao_liters, 0)::NUMERIC AS carabao_milk_liters,
    COALESCE(a.total_liters, 0)::NUMERIC AS total_milk_liters,
    a.cattle_farms AS cattle_farms_milking,
    a.goat_farms AS goat_farms_milking,
    a.carabao_farms AS carabao_farms_milking,
    (SELECT AVG(p.price_per_liter) FROM daily_prices p WHERE p.livestock_type = 'Cattle')::NUMERIC AS avg_cattle_price,
    (SELECT AVG(p.price_per_liter) FROM daily_prices p WHERE p.livestock_type = 'Goat')::NUMERIC AS avg_goat_price,
    (SELECT AVG(p.price_per_liter) FROM daily_prices p WHERE p.livestock_type = 'Carabao')::NUMERIC AS avg_carabao_price
  FROM aggregated a
  ORDER BY a.milk_date;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_government_milk_analytics TO authenticated;

-- ===================================================
-- Priority 2: Regional Feed Security Dashboard
-- ===================================================

-- Create RPC for getting regional feed security status
CREATE OR REPLACE FUNCTION public.get_regional_feed_security(
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  region TEXT,
  province TEXT,
  total_farms INT,
  critical_feed_farms INT,
  low_feed_farms INT,
  adequate_feed_farms INT,
  total_roughage_kg NUMERIC,
  total_concentrate_kg NUMERIC,
  avg_feed_stock_days NUMERIC,
  critical_percentage NUMERIC,
  low_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH farm_feed_status AS (
    SELECT 
      f.id AS farm_id,
      f.region,
      f.province,
      -- Calculate roughage kg
      COALESCE((
        SELECT SUM(fi.quantity_kg) 
        FROM feed_inventory fi 
        WHERE fi.farm_id = f.id 
          AND LOWER(fi.category) = 'roughage'
      ), 0) AS roughage_kg,
      -- Calculate concentrate kg
      COALESCE((
        SELECT SUM(fi.quantity_kg) 
        FROM feed_inventory fi 
        WHERE fi.farm_id = f.id 
          AND LOWER(fi.category) = 'concentrates'
      ), 0) AS concentrate_kg,
      -- Get animal count for consumption estimate
      (SELECT COUNT(*) FROM animals a WHERE a.farm_id = f.id AND a.is_deleted = false AND a.exit_date IS NULL) AS animal_count
    FROM farms f
    WHERE f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  ),
  farm_with_days AS (
    SELECT 
      ffs.*,
      -- Estimate daily consumption: ~15kg roughage per animal per day (average)
      CASE 
        WHEN ffs.animal_count > 0 THEN 
          ROUND(ffs.roughage_kg / (ffs.animal_count * 15.0), 1)
        ELSE NULL 
      END AS estimated_feed_days
    FROM farm_feed_status ffs
  ),
  categorized AS (
    SELECT 
      fwd.*,
      CASE 
        WHEN fwd.estimated_feed_days IS NULL OR fwd.animal_count = 0 THEN 'unknown'
        WHEN fwd.estimated_feed_days < 7 THEN 'critical'
        WHEN fwd.estimated_feed_days < 30 THEN 'low'
        ELSE 'adequate'
      END AS feed_status
    FROM farm_with_days fwd
  )
  SELECT 
    c.region::TEXT,
    c.province::TEXT,
    COUNT(DISTINCT c.farm_id)::INT AS total_farms,
    COUNT(DISTINCT CASE WHEN c.feed_status = 'critical' THEN c.farm_id END)::INT AS critical_feed_farms,
    COUNT(DISTINCT CASE WHEN c.feed_status = 'low' THEN c.farm_id END)::INT AS low_feed_farms,
    COUNT(DISTINCT CASE WHEN c.feed_status = 'adequate' THEN c.farm_id END)::INT AS adequate_feed_farms,
    SUM(c.roughage_kg)::NUMERIC AS total_roughage_kg,
    SUM(c.concentrate_kg)::NUMERIC AS total_concentrate_kg,
    ROUND(AVG(NULLIF(c.estimated_feed_days, 0)), 1)::NUMERIC AS avg_feed_stock_days,
    ROUND(COUNT(DISTINCT CASE WHEN c.feed_status = 'critical' THEN c.farm_id END)::NUMERIC * 100 / NULLIF(COUNT(DISTINCT c.farm_id), 0), 1)::NUMERIC AS critical_percentage,
    ROUND(COUNT(DISTINCT CASE WHEN c.feed_status = 'low' THEN c.farm_id END)::NUMERIC * 100 / NULLIF(COUNT(DISTINCT c.farm_id), 0), 1)::NUMERIC AS low_percentage
  FROM categorized c
  WHERE c.region IS NOT NULL
  GROUP BY c.region, c.province
  ORDER BY critical_percentage DESC NULLS LAST, low_percentage DESC NULLS LAST;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_regional_feed_security TO authenticated;

-- ===================================================
-- Priority 3: Market Price Intelligence
-- ===================================================

-- Create RPC for getting regional market prices
CREATE OR REPLACE FUNCTION public.get_regional_market_prices(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  livestock_type TEXT,
  region TEXT,
  avg_price_per_kg NUMERIC,
  min_price NUMERIC,
  max_price NUMERIC,
  price_volatility NUMERIC,
  sample_count INT,
  latest_price NUMERIC,
  latest_date DATE,
  price_trend TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH price_data AS (
    SELECT 
      mp.livestock_type,
      COALESCE(mp.region, 'National') AS region,
      mp.price_per_kg,
      mp.effective_date,
      mp.source
    FROM market_prices mp
    WHERE mp.effective_date >= start_date
      AND mp.effective_date <= end_date
      AND (region_filter IS NULL OR mp.region = region_filter OR mp.region IS NULL)
  ),
  latest_prices AS (
    SELECT DISTINCT ON (pd.livestock_type, pd.region)
      pd.livestock_type,
      pd.region,
      pd.price_per_kg AS latest_price,
      pd.effective_date AS latest_date
    FROM price_data pd
    ORDER BY pd.livestock_type, pd.region, pd.effective_date DESC
  ),
  price_stats AS (
    SELECT 
      pd.livestock_type,
      pd.region,
      AVG(pd.price_per_kg)::NUMERIC AS avg_price,
      MIN(pd.price_per_kg)::NUMERIC AS min_price,
      MAX(pd.price_per_kg)::NUMERIC AS max_price,
      STDDEV(pd.price_per_kg)::NUMERIC AS volatility,
      COUNT(*)::INT AS sample_count
    FROM price_data pd
    GROUP BY pd.livestock_type, pd.region
  ),
  early_prices AS (
    SELECT 
      pd.livestock_type,
      pd.region,
      AVG(pd.price_per_kg) AS early_avg
    FROM price_data pd
    WHERE pd.effective_date < start_date + ((end_date - start_date) / 2)
    GROUP BY pd.livestock_type, pd.region
  ),
  late_prices AS (
    SELECT 
      pd.livestock_type,
      pd.region,
      AVG(pd.price_per_kg) AS late_avg
    FROM price_data pd
    WHERE pd.effective_date >= start_date + ((end_date - start_date) / 2)
    GROUP BY pd.livestock_type, pd.region
  )
  SELECT 
    ps.livestock_type::TEXT,
    ps.region::TEXT,
    ROUND(ps.avg_price, 2) AS avg_price_per_kg,
    ROUND(ps.min_price, 2) AS min_price,
    ROUND(ps.max_price, 2) AS max_price,
    ROUND(COALESCE(ps.volatility, 0), 2) AS price_volatility,
    ps.sample_count,
    ROUND(lp.latest_price, 2) AS latest_price,
    lp.latest_date,
    CASE 
      WHEN COALESCE(ep.early_avg, 0) = 0 THEN 'stable'
      WHEN (COALESCE(ltp.late_avg, 0) - ep.early_avg) / ep.early_avg > 0.05 THEN 'rising'
      WHEN (COALESCE(ltp.late_avg, 0) - ep.early_avg) / ep.early_avg < -0.05 THEN 'falling'
      ELSE 'stable'
    END::TEXT AS price_trend
  FROM price_stats ps
  LEFT JOIN latest_prices lp ON ps.livestock_type = lp.livestock_type AND ps.region = lp.region
  LEFT JOIN early_prices ep ON ps.livestock_type = ep.livestock_type AND ps.region = ep.region
  LEFT JOIN late_prices ltp ON ps.livestock_type = ltp.livestock_type AND ps.region = ltp.region
  ORDER BY ps.livestock_type, ps.region;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_regional_market_prices TO authenticated;

-- ===================================================
-- Priority 4: Farm Operational Compliance Metrics
-- ===================================================

-- Create RPC for getting farm compliance metrics
CREATE OR REPLACE FUNCTION public.get_farm_compliance_metrics(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  region TEXT,
  province TEXT,
  total_farms INT,
  farms_with_milking_logs INT,
  farms_with_feeding_logs INT,
  farms_with_health_logs INT,
  avg_milking_completion NUMERIC,
  avg_feeding_completion NUMERIC,
  high_compliance_farms INT,
  low_compliance_farms INT,
  compliance_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH farm_activity AS (
    SELECT 
      f.id AS farm_id,
      f.region,
      f.province,
      -- Count farms with milking logs in period
      (SELECT COUNT(DISTINCT mr.milking_date::DATE) 
       FROM milking_records mr 
       JOIN animals a ON mr.animal_id = a.id 
       WHERE a.farm_id = f.id 
         AND mr.milking_date >= start_date 
         AND mr.milking_date <= end_date) AS milking_days,
      -- Count farms with feeding logs in period
      (SELECT COUNT(DISTINCT fr.record_datetime::DATE) 
       FROM feeding_records fr 
       JOIN animals a ON fr.animal_id = a.id 
       WHERE a.farm_id = f.id 
         AND fr.record_datetime >= start_date 
         AND fr.record_datetime <= end_date) AS feeding_days,
      -- Count farms with health logs in period
      (SELECT COUNT(*) 
       FROM health_records hr 
       JOIN animals a ON hr.animal_id = a.id 
       WHERE a.farm_id = f.id 
         AND hr.record_date >= start_date 
         AND hr.record_date <= end_date) AS health_events,
      -- Total days in period
      (end_date - start_date + 1) AS total_days
    FROM farms f
    WHERE f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
  ),
  farm_compliance AS (
    SELECT 
      fa.*,
      ROUND(fa.milking_days::NUMERIC * 100 / NULLIF(fa.total_days, 0), 1) AS milking_completion,
      ROUND(fa.feeding_days::NUMERIC * 100 / NULLIF(fa.total_days, 0), 1) AS feeding_completion,
      CASE 
        WHEN fa.milking_days >= fa.total_days * 0.8 AND fa.feeding_days >= fa.total_days * 0.5 THEN 'high'
        WHEN fa.milking_days >= fa.total_days * 0.3 OR fa.feeding_days >= fa.total_days * 0.3 THEN 'medium'
        ELSE 'low'
      END AS compliance_level
    FROM farm_activity fa
  )
  SELECT 
    fc.region::TEXT,
    fc.province::TEXT,
    COUNT(DISTINCT fc.farm_id)::INT AS total_farms,
    COUNT(DISTINCT CASE WHEN fc.milking_days > 0 THEN fc.farm_id END)::INT AS farms_with_milking_logs,
    COUNT(DISTINCT CASE WHEN fc.feeding_days > 0 THEN fc.farm_id END)::INT AS farms_with_feeding_logs,
    COUNT(DISTINCT CASE WHEN fc.health_events > 0 THEN fc.farm_id END)::INT AS farms_with_health_logs,
    ROUND(AVG(fc.milking_completion), 1)::NUMERIC AS avg_milking_completion,
    ROUND(AVG(fc.feeding_completion), 1)::NUMERIC AS avg_feeding_completion,
    COUNT(DISTINCT CASE WHEN fc.compliance_level = 'high' THEN fc.farm_id END)::INT AS high_compliance_farms,
    COUNT(DISTINCT CASE WHEN fc.compliance_level = 'low' THEN fc.farm_id END)::INT AS low_compliance_farms,
    ROUND(COUNT(DISTINCT CASE WHEN fc.compliance_level IN ('high', 'medium') THEN fc.farm_id END)::NUMERIC * 100 / NULLIF(COUNT(DISTINCT fc.farm_id), 0), 1)::NUMERIC AS compliance_rate
  FROM farm_compliance fc
  WHERE fc.region IS NOT NULL
  GROUP BY fc.region, fc.province
  ORDER BY compliance_rate DESC NULLS LAST;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_farm_compliance_metrics TO authenticated;