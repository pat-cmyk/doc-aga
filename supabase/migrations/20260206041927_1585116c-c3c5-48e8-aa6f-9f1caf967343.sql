-- Fix get_regional_pcrs_summary to use correct fertility_status enum value ('confirmed_pregnant' not 'pregnant')

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
      AND a.fertility_status = 'confirmed_pregnant'
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