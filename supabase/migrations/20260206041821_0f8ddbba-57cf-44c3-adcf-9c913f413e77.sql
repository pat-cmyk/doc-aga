-- Fix RPC Column References: get_regional_data_quality, get_regional_pcrs_summary, get_farm_compliance_metrics

-- =============================================================================
-- FIX 1: get_regional_data_quality - Fix milking_records and health_records columns
-- =============================================================================
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
  RETURN QUERY
  WITH farm_base AS (
    SELECT 
      f.id AS farm_id,
      COALESCE(f.region, 'Unknown') AS farm_region,
      COALESCE(f.province, 'Unknown') AS farm_province,
      f.gps_lat,
      f.gps_lng
    FROM farms f
    WHERE f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region ILIKE '%' || region_filter || '%')
      AND (province_filter IS NULL OR f.province ILIKE '%' || province_filter || '%')
      AND (municipality_filter IS NULL OR f.municipality ILIKE '%' || municipality_filter || '%')
  ),
  animal_weights AS (
    SELECT 
      a.farm_id,
      COUNT(*) AS total_animals,
      COUNT(*) FILTER (WHERE a.entry_weight_kg IS NOT NULL OR a.birth_weight_kg IS NOT NULL OR a.entry_weight_unknown = true) AS animals_with_weight
    FROM animals a
    JOIN farm_base fb ON a.farm_id = fb.farm_id
    WHERE a.is_deleted = false AND a.exit_date IS NULL
    GROUP BY a.farm_id
  ),
  production_logs AS (
    SELECT DISTINCT mr.animal_id
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    JOIN farm_base fb ON a.farm_id = fb.farm_id
    WHERE mr.record_date >= CURRENT_DATE - INTERVAL '30 days'
  ),
  farms_with_production AS (
    SELECT DISTINCT a.farm_id
    FROM animals a
    JOIN production_logs pl ON a.id = pl.animal_id
  ),
  health_logs AS (
    SELECT DISTINCT hr.animal_id
    FROM health_records hr
    JOIN animals a ON hr.animal_id = a.id
    JOIN farm_base fb ON a.farm_id = fb.farm_id
    WHERE hr.visit_date >= CURRENT_DATE - INTERVAL '90 days'
  ),
  farms_with_health AS (
    SELECT DISTINCT a.farm_id
    FROM animals a
    JOIN health_logs hl ON a.id = hl.animal_id
  ),
  regional_stats AS (
    SELECT
      fb.farm_region,
      fb.farm_province,
      COUNT(DISTINCT fb.farm_id) AS total_farms,
      COUNT(DISTINCT fb.farm_id) FILTER (WHERE fb.gps_lat IS NOT NULL AND fb.gps_lng IS NOT NULL AND fb.gps_lat != 0 AND fb.gps_lng != 0) AS farms_with_gps,
      COALESCE(SUM(aw.total_animals), 0) AS total_animals,
      COALESCE(SUM(aw.animals_with_weight), 0) AS animals_with_weight,
      COUNT(DISTINCT fwp.farm_id) AS farms_with_production_logs,
      COUNT(DISTINCT fwh.farm_id) AS farms_with_health_logs
    FROM farm_base fb
    LEFT JOIN animal_weights aw ON fb.farm_id = aw.farm_id
    LEFT JOIN farms_with_production fwp ON fb.farm_id = fwp.farm_id
    LEFT JOIN farms_with_health fwh ON fb.farm_id = fwh.farm_id
    GROUP BY fb.farm_region, fb.farm_province
  )
  SELECT
    rs.farm_region::TEXT AS region,
    rs.farm_province::TEXT AS province,
    rs.total_farms,
    rs.farms_with_gps,
    CASE WHEN rs.total_farms > 0 THEN ROUND((rs.farms_with_gps::NUMERIC / rs.total_farms) * 100, 1) ELSE 0 END AS gps_coverage_pct,
    rs.total_animals,
    rs.animals_with_weight,
    CASE WHEN rs.total_animals > 0 THEN ROUND((rs.animals_with_weight::NUMERIC / rs.total_animals) * 100, 1) ELSE 0 END AS weight_completeness_pct,
    rs.farms_with_production_logs,
    CASE WHEN rs.total_farms > 0 THEN ROUND((rs.farms_with_production_logs::NUMERIC / rs.total_farms) * 100, 1) ELSE 0 END AS production_tracking_pct,
    rs.farms_with_health_logs,
    CASE WHEN rs.total_farms > 0 THEN ROUND((rs.farms_with_health_logs::NUMERIC / rs.total_farms) * 100, 1) ELSE 0 END AS health_recording_pct,
    CASE WHEN rs.total_farms > 0 THEN ROUND(
      (
        (CASE WHEN rs.total_farms > 0 THEN (rs.farms_with_gps::NUMERIC / rs.total_farms) ELSE 0 END) * 25 +
        (CASE WHEN rs.total_animals > 0 THEN (rs.animals_with_weight::NUMERIC / rs.total_animals) ELSE 0 END) * 25 +
        (CASE WHEN rs.total_farms > 0 THEN (rs.farms_with_production_logs::NUMERIC / rs.total_farms) ELSE 0 END) * 25 +
        (CASE WHEN rs.total_farms > 0 THEN (rs.farms_with_health_logs::NUMERIC / rs.total_farms) ELSE 0 END) * 25
      ), 1
    ) ELSE 0 END AS overall_quality_score
  FROM regional_stats rs
  ORDER BY rs.farm_region, rs.farm_province;
