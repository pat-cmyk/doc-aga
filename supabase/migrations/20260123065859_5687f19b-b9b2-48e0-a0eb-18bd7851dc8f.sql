-- Update the get_combined_dashboard_data function to use explicit category column
-- instead of keyword matching for concentrate vs roughage calculations

CREATE OR REPLACE FUNCTION public.get_combined_dashboard_data(
  p_farm_id uuid,
  p_start_date text,
  p_end_date text,
  p_monthly_start_date text,
  p_monthly_end_date text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_stats jsonb;
  v_daily_milk jsonb;
  v_monthly_headcount jsonb;
  v_total_animals integer;
  v_lactating_count integer;
  v_avg_milk numeric;
  v_concentrate_kg numeric;
  v_roughage_kg numeric;
  v_total_feed_kg numeric;
  v_stage_keys text[];
BEGIN
  -- Get total animals count
  SELECT COUNT(*) INTO v_total_animals
  FROM animals
  WHERE farm_id = p_farm_id AND status = 'active';

  -- Get lactating count
  SELECT COUNT(*) INTO v_lactating_count
  FROM animals
  WHERE farm_id = p_farm_id 
    AND status = 'active' 
    AND gender = 'Female'
    AND (is_lactating = true OR milking_status = 'Lactating');

  -- Get average daily milk for the period
  SELECT COALESCE(AVG(daily_total), 0) INTO v_avg_milk
  FROM (
    SELECT DATE(record_datetime) as record_date, SUM(liters) as daily_total
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND DATE(record_datetime) BETWEEN p_start_date::date AND p_end_date::date
    GROUP BY DATE(record_datetime)
  ) daily_totals;

  -- Get feed inventory using EXPLICIT CATEGORY COLUMN instead of keyword matching
  SELECT 
    COALESCE(SUM(CASE 
      WHEN category IN ('concentrates', 'minerals', 'supplements') THEN quantity_kg 
      ELSE 0 
    END), 0),
    COALESCE(SUM(CASE 
      WHEN category = 'roughage' OR category IS NULL THEN quantity_kg 
      ELSE 0 
    END), 0),
    COALESCE(SUM(quantity_kg), 0)
  INTO v_concentrate_kg, v_roughage_kg, v_total_feed_kg
  FROM feed_inventory
  WHERE farm_id = p_farm_id;

  -- Build stats object
  v_stats := jsonb_build_object(
    'totalAnimals', v_total_animals,
    'lactatingCount', v_lactating_count,
    'averageMilk', ROUND(v_avg_milk::numeric, 1),
    'concentrateKg', ROUND(v_concentrate_kg::numeric, 1),
    'roughageKg', ROUND(v_roughage_kg::numeric, 1),
    'totalFeedKg', ROUND(v_total_feed_kg::numeric, 1)
  );

  -- Get daily milk production data
  SELECT COALESCE(jsonb_agg(daily_data ORDER BY record_date), '[]'::jsonb) INTO v_daily_milk
  FROM (
    SELECT 
      DATE(record_datetime) as record_date,
      SUM(liters) as total_liters,
      COUNT(DISTINCT animal_id) as animal_count
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND DATE(record_datetime) BETWEEN p_start_date::date AND p_end_date::date
    GROUP BY DATE(record_datetime)
  ) daily_data;

  -- Get monthly headcount data with stage breakdown
  WITH stage_data AS (
    SELECT 
      DATE_TRUNC('month', snapshot_date) as month,
      stage,
      AVG(count) as avg_count
    FROM herd_stage_snapshots
    WHERE farm_id = p_farm_id
      AND snapshot_date BETWEEN p_monthly_start_date::date AND p_monthly_end_date::date
    GROUP BY DATE_TRUNC('month', snapshot_date), stage
  ),
  months AS (
    SELECT DISTINCT DATE_TRUNC('month', snapshot_date) as month
    FROM herd_stage_snapshots
    WHERE farm_id = p_farm_id
      AND snapshot_date BETWEEN p_monthly_start_date::date AND p_monthly_end_date::date
  ),
  all_stages AS (
    SELECT DISTINCT stage FROM stage_data
  )
  SELECT 
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'month', TO_CHAR(m.month, 'Mon YYYY'),
        'stages', (
          SELECT jsonb_object_agg(s.stage, COALESCE(sd.avg_count, 0))
          FROM all_stages s
          LEFT JOIN stage_data sd ON sd.month = m.month AND sd.stage = s.stage
        )
      )
      ORDER BY m.month
    ), '[]'::jsonb),
    ARRAY(SELECT DISTINCT stage FROM stage_data ORDER BY stage)
  INTO v_monthly_headcount, v_stage_keys
  FROM months m;

  -- Build final result
  v_result := jsonb_build_object(
    'stats', v_stats,
    'dailyMilk', v_daily_milk,
    'monthlyHeadcount', v_monthly_headcount,
    'stageKeys', to_jsonb(v_stage_keys)
  );

  RETURN v_result;
END;
$$;