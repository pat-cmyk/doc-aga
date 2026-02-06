-- ============================================
-- Function 1: get_regional_data_quality
-- Provides data quality metrics by region for government dashboard
-- ============================================
CREATE OR REPLACE FUNCTION public.get_regional_data_quality(
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  region TEXT,
  province TEXT,
  total_farms BIGINT,
  farms_with_gps BIGINT,
  gps_coverage_pct NUMERIC,
  total_animals BIGINT,
  animals_with_weight BIGINT,
  weight_completeness_pct NUMERIC,
  farms_with_production_logs BIGINT,
  production_tracking_pct NUMERIC,
  farms_with_health_logs BIGINT,
  health_recording_pct NUMERIC,
  overall_quality_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has government role
  IF NOT public.has_role(auth.uid(), 'government'::user_role) THEN
    RAISE EXCEPTION 'Access denied: government role required';
  END IF;

  RETURN QUERY
  WITH filtered_farms AS (
    SELECT 
      f.id AS farm_id,
      f.region,
      f.province,
      f.gps_lat,
      f.gps_lng
    FROM farms f
    WHERE f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
  ),
  farm_animals AS (
    SELECT 
      a.farm_id,
      a.id AS animal_id,
      CASE 
        WHEN a.farm_entry_date IS NOT NULL THEN
          CASE WHEN a.entry_weight_kg IS NOT NULL OR a.entry_weight_unknown = true THEN 1 ELSE 0 END
        ELSE
          CASE WHEN a.birth_weight_kg IS NOT NULL OR a.birth_date IS NULL THEN 1 ELSE 0 END
      END AS has_weight
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.farm_id
    WHERE a.is_deleted = false
      AND a.exit_date IS NULL
  ),
  farm_production AS (
    SELECT DISTINCT mr.animal_id
    FROM milking_records mr
    INNER JOIN farm_animals fa ON mr.animal_id = fa.animal_id
    WHERE mr.record_datetime >= NOW() - INTERVAL '30 days'
  ),
  farm_health AS (
    SELECT DISTINCT a.farm_id
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.farm_id
    WHERE a.is_deleted = false
      AND a.exit_date IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM health_records hr 
          WHERE hr.animal_id = a.id 
            AND hr.record_date >= NOW() - INTERVAL '90 days'
        )
        OR EXISTS (
          SELECT 1 FROM preventive_health_schedules phs 
          WHERE phs.animal_id = a.id
        )
      )
  ),
  regional_stats AS (
    SELECT 
      ff.region,
      ff.province,
      COUNT(DISTINCT ff.farm_id) AS total_farms,
      COUNT(DISTINCT CASE WHEN ff.gps_lat IS NOT NULL AND ff.gps_lng IS NOT NULL 
        AND ff.gps_lat != 0 AND ff.gps_lng != 0 THEN ff.farm_id END) AS farms_with_gps,
      COUNT(DISTINCT fa.animal_id) AS total_animals,
      SUM(fa.has_weight) AS animals_with_weight,
      COUNT(DISTINCT CASE WHEN fp.animal_id IS NOT NULL THEN 
        (SELECT farm_id FROM farm_animals WHERE animal_id = fp.animal_id LIMIT 1) 
      END) AS farms_with_production_logs,
      COUNT(DISTINCT fh.farm_id) AS farms_with_health_logs
    FROM filtered_farms ff
    LEFT JOIN farm_animals fa ON ff.farm_id = fa.farm_id
    LEFT JOIN farm_production fp ON fa.animal_id = fp.animal_id
    LEFT JOIN farm_health fh ON ff.farm_id = fh.farm_id
    GROUP BY ff.region, ff.province
  )
  SELECT 
    rs.region,
    rs.province,
    rs.total_farms,
    rs.farms_with_gps,
    CASE WHEN rs.total_farms > 0 
      THEN ROUND((rs.farms_with_gps::NUMERIC / rs.total_farms) * 100, 1) 
      ELSE 0 END AS gps_coverage_pct,
    rs.total_animals,
    COALESCE(rs.animals_with_weight, 0)::BIGINT AS animals_with_weight,
    CASE WHEN rs.total_animals > 0 
      THEN ROUND((COALESCE(rs.animals_with_weight, 0)::NUMERIC / rs.total_animals) * 100, 1) 
      ELSE 100 END AS weight_completeness_pct,
    rs.farms_with_production_logs,
    CASE WHEN rs.total_farms > 0 
      THEN ROUND((rs.farms_with_production_logs::NUMERIC / rs.total_farms) * 100, 1) 
      ELSE 0 END AS production_tracking_pct,
    rs.farms_with_health_logs,
    CASE WHEN rs.total_farms > 0 
      THEN ROUND((rs.farms_with_health_logs::NUMERIC / rs.total_farms) * 100, 1) 
      ELSE 0 END AS health_recording_pct,
    -- Overall quality score: weighted average of all metrics
    ROUND(
      (
        CASE WHEN rs.total_farms > 0 THEN (rs.farms_with_gps::NUMERIC / rs.total_farms) * 100 ELSE 0 END * 0.25 +
        CASE WHEN rs.total_animals > 0 THEN (COALESCE(rs.animals_with_weight, 0)::NUMERIC / rs.total_animals) * 100 ELSE 100 END * 0.25 +
        CASE WHEN rs.total_farms > 0 THEN (rs.farms_with_production_logs::NUMERIC / rs.total_farms) * 100 ELSE 0 END * 0.25 +
        CASE WHEN rs.total_farms > 0 THEN (rs.farms_with_health_logs::NUMERIC / rs.total_farms) * 100 ELSE 0 END * 0.25
      ), 1
    ) AS overall_quality_score
  FROM regional_stats rs
  WHERE rs.region IS NOT NULL
  ORDER BY rs.region, rs.province;
