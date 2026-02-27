-- Step 2: Create trigger function for feed aggregation
CREATE OR REPLACE FUNCTION public.aggregate_feed_to_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farm_id uuid;
  v_record_date date;
  v_total_feed_kg numeric;
  v_feed_animal_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT a.farm_id INTO v_farm_id FROM animals a WHERE a.id = OLD.animal_id;
    v_record_date := OLD.record_datetime::date;
  ELSE
    SELECT a.farm_id INTO v_farm_id FROM animals a WHERE a.id = NEW.animal_id;
    v_record_date := NEW.record_datetime::date;
  END IF;

  IF v_farm_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(fr.kilograms), 0), COUNT(DISTINCT fr.animal_id)
  INTO v_total_feed_kg, v_feed_animal_count
  FROM feeding_records fr
  JOIN animals a ON fr.animal_id = a.id
  WHERE a.farm_id = v_farm_id AND fr.record_datetime::date = v_record_date;

  INSERT INTO daily_farm_stats (farm_id, stat_date, total_feed_kg, feed_animal_count, total_milk_liters, stage_counts)
  VALUES (v_farm_id, v_record_date, v_total_feed_kg, v_feed_animal_count, 0, '{}'::jsonb)
  ON CONFLICT (farm_id, stat_date)
  DO UPDATE SET total_feed_kg = v_total_feed_kg, feed_animal_count = v_feed_animal_count, updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_aggregate_feed_stats ON public.feeding_records;
CREATE TRIGGER trg_aggregate_feed_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.feeding_records
  FOR EACH ROW EXECUTE FUNCTION public.aggregate_feed_to_daily_stats();

-- Step 4: Update get_combined_dashboard_data RPC
DROP FUNCTION IF EXISTS public.get_combined_dashboard_data(uuid, date, date, date, date);