END;
$$;

-- =============================================================================
-- FIX 2: get_regional_pcrs_summary - Fix health_records column (hr.record_date -> hr.visit_date)
-- =============================================================================
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
  RETURN QUERY
  WITH pregnant_animals AS (
    SELECT 
      a.id AS animal_id,
      a.farm_id,
      a.livestock_type,
      a.parity,
      ai.expected_delivery_date,
      f.region AS farm_region,
      f.province AS farm_province
    FROM animals a
    JOIN farms f ON a.farm_id = f.id
    JOIN ai_records ai ON a.id = ai.animal_id
    WHERE a.is_deleted = false
      AND a.exit_date IS NULL
      AND a.fertility_status = 'pregnant'
      AND ai.pregnancy_confirmed = true
      AND ai.expected_delivery_date IS NOT NULL
      AND ai.expected_delivery_date >= CURRENT_DATE
      AND f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region ILIKE '%' || region_filter || '%')
      AND (province_filter IS NULL OR f.province ILIKE '%' || province_filter || '%')
      AND (municipality_filter IS NULL OR f.municipality ILIKE '%' || municipality_filter || '%')
  ),
  animal_bcs AS (
    SELECT DISTINCT ON (bcs.animal_id)
      bcs.animal_id,
      bcs.score,
      bcs.assessment_date
    FROM body_condition_scores bcs
    JOIN pregnant_animals pa ON bcs.animal_id = pa.animal_id
    ORDER BY bcs.animal_id, bcs.assessment_date DESC
  ),
  animal_health_issues AS (
    SELECT 
      hr.animal_id,
      COUNT(*) AS health_issue_count
    FROM health_records hr
    JOIN pregnant_animals pa ON hr.animal_id = pa.animal_id
    WHERE hr.visit_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY hr.animal_id
  ),
  pcrs_scores AS (
    SELECT
      pa.animal_id,
      pa.farm_region,
      pa.farm_province,
      pa.expected_delivery_date,
      TO_CHAR(pa.expected_delivery_date, 'YYYY-MM') AS delivery_month,
      -- Calculate PCRS score (0-100)
      LEAST(100, GREATEST(0,
        -- Timeline proximity (35 points max)
        CASE 
          WHEN pa.expected_delivery_date - CURRENT_DATE <= 7 THEN 35
          WHEN pa.expected_delivery_date - CURRENT_DATE <= 14 THEN 28
          WHEN pa.expected_delivery_date - CURRENT_DATE <= 21 THEN 21
          WHEN pa.expected_delivery_date - CURRENT_DATE <= 30 THEN 14
          ELSE 7
        END +
        -- BCS risk (25 points max)
        CASE 
          WHEN ab.score IS NULL THEN 15  -- Missing BCS penalty
          WHEN ab.score < 2.5 THEN 25    -- Thin
          WHEN ab.score > 4.0 THEN 20    -- Overconditioned
          WHEN ab.score < 3.0 OR ab.score > 3.5 THEN 10  -- Suboptimal
          ELSE 0                          -- Optimal (2.5-3.5)
        END +
        -- Parity risk (15 points max)
        CASE 
          WHEN pa.parity IS NULL OR pa.parity = 0 THEN 15  -- Heifer
          WHEN pa.parity >= 5 THEN 10                       -- High parity
          ELSE 0
        END +
        -- Health history (15 points max)
        CASE 
          WHEN COALESCE(ahi.health_issue_count, 0) >= 3 THEN 15
          WHEN COALESCE(ahi.health_issue_count, 0) >= 1 THEN 8
          ELSE 0
        END +
        -- Data freshness (10 points max) - BCS age
        CASE 
          WHEN ab.assessment_date IS NULL THEN 10
          WHEN CURRENT_DATE - ab.assessment_date > 60 THEN 8
          WHEN CURRENT_DATE - ab.assessment_date > 30 THEN 4
          ELSE 0
        END
      )) AS risk_score
    FROM pregnant_animals pa
    LEFT JOIN animal_bcs ab ON pa.animal_id = ab.animal_id
    LEFT JOIN animal_health_issues ahi ON pa.animal_id = ahi.animal_id
  ),
  scored_with_tiers AS (
    SELECT
      ps.*,
      CASE 
        WHEN ps.risk_score >= 75 THEN 'critical'
        WHEN ps.risk_score >= 50 THEN 'high'
        WHEN ps.risk_score >= 25 THEN 'moderate'
        ELSE 'low'
      END AS risk_tier
    FROM pcrs_scores ps
  ),
  regional_summary AS (
    SELECT
      st.farm_region,
      st.farm_province,
      COUNT(*) AS total_pregnant,
      COUNT(*) FILTER (WHERE st.risk_tier = 'critical') AS critical_count,
      COUNT(*) FILTER (WHERE st.risk_tier = 'high') AS high_count,
      COUNT(*) FILTER (WHERE st.risk_tier = 'moderate') AS moderate_count,
      COUNT(*) FILTER (WHERE st.risk_tier = 'low') AS low_count,
      ROUND(AVG(st.risk_score), 1) AS avg_risk_score
    FROM scored_with_tiers st
    GROUP BY st.farm_region, st.farm_province
  ),
  monthly_data AS (
    SELECT
      st.farm_region,
      st.farm_province,
      st.delivery_month,
      COUNT(*) AS month_total,
      COUNT(*) FILTER (WHERE st.risk_tier = 'critical') AS month_critical,
      COUNT(*) FILTER (WHERE st.risk_tier = 'high') AS month_high,
      COUNT(*) FILTER (WHERE st.risk_tier = 'moderate') AS month_moderate,
      COUNT(*) FILTER (WHERE st.risk_tier = 'low') AS month_low
    FROM scored_with_tiers st
    GROUP BY st.farm_region, st.farm_province, st.delivery_month
  ),
  monthly_aggregated AS (
    SELECT
      md.farm_region,
      md.farm_province,
      jsonb_object_agg(
        md.delivery_month,
        jsonb_build_object(
          'total', md.month_total,
          'critical', md.month_critical,
          'high', md.month_high,
          'moderate', md.month_moderate,
          'low', md.month_low
        )
      ) AS monthly_breakdown
    FROM monthly_data md
    GROUP BY md.farm_region, md.farm_province
  )
  SELECT
    COALESCE(rs.farm_region, 'Unknown')::TEXT AS region,
    COALESCE(rs.farm_province, 'Unknown')::TEXT AS province,
    rs.total_pregnant,
    rs.critical_count,
    rs.high_count,
    rs.moderate_count,
    rs.low_count,
    rs.avg_risk_score,
    COALESCE(ma.monthly_breakdown, '{}'::JSONB) AS monthly_breakdown
  FROM regional_summary rs
  LEFT JOIN monthly_aggregated ma ON rs.farm_region = ma.farm_region AND rs.farm_province = ma.farm_province
  ORDER BY rs.avg_risk_score DESC, rs.farm_region, rs.farm_province;