END;
$$;

-- ============================================
-- Function 2: get_regional_pcrs_summary
-- Provides Pre-Calving Risk Score aggregation by region
-- ============================================
CREATE OR REPLACE FUNCTION public.get_regional_pcrs_summary(
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  municipality_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  region TEXT,
  province TEXT,
  total_pregnant BIGINT,
  critical_count BIGINT,
  high_count BIGINT,
  moderate_count BIGINT,
  low_count BIGINT,
  avg_risk_score NUMERIC,
  monthly_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has government role
  IF NOT public.has_role(auth.uid(), 'government'::user_role) THEN
    RAISE EXCEPTION 'Access denied: government role required';
  END IF;

  RETURN QUERY
  WITH filtered_farms AS (
    SELECT f.id AS farm_id, f.region, f.province
    FROM farms f
    WHERE f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
  ),
  pregnant_animals AS (
    SELECT 
      a.id AS animal_id,
      a.parity,
      ff.region,
      ff.province,
      air.expected_delivery_date,
      EXTRACT(EPOCH FROM (air.expected_delivery_date::timestamp - NOW())) / 86400 AS days_until_delivery,
      TO_CHAR(air.expected_delivery_date::date, 'YYYY-MM') AS delivery_month
    FROM ai_records air
    INNER JOIN animals a ON air.animal_id = a.id
    INNER JOIN filtered_farms ff ON a.farm_id = ff.farm_id
    WHERE air.pregnancy_confirmed = true
      AND air.expected_delivery_date IS NOT NULL
      AND air.expected_delivery_date >= CURRENT_DATE
      AND a.is_deleted = false
      AND a.exit_date IS NULL
  ),
  animal_bcs AS (
    SELECT DISTINCT ON (bcs.animal_id)
      bcs.animal_id,
      bcs.score,
      bcs.assessment_date,
      EXTRACT(EPOCH FROM (NOW() - bcs.assessment_date::timestamp)) / 86400 AS days_since_bcs
    FROM body_condition_scores bcs
    INNER JOIN pregnant_animals pa ON bcs.animal_id = pa.animal_id
    ORDER BY bcs.animal_id, bcs.assessment_date DESC
  ),
  animal_health_issues AS (
    SELECT 
      hr.animal_id,
      COUNT(*) AS issue_count
    FROM health_records hr
    INNER JOIN pregnant_animals pa ON hr.animal_id = pa.animal_id
    WHERE hr.record_date >= NOW() - INTERVAL '90 days'
    GROUP BY hr.animal_id
  ),
  scored_animals AS (
    SELECT 
      pa.animal_id,
      pa.region,
      pa.province,
      pa.delivery_month,
      pa.days_until_delivery,
      -- Calculate PCRS components
      CASE 
        WHEN pa.days_until_delivery < 7 THEN 35
        WHEN pa.days_until_delivery <= 14 THEN 25
        WHEN pa.days_until_delivery <= 30 THEN 15
        WHEN pa.days_until_delivery <= 60 THEN 5
        ELSE 0
      END AS timeline_score,
      CASE 
        WHEN ab.score IS NULL THEN 5
        WHEN ab.score < 2.0 THEN 25
        WHEN ab.score < 2.5 THEN 15
        WHEN ab.score > 4.5 THEN 25
        WHEN ab.score > 4.0 THEN 10
        ELSE 0
      END AS bcs_score,
      CASE 
        WHEN pa.parity IS NULL THEN 5
        WHEN pa.parity = 0 THEN 15
        WHEN pa.parity <= 2 THEN 5
        ELSE 0
      END AS parity_score,
      CASE 
        WHEN COALESCE(ahi.issue_count, 0) >= 3 THEN 15
        WHEN COALESCE(ahi.issue_count, 0) = 2 THEN 10
        WHEN COALESCE(ahi.issue_count, 0) = 1 THEN 5
        ELSE 0
      END AS health_score,
      CASE 
        WHEN ab.days_since_bcs IS NULL THEN 10
        WHEN ab.days_since_bcs > 60 THEN 10
        WHEN ab.days_since_bcs > 30 THEN 5
        ELSE 0
      END AS data_freshness_score
    FROM pregnant_animals pa
    LEFT JOIN animal_bcs ab ON pa.animal_id = ab.animal_id
    LEFT JOIN animal_health_issues ahi ON pa.animal_id = ahi.animal_id
  ),
  animals_with_tier AS (
    SELECT 
      sa.*,
      (sa.timeline_score + sa.bcs_score + sa.parity_score + sa.health_score + sa.data_freshness_score) AS total_score,
      CASE 
        WHEN (sa.timeline_score + sa.bcs_score + sa.parity_score + sa.health_score + sa.data_freshness_score) >= 75 THEN 'critical'
        WHEN (sa.timeline_score + sa.bcs_score + sa.parity_score + sa.health_score + sa.data_freshness_score) >= 50 THEN 'high'
        WHEN (sa.timeline_score + sa.bcs_score + sa.parity_score + sa.health_score + sa.data_freshness_score) >= 25 THEN 'moderate'
        ELSE 'low'
      END AS tier
    FROM scored_animals sa
  ),
  regional_summary AS (
    SELECT 
      awt.region,
      awt.province,
      COUNT(*) AS total_pregnant,
      COUNT(*) FILTER (WHERE awt.tier = 'critical') AS critical_count,
      COUNT(*) FILTER (WHERE awt.tier = 'high') AS high_count,
      COUNT(*) FILTER (WHERE awt.tier = 'moderate') AS moderate_count,
      COUNT(*) FILTER (WHERE awt.tier = 'low') AS low_count,
      ROUND(AVG(awt.total_score), 1) AS avg_risk_score
    FROM animals_with_tier awt
    GROUP BY awt.region, awt.province
  ),
  monthly_data AS (
    SELECT 
      awt.region,
      awt.province,
      jsonb_object_agg(
        awt.delivery_month,
        jsonb_build_object(
          'total', month_counts.total,
          'critical', month_counts.critical,
          'high', month_counts.high,
          'moderate', month_counts.moderate,
          'low', month_counts.low
        )
      ) AS monthly_breakdown
    FROM animals_with_tier awt
    CROSS JOIN LATERAL (
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE a2.tier = 'critical') AS critical,
        COUNT(*) FILTER (WHERE a2.tier = 'high') AS high,
        COUNT(*) FILTER (WHERE a2.tier = 'moderate') AS moderate,
        COUNT(*) FILTER (WHERE a2.tier = 'low') AS low
      FROM animals_with_tier a2
      WHERE a2.region = awt.region 
        AND a2.province = awt.province
        AND a2.delivery_month = awt.delivery_month
    ) month_counts
    GROUP BY awt.region, awt.province
  )
  SELECT 
    rs.region,
    rs.province,
    rs.total_pregnant,
    rs.critical_count,
    rs.high_count,
    rs.moderate_count,
    rs.low_count,
    rs.avg_risk_score,
    COALESCE(md.monthly_breakdown, '{}'::jsonb) AS monthly_breakdown
  FROM regional_summary rs
  LEFT JOIN monthly_data md ON rs.region = md.region AND rs.province = md.province
  WHERE rs.region IS NOT NULL
  ORDER BY rs.avg_risk_score DESC, rs.region, rs.province;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_regional_data_quality TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_regional_pcrs_summary TO authenticated;