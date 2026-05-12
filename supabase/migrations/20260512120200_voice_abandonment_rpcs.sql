-- Voice abandonment analytics RPCs.
-- (1) Extend get_data_entry_analytics to include voice attempt + abandonment metrics.
-- (2) New get_voice_health_by_farm — per-farmhand breakdown for a single farm.
-- (3) New get_recent_abandoned_voice_attempts — qualitative panel showing what AI got wrong.

BEGIN;

-- ============================================================================
-- (1) Extend get_data_entry_analytics — adds `voice_attempts` block to result
-- ============================================================================
-- Keep signature + return type identical. Add a new top-level `voice_attempts` key
-- so the existing TypeScript shape stays valid; clients can read the new fields if
-- present and ignore them otherwise.

CREATE OR REPLACE FUNCTION public.get_data_entry_analytics(
  _start_date date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  _end_date date DEFAULT CURRENT_DATE,
  _data_category text DEFAULT 'all',
  _region text DEFAULT NULL,
  _province text DEFAULT NULL,
  _municipality text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _summary jsonb;
  _daily jsonb;
  _by_type jsonb;
  _by_location jsonb;
  _voice_attempts jsonb;
  _prev_voice bigint;
  _prev_total bigint;
BEGIN
  -- Build a temp table of all records with input_method + farm location
  CREATE TEMP TABLE _all_entries ON COMMIT DROP AS
  SELECT r.input_method, r.entry_date, r.activity_type, f.region, f.province, f.municipality
  FROM (
    SELECT input_method, record_date AS entry_date, 'milking'::text AS activity_type, a.farm_id
    FROM milking_records mr JOIN animals a ON a.id = mr.animal_id
    WHERE mr.record_date BETWEEN _start_date AND _end_date
    UNION ALL
    SELECT input_method, (record_datetime AT TIME ZONE 'Asia/Manila')::date, 'feeding', a.farm_id
    FROM feeding_records fr JOIN animals a ON a.id = fr.animal_id
    WHERE (fr.record_datetime AT TIME ZONE 'Asia/Manila')::date BETWEEN _start_date AND _end_date
    UNION ALL
    SELECT input_method, measurement_date, 'weight', a.farm_id
    FROM weight_records wr JOIN animals a ON a.id = wr.animal_id
    WHERE wr.measurement_date BETWEEN _start_date AND _end_date
    UNION ALL
    SELECT input_method, visit_date, 'health', a.farm_id
    FROM health_records hr JOIN animals a ON a.id = hr.animal_id
    WHERE hr.visit_date BETWEEN _start_date AND _end_date
    UNION ALL
    SELECT input_method, (record_datetime AT TIME ZONE 'Asia/Manila')::date, 'injection', a.farm_id
    FROM injection_records ir JOIN animals a ON a.id = ir.animal_id
    WHERE (ir.record_datetime AT TIME ZONE 'Asia/Manila')::date BETWEEN _start_date AND _end_date
  ) r
  JOIN farms f ON f.id = r.farm_id AND f.is_deleted = false
  WHERE (_data_category = 'all' OR f.data_category = _data_category)
    AND (_region IS NULL OR f.region = _region)
    AND (_province IS NULL OR f.province = _province)
    AND (_municipality IS NULL OR f.municipality = _municipality);

  -- Summary
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'voice_count', COUNT(*) FILTER (WHERE input_method = 'voice'),
    'typed_count', COUNT(*) FILTER (WHERE input_method = 'typed'),
    'voice_pct', CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE input_method = 'voice')::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END
  ) INTO _summary FROM _all_entries;

  -- Previous period for trend
  SELECT COUNT(*) FILTER (WHERE input_method = 'voice'), COUNT(*)
  INTO _prev_voice, _prev_total
  FROM (
    SELECT input_method
    FROM milking_records mr JOIN animals a ON a.id = mr.animal_id JOIN farms f ON f.id = a.farm_id
    WHERE mr.record_date BETWEEN (_start_date - (_end_date - _start_date)) AND (_start_date - 1)
      AND (_data_category = 'all' OR f.data_category = _data_category) AND f.is_deleted = false
  ) prev;

  _summary := _summary || jsonb_build_object(
    'prev_voice_pct', CASE WHEN _prev_total > 0 THEN ROUND(_prev_voice::numeric / _prev_total::numeric * 100, 1) ELSE 0 END
  );

  -- Daily breakdown
  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb)
  INTO _daily
  FROM (
    SELECT entry_date AS day,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE input_method = 'voice') AS voice_count,
      COUNT(*) FILTER (WHERE input_method = 'typed') AS typed_count
    FROM _all_entries
    GROUP BY entry_date
  ) d;

  -- By activity type
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO _by_type
  FROM (
    SELECT activity_type,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE input_method = 'voice') AS voice_count,
      CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE input_method = 'voice')::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END AS voice_pct
    FROM _all_entries
    GROUP BY activity_type
    ORDER BY total DESC
  ) t;

  -- By location (region level)
  SELECT COALESCE(jsonb_agg(row_to_json(l)), '[]'::jsonb)
  INTO _by_location
  FROM (
    SELECT COALESCE(region, 'Unknown') AS region,
      COALESCE(province, 'Unknown') AS province,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE input_method = 'voice') AS voice_count,
      COUNT(*) FILTER (WHERE input_method = 'typed') AS typed_count,
      CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(*) FILTER (WHERE input_method = 'voice')::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END AS voice_pct
    FROM _all_entries
    GROUP BY region, province
    ORDER BY total DESC
  ) l;

  -- NEW: Voice attempt aggregates (joined to farms for location filter parity)
  SELECT jsonb_build_object(
    'attempts_total', COUNT(*),
    'committed_count', COUNT(*) FILTER (WHERE vsa.outcome = 'committed'),
    'cancelled_count', COUNT(*) FILTER (WHERE vsa.outcome = 'cancelled'),
    'timeout_count',   COUNT(*) FILTER (WHERE vsa.outcome = 'timeout'),
    'error_count',     COUNT(*) FILTER (WHERE vsa.outcome = 'error'),
    'abandonment_pct',
      CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE vsa.outcome IN ('cancelled','timeout'))::numeric
                   / COUNT(*)::numeric * 100, 1)
        ELSE 0 END,
    'abandoned_then_manual_count',
      COUNT(*) FILTER (WHERE vsa.followed_by_manual_within_5m = true),
    'abandoned_then_manual_pct',
      CASE WHEN COUNT(*) FILTER (WHERE vsa.outcome IN ('cancelled','timeout')) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE vsa.followed_by_manual_within_5m = true)::numeric
                   / COUNT(*) FILTER (WHERE vsa.outcome IN ('cancelled','timeout'))::numeric * 100, 1)
        ELSE 0 END,
    'daily', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.day)
      FROM (
        SELECT vsa2.started_at::date AS day,
          COUNT(*) AS attempts,
          COUNT(*) FILTER (WHERE vsa2.outcome = 'committed') AS committed,
          COUNT(*) FILTER (WHERE vsa2.outcome IN ('cancelled','timeout')) AS abandoned
        FROM voice_session_attempts vsa2
        LEFT JOIN farms f2 ON f2.id = vsa2.farm_id
        WHERE vsa2.started_at::date BETWEEN _start_date AND _end_date
          AND (vsa2.farm_id IS NULL OR f2.is_deleted = false)
          AND (_data_category = 'all' OR f2.data_category = _data_category)
          AND (_region        IS NULL OR f2.region        = _region)
          AND (_province      IS NULL OR f2.province      = _province)
          AND (_municipality  IS NULL OR f2.municipality  = _municipality)
        GROUP BY vsa2.started_at::date
      ) d
    ), '[]'::jsonb)
  ) INTO _voice_attempts
  FROM voice_session_attempts vsa
  LEFT JOIN farms f ON f.id = vsa.farm_id
  WHERE vsa.started_at::date BETWEEN _start_date AND _end_date
    AND (vsa.farm_id IS NULL OR f.is_deleted = false)
    AND (_data_category = 'all' OR f.data_category = _data_category)
    AND (_region        IS NULL OR f.region        = _region)
    AND (_province      IS NULL OR f.province      = _province)
    AND (_municipality  IS NULL OR f.municipality  = _municipality);

  RETURN jsonb_build_object(
    'summary', _summary,
    'daily', _daily,
    'by_type', _by_type,
    'by_location', _by_location,
    'voice_attempts', COALESCE(_voice_attempts, jsonb_build_object(
      'attempts_total', 0, 'committed_count', 0, 'cancelled_count', 0,
      'timeout_count', 0, 'error_count', 0, 'abandonment_pct', 0,
      'abandoned_then_manual_count', 0, 'abandoned_then_manual_pct', 0,
      'daily', '[]'::jsonb
    ))
  );
