-- Create function to get government health stats for Phase 1, 2, 3 data
CREATE OR REPLACE FUNCTION public.get_government_health_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL
)
RETURNS TABLE(
  -- Preventive Health Stats
  scheduled_vaccinations bigint,
  completed_vaccinations bigint,
  overdue_vaccinations bigint,
  scheduled_deworming bigint,
  completed_deworming bigint,
  vaccination_compliance_rate numeric,
  
  -- Heat Detection Stats
  heat_events_count bigint,
  avg_cycle_length_days numeric,
  animals_in_optimal_window bigint,
  
  -- Animal Exit Stats
  total_exits bigint,
  exits_sold bigint,
  exits_died bigint,
  exits_culled bigint,
  exits_transferred bigint,
  exits_slaughtered bigint,
  mortality_rate numeric,
  total_sales_revenue numeric,
  
  -- Body Condition Score Stats
  avg_bcs_score numeric,
  animals_underweight bigint,
  animals_optimal bigint,
  animals_overweight bigint,
  bcs_assessments_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check permissions
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'government'::user_role)) THEN
    RAISE EXCEPTION 'Access denied: Admin or Government role required';
  END IF;

  RETURN QUERY
  WITH filtered_farms AS (
    SELECT f.id
    FROM farms f
    WHERE f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  ),
  filtered_animals AS (
    SELECT a.id, a.farm_id, a.is_deleted, a.exit_date, a.exit_reason, a.sale_price
    FROM animals a
    INNER JOIN filtered_farms ff ON ff.id = a.farm_id
  ),
  -- Preventive Health Stats
  preventive_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE phs.schedule_type = 'vaccination' AND phs.status = 'scheduled') as sched_vacc,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'vaccination' AND phs.status = 'completed') as comp_vacc,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'vaccination' AND phs.status = 'scheduled' AND phs.scheduled_date < CURRENT_DATE) as overdue_vacc,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'deworming' AND phs.status = 'scheduled') as sched_dew,
      COUNT(*) FILTER (WHERE phs.schedule_type = 'deworming' AND phs.status = 'completed') as comp_dew
    FROM preventive_health_schedules phs
    INNER JOIN filtered_animals fa ON fa.id = phs.animal_id
    WHERE phs.created_at::date BETWEEN start_date AND end_date
       OR (phs.scheduled_date BETWEEN start_date AND end_date)
  ),
  -- Heat Detection Stats
  heat_stats AS (
    SELECT
      COUNT(*) as heat_count,
      AVG(
        CASE 
          WHEN prev_heat.detected_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (hr.detected_at - prev_heat.detected_at)) / 86400
          ELSE NULL
        END
      ) as avg_cycle,
      COUNT(*) FILTER (
        WHERE hr.optimal_breeding_start <= CURRENT_TIMESTAMP 
        AND hr.optimal_breeding_end >= CURRENT_TIMESTAMP
      ) as in_window
    FROM heat_records hr
    INNER JOIN filtered_animals fa ON fa.id = hr.animal_id
    LEFT JOIN LATERAL (
      SELECT detected_at
      FROM heat_records hr2
      WHERE hr2.animal_id = hr.animal_id
        AND hr2.detected_at < hr.detected_at
      ORDER BY hr2.detected_at DESC
      LIMIT 1
    ) prev_heat ON true
    WHERE hr.detected_at::date BETWEEN start_date AND end_date
  ),
  -- Animal Exit Stats
  exit_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE fa.exit_date IS NOT NULL) as total_exits,
      COUNT(*) FILTER (WHERE fa.exit_reason = 'sold') as sold,
      COUNT(*) FILTER (WHERE fa.exit_reason = 'died') as died,
      COUNT(*) FILTER (WHERE fa.exit_reason = 'culled') as culled,
      COUNT(*) FILTER (WHERE fa.exit_reason = 'transferred') as transferred,
      COUNT(*) FILTER (WHERE fa.exit_reason = 'slaughtered') as slaughtered,
      COALESCE(SUM(fa.sale_price) FILTER (WHERE fa.exit_reason = 'sold'), 0) as sales_total
    FROM filtered_animals fa
    WHERE fa.exit_date BETWEEN start_date AND end_date
  ),
  -- Mortality Rate (deaths / total animals)
  animal_counts AS (
    SELECT
      COUNT(*) as total_animals,
      COUNT(*) FILTER (WHERE fa.exit_reason = 'died' AND fa.exit_date BETWEEN start_date AND end_date) as deaths
    FROM filtered_animals fa
  ),
  -- Body Condition Score Stats
  bcs_stats AS (
    SELECT
      AVG(bcs.score) as avg_score,
      COUNT(*) FILTER (WHERE bcs.score < 2.5) as underweight,
      COUNT(*) FILTER (WHERE bcs.score >= 2.5 AND bcs.score <= 4.0) as optimal,
      COUNT(*) FILTER (WHERE bcs.score > 4.0) as overweight,
      COUNT(*) as total_assessments
    FROM body_condition_scores bcs
    INNER JOIN filtered_farms ff ON ff.id = bcs.farm_id
    WHERE bcs.assessment_date BETWEEN start_date AND end_date
  )
  SELECT
    -- Preventive Health
    COALESCE(ps.sched_vacc, 0)::bigint,
    COALESCE(ps.comp_vacc, 0)::bigint,
    COALESCE(ps.overdue_vacc, 0)::bigint,
    COALESCE(ps.sched_dew, 0)::bigint,
    COALESCE(ps.comp_dew, 0)::bigint,
    CASE 
      WHEN (COALESCE(ps.sched_vacc, 0) + COALESCE(ps.comp_vacc, 0)) > 0 
      THEN ROUND((COALESCE(ps.comp_vacc, 0)::numeric / (COALESCE(ps.sched_vacc, 0) + COALESCE(ps.comp_vacc, 0))::numeric) * 100, 1)
      ELSE 0
    END,
    
    -- Heat Detection
    COALESCE(hs.heat_count, 0)::bigint,
    COALESCE(ROUND(hs.avg_cycle, 1), 0),
    COALESCE(hs.in_window, 0)::bigint,
    
    -- Animal Exits
    COALESCE(es.total_exits, 0)::bigint,
    COALESCE(es.sold, 0)::bigint,
    COALESCE(es.died, 0)::bigint,
    COALESCE(es.culled, 0)::bigint,
    COALESCE(es.transferred, 0)::bigint,
    COALESCE(es.slaughtered, 0)::bigint,
    CASE 
      WHEN ac.total_animals > 0 
      THEN ROUND((ac.deaths::numeric / ac.total_animals::numeric) * 100, 2)
      ELSE 0
    END,
    COALESCE(es.sales_total, 0),
    
    -- BCS
    COALESCE(ROUND(bs.avg_score, 2), 0),
    COALESCE(bs.underweight, 0)::bigint,
    COALESCE(bs.optimal, 0)::bigint,
    COALESCE(bs.overweight, 0)::bigint,
    COALESCE(bs.total_assessments, 0)::bigint
  FROM preventive_stats ps
  CROSS JOIN heat_stats hs
  CROSS JOIN exit_stats es
  CROSS JOIN animal_counts ac
  CROSS JOIN bcs_stats bs;
END;
$function$;