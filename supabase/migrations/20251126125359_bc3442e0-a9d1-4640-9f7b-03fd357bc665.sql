-- Create government breeding stats function
CREATE OR REPLACE FUNCTION public.get_government_breeding_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL,
  province_filter text DEFAULT NULL,
  municipality_filter text DEFAULT NULL
)
RETURNS TABLE(
  total_ai_scheduled bigint,
  total_ai_performed bigint,
  total_pregnancies_confirmed bigint,
  currently_pregnant bigint,
  ai_success_rate numeric,
  due_this_quarter bigint,
  cattle_success_rate numeric,
  goat_success_rate numeric,
  carabao_success_rate numeric,
  sheep_success_rate numeric,
  expected_deliveries_by_month jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  quarter_end_date date;
BEGIN
  -- Check permissions
  IF NOT (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'government'::user_role)) THEN
    RAISE EXCEPTION 'Access denied: Admin or Government role required';
  END IF;

  quarter_end_date := CURRENT_DATE + interval '90 days';

  RETURN QUERY
  WITH filtered_farms AS (
    SELECT f.id
    FROM farms f
    WHERE f.is_deleted = false
      AND (region_filter IS NULL OR f.region = region_filter)
      AND (province_filter IS NULL OR f.province = province_filter)
      AND (municipality_filter IS NULL OR f.municipality = municipality_filter)
  ),
  ai_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE air.scheduled_date IS NOT NULL) as scheduled_count,
      COUNT(*) FILTER (WHERE air.performed_date IS NOT NULL) as performed_count,
      COUNT(*) FILTER (WHERE air.pregnancy_confirmed = true) as confirmed_count,
      COUNT(*) FILTER (
        WHERE air.pregnancy_confirmed = true 
        AND air.expected_delivery_date IS NOT NULL
        AND air.expected_delivery_date >= CURRENT_DATE
      ) as currently_pregnant_count,
      COUNT(*) FILTER (
        WHERE air.pregnancy_confirmed = true 
        AND air.expected_delivery_date BETWEEN CURRENT_DATE AND quarter_end_date
      ) as due_quarter_count
    FROM ai_records air
    INNER JOIN animals a ON a.id = air.animal_id
    INNER JOIN filtered_farms ff ON ff.id = a.farm_id
    WHERE air.created_at::date BETWEEN start_date AND end_date
  ),
  livestock_success AS (
    SELECT
      a.livestock_type,
      COUNT(*) FILTER (WHERE air.performed_date IS NOT NULL) as performed,
      COUNT(*) FILTER (WHERE air.pregnancy_confirmed = true) as confirmed
    FROM ai_records air
    INNER JOIN animals a ON a.id = air.animal_id
    INNER JOIN filtered_farms ff ON ff.id = a.farm_id
    WHERE air.created_at::date BETWEEN start_date AND end_date
    GROUP BY a.livestock_type
  ),
  monthly_deliveries AS (
    SELECT
      TO_CHAR(air.expected_delivery_date, 'YYYY-MM') as month_key,
      a.livestock_type,
      COUNT(*) as count
    FROM ai_records air
    INNER JOIN animals a ON a.id = air.animal_id
    INNER JOIN filtered_farms ff ON ff.id = a.farm_id
    WHERE air.pregnancy_confirmed = true
      AND air.expected_delivery_date IS NOT NULL
      AND air.expected_delivery_date >= CURRENT_DATE
    GROUP BY TO_CHAR(air.expected_delivery_date, 'YYYY-MM'), a.livestock_type
  ),
  aggregated_monthly AS (
    SELECT jsonb_object_agg(
      month_key,
      jsonb_build_object(
        'total', month_total,
        'by_type', types_data
      )
    ) as deliveries_json
    FROM (
      SELECT
        month_key,
        SUM(count) as month_total,
        jsonb_object_agg(livestock_type, count) as types_data
      FROM monthly_deliveries
      GROUP BY month_key
    ) monthly_agg
  )
  SELECT
    COALESCE(ai.scheduled_count, 0)::bigint as total_ai_scheduled,
    COALESCE(ai.performed_count, 0)::bigint as total_ai_performed,
    COALESCE(ai.confirmed_count, 0)::bigint as total_pregnancies_confirmed,
    COALESCE(ai.currently_pregnant_count, 0)::bigint as currently_pregnant,
    CASE 
      WHEN COALESCE(ai.performed_count, 0) > 0 
      THEN ROUND((COALESCE(ai.confirmed_count, 0)::numeric / ai.performed_count::numeric) * 100, 1)
      ELSE 0
    END as ai_success_rate,
    COALESCE(ai.due_quarter_count, 0)::bigint as due_this_quarter,
    
    -- Livestock type specific success rates
    CASE 
      WHEN (SELECT performed FROM livestock_success WHERE livestock_type = 'cattle') > 0
      THEN ROUND((
        (SELECT confirmed FROM livestock_success WHERE livestock_type = 'cattle')::numeric / 
        (SELECT performed FROM livestock_success WHERE livestock_type = 'cattle')::numeric
      ) * 100, 1)
      ELSE 0
    END as cattle_success_rate,
    
    CASE 
      WHEN (SELECT performed FROM livestock_success WHERE livestock_type = 'goat') > 0
      THEN ROUND((
        (SELECT confirmed FROM livestock_success WHERE livestock_type = 'goat')::numeric / 
        (SELECT performed FROM livestock_success WHERE livestock_type = 'goat')::numeric
      ) * 100, 1)
      ELSE 0
    END as goat_success_rate,
    
    CASE 
      WHEN (SELECT performed FROM livestock_success WHERE livestock_type = 'carabao') > 0
      THEN ROUND((
        (SELECT confirmed FROM livestock_success WHERE livestock_type = 'carabao')::numeric / 
        (SELECT performed FROM livestock_success WHERE livestock_type = 'carabao')::numeric
      ) * 100, 1)
      ELSE 0
    END as carabao_success_rate,
    
    CASE 
      WHEN (SELECT performed FROM livestock_success WHERE livestock_type = 'sheep') > 0
      THEN ROUND((
        (SELECT confirmed FROM livestock_success WHERE livestock_type = 'sheep')::numeric / 
        (SELECT performed FROM livestock_success WHERE livestock_type = 'sheep')::numeric
      ) * 100, 1)
      ELSE 0
    END as sheep_success_rate,
    
    COALESCE(agg.deliveries_json, '{}'::jsonb) as expected_deliveries_by_month
  FROM ai_stats ai
  CROSS JOIN aggregated_monthly agg;
END;
$function$;