END;
$fn$;

-- ============================================================================
-- (2) get_voice_health_by_farm — per-farmhand breakdown for one farm
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_voice_health_by_farm(
  _farm_id uuid,
  _start_date date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  _end_date   date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _rows jsonb;
BEGIN
  -- Gate: only super admins can drill into a farm they may not own.
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.attempts_total DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      vsa.user_id,
      COALESCE(p.full_name, au.email, 'Unknown user') AS display_name,
      au.email AS email,
      COUNT(*) AS attempts_total,
      COUNT(*) FILTER (WHERE vsa.outcome = 'committed')                AS committed_count,
      COUNT(*) FILTER (WHERE vsa.outcome = 'cancelled')                AS cancelled_count,
      COUNT(*) FILTER (WHERE vsa.outcome = 'timeout')                  AS timeout_count,
      COUNT(*) FILTER (WHERE vsa.outcome = 'error')                    AS error_count,
      COUNT(*) FILTER (WHERE vsa.followed_by_manual_within_5m = true)  AS abandoned_then_manual_count,
      CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE vsa.outcome IN ('cancelled','timeout'))::numeric
                   / COUNT(*)::numeric * 100, 1)
        ELSE 0 END AS abandonment_pct,
      CASE WHEN COUNT(*) FILTER (WHERE vsa.outcome IN ('cancelled','timeout')) > 0
        THEN ROUND(COUNT(*) FILTER (WHERE vsa.followed_by_manual_within_5m = true)::numeric
                   / COUNT(*) FILTER (WHERE vsa.outcome IN ('cancelled','timeout'))::numeric * 100, 1)
        ELSE 0 END AS abandoned_then_manual_pct,
      ROUND(AVG(stt.latency_ms) FILTER (WHERE stt.status = 'success')) AS avg_latency_ms
    FROM voice_session_attempts vsa
    LEFT JOIN profiles p   ON p.id = vsa.user_id
    LEFT JOIN auth.users au ON au.id = vsa.user_id
    LEFT JOIN LATERAL (
      SELECT latency_ms, status
      FROM stt_analytics s
      WHERE s.user_id = vsa.user_id
        AND s.created_at BETWEEN vsa.started_at - interval '30 seconds'
                             AND COALESCE(vsa.ended_at, vsa.started_at + interval '30 seconds')
      ORDER BY s.created_at DESC
      LIMIT 1
    ) stt ON true
    WHERE vsa.farm_id = _farm_id
      AND vsa.started_at::date BETWEEN _start_date AND _end_date
    GROUP BY vsa.user_id, p.full_name, au.email
  ) r;

  RETURN jsonb_build_object('rows', _rows);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_voice_health_by_farm(uuid, date, date) TO authenticated;

-- ============================================================================
-- (3) get_recent_abandoned_voice_attempts — qualitative panel for STT dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_recent_abandoned_voice_attempts(
  _limit int DEFAULT 20,
  _start_date date DEFAULT (CURRENT_DATE - interval '30 days')::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _rows jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.started_at DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      vsa.id,
      vsa.record_type,
      vsa.transcript_preview,
      vsa.parsed_fields,
      vsa.outcome,
      vsa.cancel_reason,
      vsa.followed_by_manual_within_5m,
      vsa.started_at,
      vsa.ended_at,
      COALESCE(p.full_name, au.email, 'Unknown user') AS user_display_name,
      f.name AS farm_name
    FROM voice_session_attempts vsa
    LEFT JOIN profiles p    ON p.id = vsa.user_id
    LEFT JOIN auth.users au ON au.id = vsa.user_id
    LEFT JOIN farms f       ON f.id = vsa.farm_id
    WHERE vsa.outcome IN ('cancelled','timeout')
      AND vsa.started_at::date >= _start_date
    ORDER BY vsa.started_at DESC
    LIMIT _limit
  ) r;

  RETURN jsonb_build_object('rows', _rows);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_recent_abandoned_voice_attempts(int, date) TO authenticated;

COMMIT;
