-- Drop and recreate the get_government_health_stats function with correct table references
DROP FUNCTION IF EXISTS public.get_government_health_stats(date, date, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_government_health_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL,
  data_category_filter text DEFAULT NULL
)
RETURNS TABLE (
  -- Vaccination stats (from preventive_health_schedules)
  vaccination_count bigint,
  vaccination_rate numeric,
  deworming_count bigint,
  -- Heat detection stats
  heat_detection_count bigint,
  avg_cycle_length numeric,
  optimal_breeding_window_count bigint,
  -- Mortality/exit stats
  mortality_count bigint,
  mortality_rate numeric,
  -- BCS stats
  avg_bcs numeric,
  animals_underweight bigint,
  animals_optimal bigint,
  animals_overweight bigint,
  bcs_assessments_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_farms AS (
    SELECT f.id as farm_id
    FROM farms f
    WHERE f.is_deleted = false
      AND (data_category_filter IS NULL OR f.data_category = data_category_filter)
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  ),
  farm_animals AS (
    SELECT a.id as animal_id, a.farm_id, a.livestock_type, a.exit_date, a.exit_reason
    FROM animals a
    INNER JOIN filtered_farms ff ON a.farm_id = ff.farm_id
    WHERE a.is_deleted = false
  ),
  -- Vaccination stats from preventive_health_schedules
  vaccination_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE phs.schedule_type = 'vaccination' AND phs.status = 'completed') as completed_vaccinations,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'vaccination') as total_vaccinations,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'deworming' AND phs.status = 'completed') as completed_deworming
    FROM preventive_health_schedules phs
    INNER JOIN farm_animals fa ON phs.animal_id = fa.animal_id
    WHERE phs.scheduled_date BETWEEN start_date AND end_date
  ),
  -- Heat detection stats
  heat_stats AS (
    SELECT 
      COUNT(*) as heat_count,
      AVG(hr.cycle_length_days) as avg_cycle,
      COUNT(*) FILTER (WHERE hr.optimal_breeding_window_start IS NOT NULL 
        AND hr.optimal_breeding_window_start BETWEEN start_date AND end_date) as optimal_window_count
    FROM heat_records hr
    INNER JOIN farm_animals fa ON hr.animal_id = fa.animal_id
    WHERE hr.detected_at::date BETWEEN start_date AND end_date
  ),
  -- Mortality/exit stats
  mortality_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE fa.exit_date BETWEEN start_date AND end_date) as total_exits,
      COUNT(*) FILTER (WHERE fa.exit_date BETWEEN start_date AND end_date AND fa.exit_reason = 'died') as deaths,
      (SELECT COUNT(*) FROM farm_animals) as total_animals
    FROM farm_animals fa
  ),
  -- BCS stats
  bcs_stats AS (
    SELECT 
      AVG(bcs.score) as avg_score,
      COUNT(*) FILTER (WHERE bcs.score < 2.5) as underweight,
      COUNT(*) FILTER (WHERE bcs.score >= 2.5 AND bcs.score <= 3.5) as optimal,
      COUNT(*) FILTER (WHERE bcs.score > 3.5) as overweight,
      COUNT(*) as total_assessments
    FROM body_condition_scores bcs
    INNER JOIN farm_animals fa ON bcs.animal_id = fa.animal_id
    WHERE bcs.assessment_date BETWEEN start_date AND end_date
  )
  SELECT 
    COALESCE(vs.completed_vaccinations, 0)::bigint as vaccination_count,
    CASE WHEN vs.total_vaccinations > 0 
      THEN ROUND((vs.completed_vaccinations::numeric / vs.total_vaccinations::numeric) * 100, 1)
      ELSE 0 
    END as vaccination_rate,
    COALESCE(vs.completed_deworming, 0)::bigint as deworming_count,
    COALESCE(hs.heat_count, 0)::bigint as heat_detection_count,
    COALESCE(ROUND(hs.avg_cycle, 1), 0) as avg_cycle_length,
    COALESCE(hs.optimal_window_count, 0)::bigint as optimal_breeding_window_count,
    COALESCE(ms.deaths, 0)::bigint as mortality_count,
    CASE WHEN ms.total_animals > 0 
      THEN ROUND((ms.deaths::numeric / ms.total_animals::numeric) * 100, 2)
      ELSE 0 
    END as mortality_rate,
    COALESCE(ROUND(bs.avg_score, 2), 0) as avg_bcs,
    COALESCE(bs.underweight, 0)::bigint as animals_underweight,
    COALESCE(bs.optimal, 0)::bigint as animals_optimal,
    COALESCE(bs.overweight, 0)::bigint as animals_overweight,
    COALESCE(bs.total_assessments, 0)::bigint as bcs_assessments_count
  FROM vaccination_stats vs
  CROSS JOIN heat_stats hs
  CROSS JOIN mortality_stats ms
  CROSS JOIN bcs_stats bs;
END;
$$;