END;
$$;

-- =============================================================================
-- FIX 3: get_farm_compliance_metrics - Fix milking_records and health_records columns
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_farm_compliance_metrics(
  start_date DATE,
  end_date DATE,
  region_filter TEXT DEFAULT NULL,
  province_filter TEXT DEFAULT NULL,
  data_category_filter TEXT DEFAULT NULL
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
DECLARE
  date_range_days INTEGER;
BEGIN
  date_range_days := end_date - start_date + 1;
  
  RETURN QUERY
  WITH farm_base AS (
    SELECT 
      f.id AS farm_id,
      COALESCE(f.region, 'Unknown') AS farm_region,
      COALESCE(f.province, 'Unknown') AS farm_province
    FROM farms f
    WHERE f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region ILIKE '%' || region_filter || '%')
      AND (province_filter IS NULL OR f.province ILIKE '%' || province_filter || '%')
  ),
  farm_milking_animals AS (
    SELECT 
      a.farm_id,
      COUNT(DISTINCT a.id) AS milking_animal_count
    FROM animals a
    JOIN farm_base fb ON a.farm_id = fb.farm_id
    WHERE a.is_deleted = false 
      AND a.exit_date IS NULL
      AND a.is_currently_lactating = true
    GROUP BY a.farm_id
  ),
  farm_milking_days AS (
    SELECT 
      a.farm_id,
      COUNT(DISTINCT mr.record_date) AS days_with_milking
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    JOIN farm_base fb ON a.farm_id = fb.farm_id
    WHERE mr.record_date BETWEEN start_date AND end_date
    GROUP BY a.farm_id
  ),
  farm_feeding_days AS (
    SELECT 
      a.farm_id,
      COUNT(DISTINCT DATE(fr.record_datetime)) AS days_with_feeding
    FROM feeding_records fr
    JOIN animals a ON fr.animal_id = a.id
    JOIN farm_base fb ON a.farm_id = fb.farm_id
    WHERE DATE(fr.record_datetime) BETWEEN start_date AND end_date
    GROUP BY a.farm_id
  ),
  farm_health_logs AS (
    SELECT 
      a.farm_id,
      COUNT(DISTINCT hr.id) AS health_log_count
    FROM health_records hr
    JOIN animals a ON hr.animal_id = a.id
    JOIN farm_base fb ON a.farm_id = fb.farm_id
    WHERE hr.visit_date BETWEEN start_date AND end_date
    GROUP BY a.farm_id
  ),
  farm_metrics AS (
    SELECT
      fb.farm_id,
      fb.farm_region,
      fb.farm_province,
      COALESCE(fma.milking_animal_count, 0) AS milking_animal_count,
      COALESCE(fmd.days_with_milking, 0) AS days_with_milking,
      COALESCE(ffd.days_with_feeding, 0) AS days_with_feeding,
      COALESCE(fhl.health_log_count, 0) AS health_log_count,
      -- Milking completion: % of days with logs
      CASE 
        WHEN COALESCE(fma.milking_animal_count, 0) > 0 
        THEN LEAST(100, ROUND((COALESCE(fmd.days_with_milking, 0)::NUMERIC / date_range_days) * 100, 1))
        ELSE NULL  -- No milking animals, not applicable
      END AS milking_completion,
      -- Feeding completion: % of days with logs
      LEAST(100, ROUND((COALESCE(ffd.days_with_feeding, 0)::NUMERIC / date_range_days) * 100, 1)) AS feeding_completion
    FROM farm_base fb
    LEFT JOIN farm_milking_animals fma ON fb.farm_id = fma.farm_id
    LEFT JOIN farm_milking_days fmd ON fb.farm_id = fmd.farm_id
    LEFT JOIN farm_feeding_days ffd ON fb.farm_id = ffd.farm_id
    LEFT JOIN farm_health_logs fhl ON fb.farm_id = fhl.farm_id
  ),
  farm_compliance AS (
    SELECT
      fm.*,
      CASE 
        WHEN COALESCE(fm.milking_completion, 0) >= 70 AND fm.feeding_completion >= 50 THEN 'high'
        WHEN COALESCE(fm.milking_completion, 0) < 30 AND fm.feeding_completion < 30 THEN 'low'
        ELSE 'medium'
      END AS compliance_tier
    FROM farm_metrics fm
  )
  SELECT
    fc.farm_region::TEXT AS region,
    fc.farm_province::TEXT AS province,
    COUNT(DISTINCT fc.farm_id) AS total_farms,
    COUNT(DISTINCT fc.farm_id) FILTER (WHERE fc.days_with_milking > 0) AS farms_with_milking_logs,
    COUNT(DISTINCT fc.farm_id) FILTER (WHERE fc.days_with_feeding > 0) AS farms_with_feeding_logs,
    COUNT(DISTINCT fc.farm_id) FILTER (WHERE fc.health_log_count > 0) AS farms_with_health_logs,
    ROUND(AVG(COALESCE(fc.milking_completion, 0)), 1) AS avg_milking_completion,
    ROUND(AVG(fc.feeding_completion), 1) AS avg_feeding_completion,
    COUNT(DISTINCT fc.farm_id) FILTER (WHERE fc.compliance_tier = 'high') AS high_compliance_farms,
    COUNT(DISTINCT fc.farm_id) FILTER (WHERE fc.compliance_tier = 'low') AS low_compliance_farms,
    CASE 
      WHEN COUNT(DISTINCT fc.farm_id) > 0 
      THEN ROUND((COUNT(DISTINCT fc.farm_id) FILTER (WHERE fc.compliance_tier IN ('high', 'medium'))::NUMERIC / COUNT(DISTINCT fc.farm_id)) * 100, 1)
      ELSE 0 
    END AS compliance_rate
  FROM farm_compliance fc
  GROUP BY fc.farm_region, fc.farm_province
  ORDER BY fc.farm_region, fc.farm_province;
END;
$$;