CREATE OR REPLACE FUNCTION public.get_combined_dashboard_data(
  p_farm_id uuid, p_start_date date, p_end_date date,
  p_monthly_start_date date, p_monthly_end_date date
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb; v_stats jsonb; v_daily_data jsonb; v_monthly_data jsonb; v_stage_keys jsonb;
  v_total_animals int; v_avg_daily_milk numeric; v_pregnant_count int;
  v_pending_confirmation int; v_recent_health_events int;
  v_roughage_kg numeric := 0; v_concentrate_kg numeric := 0;
  v_daily_fresh_forage_kg numeric := 0; v_daily_roughage_need_kg numeric := 0;
  v_daily_concentrate_need_kg numeric := 0;
  v_roughage_days int; v_concentrate_days int; v_feed_stock_days int; v_animal_count int := 0;
BEGIN
  SELECT COUNT(*) INTO v_total_animals FROM animals
  WHERE farm_id = p_farm_id AND is_deleted = false AND exit_date IS NULL;

  SELECT COALESCE(AVG(daily_total), 0) INTO v_avg_daily_milk FROM (
    SELECT SUM(mr.liters) as daily_total FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id AND a.is_deleted = false AND mr.record_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY mr.record_date) daily_totals;

  SELECT COUNT(*) INTO v_pregnant_count FROM animals a
  WHERE a.farm_id = p_farm_id AND a.is_deleted = false AND a.exit_date IS NULL
    AND EXISTS (SELECT 1 FROM ai_records ar WHERE ar.animal_id = a.id AND ar.pregnancy_confirmed = true
      AND (ar.expected_delivery_date IS NULL OR ar.expected_delivery_date > CURRENT_DATE));

  SELECT COUNT(*) INTO v_pending_confirmation FROM animals a
  WHERE a.farm_id = p_farm_id AND a.is_deleted = false AND a.exit_date IS NULL
    AND EXISTS (SELECT 1 FROM ai_records ar WHERE ar.animal_id = a.id AND ar.pregnancy_confirmed IS NULL
      AND ar.performed_date IS NOT NULL AND ar.performed_date > CURRENT_DATE - INTERVAL '60 days');

  SELECT COUNT(*) INTO v_recent_health_events FROM health_records hr JOIN animals a ON hr.animal_id = a.id
  WHERE a.farm_id = p_farm_id AND hr.visit_date >= CURRENT_DATE - INTERVAL '30 days';

  SELECT 
    COALESCE(SUM(CASE WHEN LOWER(COALESCE(category, 'roughage')) = 'roughage' THEN quantity_kg ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(COALESCE(category, 'roughage')) IN ('concentrates', 'concentrate', 'minerals', 'supplements') THEN quantity_kg ELSE 0 END), 0)
  INTO v_roughage_kg, v_concentrate_kg FROM feed_inventory WHERE farm_id = p_farm_id;

  SELECT COUNT(*), COALESCE(SUM(
    (COALESCE(NULLIF(a.current_weight_kg, 0), NULLIF(a.entry_weight_kg, 0), NULLIF(a.birth_weight_kg, 0),
      CASE a.livestock_type WHEN 'cattle' THEN 400 WHEN 'carabao' THEN 450 WHEN 'goat' THEN 40 ELSE 400 END)
    * CASE WHEN a.life_stage IN ('calf','kid') THEN 0.03 WHEN a.life_stage IN ('heifer','doeling') THEN 0.025
      WHEN a.milking_stage IN ('early','peak') THEN 0.035 WHEN a.milking_stage = 'mid' THEN 0.03
      WHEN a.milking_stage IN ('late','dry') THEN 0.025 WHEN a.gender = 'male' THEN 0.02 ELSE 0.025 END) / 0.30
  ), 0) INTO v_animal_count, v_daily_fresh_forage_kg
  FROM animals a WHERE a.farm_id = p_farm_id AND a.is_deleted = false AND a.exit_date IS NULL;

  v_daily_roughage_need_kg := v_daily_fresh_forage_kg * 0.70;
  v_daily_concentrate_need_kg := v_daily_fresh_forage_kg * 0.30;
  IF v_daily_roughage_need_kg > 0 THEN v_roughage_days := FLOOR(v_roughage_kg / v_daily_roughage_need_kg); ELSE v_roughage_days := NULL; END IF;
  IF v_daily_concentrate_need_kg > 0 THEN v_concentrate_days := FLOOR(v_concentrate_kg / v_daily_concentrate_need_kg); ELSE v_concentrate_days := NULL; END IF;
  v_feed_stock_days := v_roughage_days;

  v_stats := jsonb_build_object(
    'totalAnimals', v_total_animals, 'avgDailyMilk', ROUND(v_avg_daily_milk::numeric, 1),
    'pregnantCount', v_pregnant_count, 'pendingConfirmation', v_pending_confirmation,
    'recentHealthEvents', v_recent_health_events, 'feedStockDays', v_feed_stock_days,
    'feedStockBreakdown', jsonb_build_object(
      'roughageKg', ROUND(v_roughage_kg::numeric, 1), 'concentrateKg', ROUND(v_concentrate_kg::numeric, 1),
      'roughageDays', v_roughage_days, 'concentrateDays', v_concentrate_days, 'animalCount', v_animal_count,
      'dailyFreshForageKg', ROUND(v_daily_fresh_forage_kg::numeric, 1),
      'dailyRoughageNeedKg', ROUND(v_daily_roughage_need_kg::numeric, 1),
      'dailyConcentrateNeedKg', ROUND(v_daily_concentrate_need_kg::numeric, 1),
      'calculationMethod', 'weight-based-dm-coalesce'));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', d.day_date::text, 'milkTotal', COALESCE(d.milk_liters, 0),
    'feedTotalKg', COALESCE(d.feed_kg, 0), 'feedAnimalCount', COALESCE(d.feed_animals, 0)
  ) ORDER BY d.day_date), '[]'::jsonb) INTO v_daily_data
  FROM (
    SELECT gs::date AS day_date, milk.total_liters AS milk_liters,
      dfs.total_feed_kg AS feed_kg, dfs.feed_animal_count AS feed_animals
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) gs
    LEFT JOIN LATERAL (
      SELECT SUM(mr.liters) AS total_liters FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
      WHERE a.farm_id = p_farm_id AND a.is_deleted = false AND mr.record_date = gs::date
    ) milk ON true
    LEFT JOIN daily_farm_stats dfs ON dfs.farm_id = p_farm_id AND dfs.stat_date = gs::date
  ) d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'monthDate', dfs.stat_date::text, 'stageCounts', dfs.stage_counts
  ) ORDER BY dfs.stat_date), '[]'::jsonb) INTO v_monthly_data
  FROM daily_farm_stats dfs WHERE dfs.farm_id = p_farm_id
    AND dfs.stat_date >= p_monthly_start_date AND dfs.stat_date <= p_monthly_end_date;

  SELECT COALESCE(jsonb_agg(DISTINCT stage_key), '[]'::jsonb) INTO v_stage_keys
  FROM (SELECT jsonb_object_keys(stage_counts) as stage_key FROM daily_farm_stats
    WHERE farm_id = p_farm_id AND stat_date >= p_monthly_start_date) keys;

  RETURN jsonb_build_object('stats', v_stats, 'dailyData', v_daily_data,
    'monthlyData', v_monthly_data, 'stageKeys', v_stage_keys);
END;
$$;

