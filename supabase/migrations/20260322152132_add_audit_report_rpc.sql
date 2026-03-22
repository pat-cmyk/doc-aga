-- Bank Audit Report RPC
-- Generates a neutral, fact-based data integrity report for bank assessment.
-- Returns 6 sections: farm_summary, daily_entry_log, temporal_integrity,
-- value_distribution, cross_dataset_consistency, user_attribution.

CREATE OR REPLACE FUNCTION public.get_farm_audit_report(
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
  v_result jsonb;
  v_farm_summary jsonb;
  v_daily_entry_log jsonb;
  v_temporal_integrity jsonb;
  v_value_distribution jsonb;
  v_cross_consistency jsonb;
  v_user_attribution jsonb;
BEGIN
  -- ============================================================
  -- SECTION A: Farm Summary
  -- ============================================================
  SELECT jsonb_build_object(
    'farm_name', f.name,
    'owner_name', p.full_name,
    'region', f.region,
    'period_start', p_start_date,
    'period_end', p_end_date,
    'total_active_animals', (
      SELECT COUNT(*) FROM animals a
      WHERE a.farm_id = p_farm_id AND a.is_deleted = false AND a.exit_date IS NULL
    ),
    'total_users', (
      SELECT COUNT(*) FROM farm_memberships fm
      WHERE fm.farm_id = p_farm_id AND fm.invitation_status = 'accepted'
    ),
    'generated_at', now()
  )
  INTO v_farm_summary
  FROM farms f
  JOIN profiles p ON f.owner_id = p.id
  WHERE f.id = p_farm_id;

  -- ============================================================
  -- SECTION B: Daily Entry Log
  -- Counts records entered per day per user, grouped by record type.
  -- Uses created_at::date (entry date) as the grouping key.
  -- ============================================================
  WITH all_records AS (
    -- Milking
    SELECT mr.created_at, mr.created_by AS user_id, 'milking' AS source
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND mr.created_at >= p_start_date::timestamptz
      AND mr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    -- Feeding
    SELECT fr.created_at, fr.created_by AS user_id, 'feeding' AS source
    FROM feeding_records fr
    JOIN animals a ON fr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND fr.created_at >= p_start_date::timestamptz
      AND fr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    -- Health
    SELECT hr.created_at, hr.created_by AS user_id, 'health' AS source
    FROM health_records hr
    JOIN animals a ON hr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND hr.created_at >= p_start_date::timestamptz
      AND hr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    -- Weight
    SELECT wr.created_at, wr.recorded_by AS user_id, 'weight' AS source
    FROM weight_records wr
    JOIN animals a ON wr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND wr.created_at >= p_start_date::timestamptz
      AND wr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    -- Injection
    SELECT ir.created_at, ir.created_by AS user_id, 'injection' AS source
    FROM injection_records ir
    JOIN animals a ON ir.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND ir.created_at >= p_start_date::timestamptz
      AND ir.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    -- Expenses
    SELECT fe.created_at, fe.user_id, 'expense' AS source
    FROM farm_expenses fe
    WHERE fe.farm_id = p_farm_id AND fe.is_deleted = false
      AND fe.created_at >= p_start_date::timestamptz
      AND fe.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    -- Revenue
    SELECT fv.created_at, fv.user_id, 'revenue' AS source
    FROM farm_revenues fv
    WHERE fv.farm_id = p_farm_id AND fv.is_deleted = false
      AND fv.created_at >= p_start_date::timestamptz
      AND fv.created_at < (p_end_date + 1)::timestamptz
  )
  SELECT COALESCE(jsonb_agg(row_data ORDER BY entry_date, user_name), '[]'::jsonb)
  INTO v_daily_entry_log
  FROM (
    SELECT
      (ar.created_at AT TIME ZONE 'Asia/Manila')::date AS entry_date,
      COALESCE(p.full_name, 'Unknown') AS user_name,
      COALESCE(fm.role_in_farm::text, 'unknown') AS role,
      COUNT(*) FILTER (WHERE ar.source = 'milking') AS milking_count,
      COUNT(*) FILTER (WHERE ar.source = 'feeding') AS feeding_count,
      COUNT(*) FILTER (WHERE ar.source = 'health') AS health_count,
      COUNT(*) FILTER (WHERE ar.source = 'weight') AS weight_count,
      COUNT(*) FILTER (WHERE ar.source = 'injection') AS injection_count,
      COUNT(*) FILTER (WHERE ar.source = 'expense') AS expense_count,
      COUNT(*) FILTER (WHERE ar.source = 'revenue') AS revenue_count,
      COUNT(*) AS total
    FROM all_records ar
    LEFT JOIN profiles p ON ar.user_id = p.id
    LEFT JOIN farm_memberships fm ON fm.user_id = ar.user_id AND fm.farm_id = p_farm_id
    GROUP BY entry_date, p.full_name, fm.role_in_farm
  ) row_data;

  -- ============================================================
  -- SECTION C: Temporal Integrity
  -- ============================================================
  WITH all_records_with_event AS (
    SELECT mr.created_at, mr.created_by AS user_id, 'milking' AS source, mr.record_date AS event_date
    FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND mr.created_at >= p_start_date::timestamptz AND mr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT fr.created_at, fr.created_by, 'feeding', fr.record_datetime::date
    FROM feeding_records fr JOIN animals a ON fr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND fr.created_at >= p_start_date::timestamptz AND fr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT hr.created_at, hr.created_by, 'health', hr.visit_date
    FROM health_records hr JOIN animals a ON hr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND hr.created_at >= p_start_date::timestamptz AND hr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT wr.created_at, wr.recorded_by, 'weight', wr.measurement_date
    FROM weight_records wr JOIN animals a ON wr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND wr.created_at >= p_start_date::timestamptz AND wr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT ir.created_at, ir.created_by, 'injection', ir.record_datetime::date
    FROM injection_records ir JOIN animals a ON ir.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND ir.created_at >= p_start_date::timestamptz AND ir.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT fe.created_at, fe.user_id, 'expense', fe.expense_date
    FROM farm_expenses fe WHERE fe.farm_id = p_farm_id AND fe.is_deleted = false
      AND fe.created_at >= p_start_date::timestamptz AND fe.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT fv.created_at, fv.user_id, 'revenue', fv.transaction_date
    FROM farm_revenues fv WHERE fv.farm_id = p_farm_id AND fv.is_deleted = false
      AND fv.created_at >= p_start_date::timestamptz AND fv.created_at < (p_end_date + 1)::timestamptz
  ),
  -- Backdating ratio per type
  backdate_stats AS (
    SELECT
      source,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE (created_at::date - event_date) > 7) AS backdated
    FROM all_records_with_event
    GROUP BY source
  ),
  backdate_overall AS (
    SELECT
      SUM(total) AS total,
      SUM(backdated) AS backdated
    FROM backdate_stats
  ),
  -- Hourly distribution (PH timezone)
  hourly AS (
    SELECT
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Manila')::int AS hour,
      COUNT(*) AS count
    FROM all_records_with_event
    GROUP BY 1 ORDER BY 1
  ),
  -- Continuity scores per type
  total_days AS (
    SELECT (p_end_date - p_start_date + 1) AS days_in_period
  ),
  continuity AS (
    SELECT
      source,
      COUNT(DISTINCT (created_at AT TIME ZONE 'Asia/Manila')::date) AS days_with_entries
    FROM all_records_with_event
    GROUP BY source
  ),
  -- Max hourly burst
  hourly_bursts AS (
    SELECT
      user_id,
      date_trunc('hour', created_at AT TIME ZONE 'Asia/Manila') AS hour_bucket,
      COUNT(*) AS burst_count
    FROM all_records_with_event
    GROUP BY user_id, hour_bucket
  ),
  max_burst AS (
    SELECT hb.user_id, hb.hour_bucket, hb.burst_count,
           COALESCE(p.full_name, 'Unknown') AS user_name
    FROM hourly_bursts hb
    LEFT JOIN profiles p ON hb.user_id = p.id
    ORDER BY hb.burst_count DESC
    LIMIT 1
  ),
  -- Average inter-record interval per user
  intervals AS (
    SELECT
      user_id,
      EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at))) / 60.0 AS interval_min
    FROM all_records_with_event
  ),
  avg_interval AS (
    SELECT COALESCE(ROUND(AVG(interval_min)::numeric, 1), 0) AS avg_minutes
    FROM intervals
    WHERE interval_min IS NOT NULL AND interval_min > 0
  )
  SELECT jsonb_build_object(
    'backdating_ratio', (
      SELECT jsonb_object_agg(source, CASE WHEN total > 0 THEN ROUND(backdated * 100.0 / total, 1) ELSE 0 END)
      FROM backdate_stats
    ) || jsonb_build_object('overall',
      CASE WHEN (SELECT total FROM backdate_overall) > 0
        THEN ROUND((SELECT backdated FROM backdate_overall) * 100.0 / (SELECT total FROM backdate_overall), 1)
        ELSE 0 END
    ),
    'hourly_distribution', (SELECT COALESCE(jsonb_agg(jsonb_build_object('hour', hour, 'count', count) ORDER BY hour), '[]'::jsonb) FROM hourly),
    'continuity_scores', (
      SELECT jsonb_object_agg(source, ROUND(days_with_entries * 100.0 / GREATEST((SELECT days_in_period FROM total_days), 1), 1))
      FROM continuity
    ) || jsonb_build_object('overall',
      ROUND(
        (SELECT COUNT(DISTINCT (created_at AT TIME ZONE 'Asia/Manila')::date) FROM all_records_with_event)
        * 100.0 / GREATEST((SELECT days_in_period FROM total_days), 1), 1
      )
    ),
    'max_hourly_burst', (
      SELECT COALESCE(
        jsonb_build_object('count', burst_count, 'user_name', user_name, 'timestamp', hour_bucket),
        jsonb_build_object('count', 0, 'user_name', null, 'timestamp', null)
      ) FROM max_burst
    ),
    'avg_inter_record_interval_minutes', (SELECT avg_minutes FROM avg_interval)
  )
  INTO v_temporal_integrity;

  -- ============================================================
  -- SECTION D: Value Distribution
  -- ============================================================
  WITH
  -- Terminal digit analysis for milk liters
  milk_digits AS (
    SELECT
      (FLOOR(mr.liters * 10) % 10)::int AS digit,
      COUNT(*) AS count
    FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id AND mr.liters > 0
      AND mr.created_at >= p_start_date::timestamptz AND mr.created_at < (p_end_date + 1)::timestamptz
    GROUP BY 1
  ),
  milk_total AS (SELECT GREATEST(SUM(count), 1) AS total FROM milk_digits),
  -- Terminal digit for weight
  weight_digits AS (
    SELECT
      (FLOOR(wr.weight_kg) % 10)::int AS digit,
      COUNT(*) AS count
    FROM weight_records wr JOIN animals a ON wr.animal_id = a.id
    WHERE a.farm_id = p_farm_id AND wr.weight_kg > 0
      AND wr.created_at >= p_start_date::timestamptz AND wr.created_at < (p_end_date + 1)::timestamptz
    GROUP BY 1
  ),
  weight_total AS (SELECT GREATEST(SUM(count), 1) AS total FROM weight_digits),
  -- Terminal digit for feed kg
  feed_digits AS (
    SELECT
      (FLOOR(fr.kilograms) % 10)::int AS digit,
      COUNT(*) AS count
    FROM feeding_records fr JOIN animals a ON fr.animal_id = a.id
    WHERE a.farm_id = p_farm_id AND fr.kilograms > 0
      AND fr.created_at >= p_start_date::timestamptz AND fr.created_at < (p_end_date + 1)::timestamptz
    GROUP BY 1
  ),
  feed_total AS (SELECT GREATEST(SUM(count), 1) AS total FROM feed_digits),
  -- Per-animal milk yield stats
  animal_milk AS (
    SELECT
      a.ear_tag,
      a.name,
      ROUND(AVG(mr.liters)::numeric, 2) AS avg_liters,
      ROUND(STDDEV_POP(mr.liters)::numeric, 2) AS std_dev,
      CASE WHEN AVG(mr.liters) > 0
        THEN ROUND((STDDEV_POP(mr.liters) / AVG(mr.liters) * 100)::numeric, 1)
        ELSE 0 END AS cv,
      COUNT(*) AS record_count
    FROM milking_records mr
    JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id AND a.is_deleted = false
      AND mr.created_at >= p_start_date::timestamptz AND mr.created_at < (p_end_date + 1)::timestamptz
    GROUP BY a.id, a.ear_tag, a.name
    HAVING COUNT(*) >= 3
  ),
  overall_milk_cv AS (
    SELECT CASE WHEN AVG(mr.liters) > 0
      THEN ROUND((STDDEV_POP(mr.liters) / AVG(mr.liters) * 100)::numeric, 1)
      ELSE 0 END AS cv
    FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id AND a.is_deleted = false
      AND mr.created_at >= p_start_date::timestamptz AND mr.created_at < (p_end_date + 1)::timestamptz
  ),
  -- Duplicate value ratios
  milk_dupes AS (
    SELECT COUNT(*) AS total,
      COUNT(*) - COUNT(DISTINCT mr.liters) AS dupes
    FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND mr.created_at >= p_start_date::timestamptz AND mr.created_at < (p_end_date + 1)::timestamptz
  ),
  weight_dupes AS (
    SELECT COUNT(*) AS total,
      COUNT(*) - COUNT(DISTINCT wr.weight_kg) AS dupes
    FROM weight_records wr JOIN animals a ON wr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND wr.created_at >= p_start_date::timestamptz AND wr.created_at < (p_end_date + 1)::timestamptz
  ),
  feed_dupes AS (
    SELECT COUNT(*) AS total,
      COUNT(*) - COUNT(DISTINCT fr.kilograms) AS dupes
    FROM feeding_records fr JOIN animals a ON fr.animal_id = a.id
    WHERE a.farm_id = p_farm_id
      AND fr.created_at >= p_start_date::timestamptz AND fr.created_at < (p_end_date + 1)::timestamptz
  )
  SELECT jsonb_build_object(
    'terminal_digits', jsonb_build_object(
      'milk', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('digit', d.digit, 'count', d.count, 'pct', ROUND(d.count * 100.0 / mt.total, 1)) ORDER BY d.digit), '[]'::jsonb)
        FROM (SELECT generate_series(0, 9) AS digit) gs
        LEFT JOIN milk_digits d ON gs.digit = d.digit
        CROSS JOIN milk_total mt
      ),
      'weight', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('digit', d.digit, 'count', d.count, 'pct', ROUND(d.count * 100.0 / wt.total, 1)) ORDER BY d.digit), '[]'::jsonb)
        FROM (SELECT generate_series(0, 9) AS digit) gs
        LEFT JOIN weight_digits d ON gs.digit = d.digit
        CROSS JOIN weight_total wt
      ),
      'feed', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('digit', d.digit, 'count', d.count, 'pct', ROUND(d.count * 100.0 / ft.total, 1)) ORDER BY d.digit), '[]'::jsonb)
        FROM (SELECT generate_series(0, 9) AS digit) gs
        LEFT JOIN feed_digits d ON gs.digit = d.digit
        CROSS JOIN feed_total ft
      )
    ),
    'milk_yield_stats', jsonb_build_object(
      'overall_cv', (SELECT cv FROM overall_milk_cv),
      'animals', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'ear_tag', ear_tag, 'name', name, 'avg_liters', avg_liters,
        'std_dev', std_dev, 'cv', cv, 'record_count', record_count
      ) ORDER BY ear_tag), '[]'::jsonb) FROM animal_milk)
    ),
    'duplicate_ratios', jsonb_build_object(
      'milk_pct', CASE WHEN (SELECT total FROM milk_dupes) > 0
        THEN ROUND((SELECT dupes FROM milk_dupes) * 100.0 / (SELECT total FROM milk_dupes), 1) ELSE 0 END,
      'weight_pct', CASE WHEN (SELECT total FROM weight_dupes) > 0
        THEN ROUND((SELECT dupes FROM weight_dupes) * 100.0 / (SELECT total FROM weight_dupes), 1) ELSE 0 END,
      'feed_pct', CASE WHEN (SELECT total FROM feed_dupes) > 0
        THEN ROUND((SELECT dupes FROM feed_dupes) * 100.0 / (SELECT total FROM feed_dupes), 1) ELSE 0 END
    )
  )
  INTO v_value_distribution;

  -- ============================================================
  -- SECTION E: Cross-Dataset Consistency
  -- ============================================================
  WITH
  milk_revenue AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE linked_milk_log_id IS NOT NULL) AS linked
    FROM farm_revenues
    WHERE farm_id = p_farm_id AND source = 'Milk Sales' AND is_deleted = false
      AND created_at >= p_start_date::timestamptz AND created_at < (p_end_date + 1)::timestamptz
  ),
  expense_receipts AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE receipt_url IS NOT NULL AND receipt_url <> '') AS with_receipt
    FROM farm_expenses
    WHERE farm_id = p_farm_id AND is_deleted = false
      AND created_at >= p_start_date::timestamptz AND created_at < (p_end_date + 1)::timestamptz
  ),
  monthly_feed_milk AS (
    SELECT
      to_char(d.month, 'YYYY-MM') AS month,
      COALESCE((
        SELECT SUM(fr.kilograms)
        FROM feeding_records fr JOIN animals a ON fr.animal_id = a.id
        WHERE a.farm_id = p_farm_id
          AND fr.record_datetime >= d.month AND fr.record_datetime < d.month + interval '1 month'
      ), 0) AS total_feed_kg,
      COALESCE((
        SELECT SUM(mr.liters)
        FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
        WHERE a.farm_id = p_farm_id
          AND mr.record_date >= d.month::date AND mr.record_date < (d.month + interval '1 month')::date
      ), 0) AS total_milk_liters
    FROM generate_series(
      date_trunc('month', p_start_date::timestamptz),
      date_trunc('month', p_end_date::timestamptz),
      '1 month'
    ) d(month)
  )
  SELECT jsonb_build_object(
    'revenue_linkage_pct', CASE WHEN (SELECT total FROM milk_revenue) > 0
      THEN ROUND((SELECT linked FROM milk_revenue) * 100.0 / (SELECT total FROM milk_revenue), 1)
      ELSE 0 END,
    'receipt_attachment_pct', CASE WHEN (SELECT total FROM expense_receipts) > 0
      THEN ROUND((SELECT with_receipt FROM expense_receipts) * 100.0 / (SELECT total FROM expense_receipts), 1)
      ELSE 0 END,
    'feed_milk_trend', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'month', month, 'total_feed_kg', total_feed_kg, 'total_milk_liters', total_milk_liters
      ) ORDER BY month), '[]'::jsonb) FROM monthly_feed_milk
    )
  )
  INTO v_cross_consistency;

  -- ============================================================
  -- SECTION F: User Attribution
  -- ============================================================
  WITH all_records_users AS (
    SELECT created_at, created_by AS user_id FROM milking_records mr JOIN animals a ON mr.animal_id = a.id
      WHERE a.farm_id = p_farm_id AND mr.created_at >= p_start_date::timestamptz AND mr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT created_at, created_by FROM feeding_records fr JOIN animals a ON fr.animal_id = a.id
      WHERE a.farm_id = p_farm_id AND fr.created_at >= p_start_date::timestamptz AND fr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT created_at, created_by FROM health_records hr JOIN animals a ON hr.animal_id = a.id
      WHERE a.farm_id = p_farm_id AND hr.created_at >= p_start_date::timestamptz AND hr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT created_at, recorded_by FROM weight_records wr JOIN animals a ON wr.animal_id = a.id
      WHERE a.farm_id = p_farm_id AND wr.created_at >= p_start_date::timestamptz AND wr.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT created_at, created_by FROM injection_records ir JOIN animals a ON ir.animal_id = a.id
      WHERE a.farm_id = p_farm_id AND ir.created_at >= p_start_date::timestamptz AND ir.created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT created_at, user_id FROM farm_expenses
      WHERE farm_id = p_farm_id AND is_deleted = false AND created_at >= p_start_date::timestamptz AND created_at < (p_end_date + 1)::timestamptz
    UNION ALL
    SELECT created_at, user_id FROM farm_revenues
      WHERE farm_id = p_farm_id AND is_deleted = false AND created_at >= p_start_date::timestamptz AND created_at < (p_end_date + 1)::timestamptz
  ),
  grand_total AS (
    SELECT GREATEST(COUNT(*), 1) AS total FROM all_records_users
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_name', user_name,
    'role', role,
    'total_records', total_records,
    'active_days', active_days,
    'first_entry', first_entry,
    'last_entry', last_entry,
    'pct_of_total', ROUND(total_records * 100.0 / gt.total, 1)
  ) ORDER BY total_records DESC), '[]'::jsonb)
  INTO v_user_attribution
  FROM (
    SELECT
      COALESCE(p.full_name, 'Unknown') AS user_name,
      COALESCE(fm.role_in_farm::text, 'unknown') AS role,
      COUNT(*) AS total_records,
      COUNT(DISTINCT (ar.created_at AT TIME ZONE 'Asia/Manila')::date) AS active_days,
      MIN((ar.created_at AT TIME ZONE 'Asia/Manila')::date) AS first_entry,
      MAX((ar.created_at AT TIME ZONE 'Asia/Manila')::date) AS last_entry
    FROM all_records_users ar
    LEFT JOIN profiles p ON ar.user_id = p.id
    LEFT JOIN farm_memberships fm ON fm.user_id = ar.user_id AND fm.farm_id = p_farm_id
    GROUP BY p.full_name, fm.role_in_farm
  ) user_data
  CROSS JOIN grand_total gt;

  -- ============================================================
  -- ASSEMBLE FINAL RESULT
  -- ============================================================
  v_result := jsonb_build_object(
    'farm_summary', v_farm_summary,
    'daily_entry_log', v_daily_entry_log,
    'temporal_integrity', v_temporal_integrity,
    'value_distribution', v_value_distribution,
    'cross_dataset_consistency', v_cross_consistency,
    'user_attribution', v_user_attribution
  );

  RETURN v_result;
END;
$$;
