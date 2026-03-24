-- Migration: Government Feed Consumption RPC
--
-- Creates a cross-farm feed consumption aggregation RPC for the government
-- dashboard, mirroring the pattern of get_government_milk_analytics.
-- Data source: daily_farm_stats.total_feed_kg (maintained by the
-- aggregate_feed_to_daily_stats trigger on feeding_records).

CREATE OR REPLACE FUNCTION get_government_feed_consumption(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT 'live'
)
RETURNS TABLE (
  report_date DATE,
  total_feed_kg NUMERIC,
  total_farms_feeding BIGINT,
  total_animals_fed BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify government role
  IF NOT has_role(auth.uid(), 'government'::user_role) THEN
    RAISE EXCEPTION 'Access denied: government role required';
  END IF;

  RETURN QUERY
  SELECT
    dfs.stat_date AS report_date,
    COALESCE(SUM(dfs.total_feed_kg), 0)::NUMERIC AS total_feed_kg,
    COUNT(DISTINCT dfs.farm_id)::BIGINT AS total_farms_feeding,
    COALESCE(SUM(dfs.feed_animal_count), 0)::BIGINT AS total_animals_fed
  FROM daily_farm_stats dfs
  JOIN farms f ON f.id = dfs.farm_id
  WHERE dfs.stat_date BETWEEN start_date AND end_date
    AND f.is_deleted = false
    AND (data_category_filter IS NULL OR data_category_filter = 'all' OR f.data_category = data_category_filter)
    AND (region_filter IS NULL OR f.region = region_filter)
    AND (province_filter IS NULL OR f.province = province_filter)
    AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
    AND dfs.total_feed_kg > 0
  GROUP BY dfs.stat_date
  ORDER BY dfs.stat_date;
END;
$$;