-- Step 5: Update ensure_farm_stats to include feed columns
CREATE OR REPLACE FUNCTION public.ensure_farm_stats(p_farm_id uuid, p_start_date date, p_end_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_missing_date date; v_filled_count int := 0; v_max_backfill int := 30;
BEGIN
  FOR v_missing_date IN
    SELECT d::date FROM generate_series(GREATEST(p_start_date, CURRENT_DATE - v_max_backfill),
      LEAST(p_end_date, CURRENT_DATE - 1), '1 day'::interval) d
    WHERE NOT EXISTS (SELECT 1 FROM daily_farm_stats dfs WHERE dfs.farm_id = p_farm_id AND dfs.stat_date = d::date)
    ORDER BY d LIMIT v_max_backfill
  LOOP
    INSERT INTO daily_farm_stats (farm_id, stat_date, total_milk_liters, stage_counts, total_feed_kg, feed_animal_count)
    SELECT p_farm_id, v_missing_date,
      COALESCE((SELECT SUM(mr.liters) FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
        WHERE a.farm_id = p_farm_id AND mr.record_date::date = v_missing_date), 0),
      COALESCE((SELECT jsonb_object_agg(stage, cnt) FROM (
        SELECT COALESCE(NULLIF(a.milking_stage, ''), NULLIF(a.life_stage, ''), 'Unknown') AS stage, COUNT(*) AS cnt
        FROM animals a WHERE a.farm_id = p_farm_id AND a.is_deleted = false
          AND (a.exit_date IS NULL OR a.exit_date > v_missing_date) AND (a.created_at::date <= v_missing_date)
        GROUP BY COALESCE(NULLIF(a.milking_stage, ''), NULLIF(a.life_stage, ''), 'Unknown')) sub), '{}'::jsonb),
      COALESCE((SELECT SUM(fr.kilograms) FROM feeding_records fr JOIN animals a ON fr.animal_id = a.id
        WHERE a.farm_id = p_farm_id AND fr.record_datetime::date = v_missing_date), 0),
      COALESCE((SELECT COUNT(DISTINCT fr.animal_id) FROM feeding_records fr JOIN animals a ON fr.animal_id = a.id
        WHERE a.farm_id = p_farm_id AND fr.record_datetime::date = v_missing_date), 0)
    ON CONFLICT (farm_id, stat_date) DO NOTHING;
    v_filled_count := v_filled_count + 1;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'farm_id', p_farm_id, 'dates_filled', v_filled_count,
    'range', jsonb_build_object('start', p_start_date, 'end', p_end_date));
END;
$$;

-- Step 6: Update calculate_daily_farm_stats to include feed
CREATE OR REPLACE FUNCTION public.calculate_daily_farm_stats(p_target_date date DEFAULT CURRENT_DATE - 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_farms_processed int := 0; v_result jsonb;
BEGIN
  INSERT INTO daily_farm_stats (farm_id, stat_date, total_milk_liters, stage_counts, total_feed_kg, feed_animal_count)
  SELECT f.id, p_target_date, COALESCE(milk.total_liters, 0), COALESCE(stages.stage_counts, '{}'::jsonb),
    COALESCE(feed.total_kg, 0), COALESCE(feed.animal_count, 0)
  FROM farms f
  LEFT JOIN LATERAL (SELECT SUM(mr.liters) AS total_liters FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = f.id AND mr.record_date::date = p_target_date) milk ON true
  LEFT JOIN LATERAL (SELECT jsonb_object_agg(stage, cnt) AS stage_counts FROM (
    SELECT COALESCE(NULLIF(a.milking_stage, ''), NULLIF(a.life_stage, ''), 'Unknown') AS stage, COUNT(*) AS cnt
    FROM animals a WHERE a.farm_id = f.id AND a.is_deleted = false
      AND (a.exit_date IS NULL OR a.exit_date > p_target_date) AND (a.created_at::date <= p_target_date)
    GROUP BY COALESCE(NULLIF(a.milking_stage, ''), NULLIF(a.life_stage, ''), 'Unknown')) sub) stages ON true
  LEFT JOIN LATERAL (SELECT SUM(fr.kilograms) AS total_kg, COUNT(DISTINCT fr.animal_id) AS animal_count
    FROM feeding_records fr JOIN animals a ON fr.animal_id = a.id
    WHERE a.farm_id = f.id AND fr.record_datetime::date = p_target_date) feed ON true
  WHERE f.is_deleted = false
  ON CONFLICT (farm_id, stat_date) DO UPDATE SET
    total_milk_liters = EXCLUDED.total_milk_liters, stage_counts = EXCLUDED.stage_counts,
    total_feed_kg = EXCLUDED.total_feed_kg, feed_animal_count = EXCLUDED.feed_animal_count, updated_at = now();
  GET DIAGNOSTICS v_farms_processed = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'target_date', p_target_date, 'farms_processed', v_farms_processed);
END;
$$;