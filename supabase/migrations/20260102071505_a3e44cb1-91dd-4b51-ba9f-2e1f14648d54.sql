-- =====================================================
-- SCALABLE DAILY FARM STATS CALCULATION
-- Removes auth dependency, uses SECURITY DEFINER for scheduled jobs
-- =====================================================

-- 1. Create function to calculate daily stats for a specific date (or all farms)
CREATE OR REPLACE FUNCTION public.calculate_daily_farm_stats(p_target_date date DEFAULT CURRENT_DATE - 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farms_processed int := 0;
  v_result jsonb;
BEGIN
  -- For each active farm, calculate stats
  INSERT INTO daily_farm_stats (farm_id, stat_date, total_milk_liters, stage_counts)
  SELECT 
    f.id AS farm_id,
    p_target_date AS stat_date,
    COALESCE(milk.total_liters, 0) AS total_milk_liters,
    COALESCE(stages.stage_counts, '{}'::jsonb) AS stage_counts
  FROM farms f
  LEFT JOIN LATERAL (
    -- Calculate total milk for the date
    SELECT SUM(mr.liters) AS total_liters
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = f.id
      AND mr.record_date::date = p_target_date
  ) milk ON true
  LEFT JOIN LATERAL (
    -- Calculate stage counts from animals as of that date
    SELECT jsonb_object_agg(stage, cnt) AS stage_counts
    FROM (
      SELECT 
        COALESCE(
          NULLIF(a.milking_stage, ''),
          NULLIF(a.life_stage, ''),
          'Unknown'
        ) AS stage,
        COUNT(*) AS cnt
      FROM animals a
      WHERE a.farm_id = f.id
        AND a.is_deleted = false
        AND (a.exit_date IS NULL OR a.exit_date > p_target_date)
        AND (a.created_at::date <= p_target_date)
      GROUP BY COALESCE(
        NULLIF(a.milking_stage, ''),
        NULLIF(a.life_stage, ''),
        'Unknown'
      )
    ) sub
  ) stages ON true
  WHERE f.is_deleted = false
  ON CONFLICT (farm_id, stat_date) 
  DO UPDATE SET 
    total_milk_liters = EXCLUDED.total_milk_liters,
    stage_counts = EXCLUDED.stage_counts,
    updated_at = now();

  GET DIAGNOSTICS v_farms_processed = ROW_COUNT;

  v_result := jsonb_build_object(
    'success', true,
    'target_date', p_target_date,
    'farms_processed', v_farms_processed
  );

  RETURN v_result;
END;
$$;

-- 2. Create function to ensure stats exist for a farm within a date range (self-healing)
CREATE OR REPLACE FUNCTION public.ensure_farm_stats(
  p_farm_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_missing_date date;
  v_filled_count int := 0;
  v_max_backfill int := 30; -- Limit backfill to prevent abuse
BEGIN
  -- Find missing dates within range and fill them
  FOR v_missing_date IN
    SELECT d::date
    FROM generate_series(
      GREATEST(p_start_date, CURRENT_DATE - v_max_backfill),
      LEAST(p_end_date, CURRENT_DATE - 1),
      '1 day'::interval
    ) d
    WHERE NOT EXISTS (
      SELECT 1 FROM daily_farm_stats dfs
      WHERE dfs.farm_id = p_farm_id
        AND dfs.stat_date = d::date
    )
    ORDER BY d
    LIMIT v_max_backfill
  LOOP
    -- Calculate stats for this missing date
    INSERT INTO daily_farm_stats (farm_id, stat_date, total_milk_liters, stage_counts)
    SELECT 
      p_farm_id,
      v_missing_date,
      COALESCE((
        SELECT SUM(mr.liters)
        FROM milking_records mr
        JOIN animals a ON mr.animal_id = a.id
        WHERE a.farm_id = p_farm_id
          AND mr.record_date::date = v_missing_date
      ), 0),
      COALESCE((
        SELECT jsonb_object_agg(stage, cnt)
        FROM (
          SELECT 
            COALESCE(
              NULLIF(a.milking_stage, ''),
              NULLIF(a.life_stage, ''),
              'Unknown'
            ) AS stage,
            COUNT(*) AS cnt
          FROM animals a
          WHERE a.farm_id = p_farm_id
            AND a.is_deleted = false
            AND (a.exit_date IS NULL OR a.exit_date > v_missing_date)
            AND (a.created_at::date <= v_missing_date)
          GROUP BY COALESCE(
            NULLIF(a.milking_stage, ''),
            NULLIF(a.life_stage, ''),
            'Unknown'
          )
        ) sub
      ), '{}'::jsonb)
    ON CONFLICT (farm_id, stat_date) DO NOTHING;

    v_filled_count := v_filled_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'farm_id', p_farm_id,
    'dates_filled', v_filled_count,
    'range', jsonb_build_object('start', p_start_date, 'end', p_end_date)
  );
END;
$$;

-- 3. Create stats job run logging table for observability
CREATE TABLE IF NOT EXISTS public.stats_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  success boolean,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on stats_job_runs
ALTER TABLE public.stats_job_runs ENABLE ROW LEVEL SECURITY;

-- Allow admins to view job runs (using user_roles table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stats_job_runs' AND policyname = 'Admins can view stats job runs'
  ) THEN
    CREATE POLICY "Admins can view stats job runs"
      ON public.stats_job_runs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
      );
  END IF;
END;
$$;

-- 4. Create wrapper function for scheduled job (logs runs)
CREATE OR REPLACE FUNCTION public.run_daily_stats_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_result jsonb;
  v_error text;
BEGIN
  -- Log job start
  INSERT INTO stats_job_runs (job_name, started_at)
  VALUES ('calculate_daily_farm_stats', now())
  RETURNING id INTO v_run_id;

  BEGIN
    -- Run the stats calculation for yesterday
    v_result := calculate_daily_farm_stats(CURRENT_DATE - 1);
    
    -- Update job log with success
    UPDATE stats_job_runs
    SET finished_at = now(),
        success = true,
        result = v_result
    WHERE id = v_run_id;
        
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    
    -- Update job log with failure
    UPDATE stats_job_runs
    SET finished_at = now(),
        success = false,
        error_message = v_error
    WHERE id = v_run_id;
    
    RAISE;
  END;
END;
$$;

-- 5. Remove old HTTP-based cron job and create new DB-native one
-- First, try to unschedule the old job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('calculate-daily-stats-job');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, ignore
  NULL;
END;
$$;

-- Schedule the new DB-native daily stats job (runs at 2 AM daily)
SELECT cron.schedule(
  'calculate-daily-stats-db',
  '0 2 * * *',
  $$SELECT public.run_daily_stats_job()$$
);

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_daily_farm_stats(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_farm_stats(uuid, date, date) TO authenticated;

-- 7. Create index for faster stats lookups
CREATE INDEX IF NOT EXISTS idx_daily_farm_stats_farm_date 
  ON daily_farm_stats(farm_id, stat_date DESC);

-- 8. Backfill recent missing dates immediately (last 7 days)
SELECT public.calculate_daily_farm_stats(d::date)
FROM generate_series(CURRENT_DATE - 7, CURRENT_DATE - 1, '1 day'::interval) d;