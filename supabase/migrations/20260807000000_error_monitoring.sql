-- Error Monitoring & One-Tap Error Tickets
-- Spec: docs/superpowers/specs/2026-08-07-error-monitoring-design.md
-- Run this file in the Supabase Dashboard SQL Editor (Lovable Cloud — no CLI access).

-- ─── Enums ────────────────────────────────────────────────────────────
CREATE TYPE error_severity AS ENUM ('toast', 'crash', 'silent', 'server');
CREATE TYPE error_log_status AS ENUM ('new', 'investigating', 'resolved', 'ignored');

-- ─── Tables ───────────────────────────────────────────────────────────
-- One row per fingerprint. Upserts increment occurrence_count.
CREATE TABLE public.client_error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  severity error_severity NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  translated_title TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES public.profiles(id),
  farm_id UUID REFERENCES public.farms(id),
  seen_user_ids UUID[] NOT NULL DEFAULT '{}',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status error_log_status NOT NULL DEFAULT 'new',
  linked_ticket_id UUID REFERENCES public.support_tickets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_error_logs_status ON public.client_error_logs(status);
CREATE INDEX idx_client_error_logs_last_seen ON public.client_error_logs(last_seen_at DESC);

-- Per-user hourly rate limiting for log_client_error.
CREATE TABLE public.error_report_rate (
  user_id UUID NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, hour_bucket)
);

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_report_rate ENABLE ROW LEVEL SECURITY;

-- Super admins read/triage. NO INSERT policy: all client writes go through
-- SECURITY DEFINER RPCs; Edge Functions insert via service role (bypasses RLS).
CREATE POLICY "Super admins can view error logs"
  ON public.client_error_logs FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update error logs"
  ON public.client_error_logs FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete error logs"
  ON public.client_error_logs FOR DELETE
  USING (is_super_admin(auth.uid()));

-- error_report_rate: intentionally no policies — RPC-internal only.

-- ─── RPC: log_client_error ────────────────────────────────────────────
-- Any authenticated user may log. Validates + clamps payload, rate-limits
-- (30/user/hour), upserts by fingerprint. Returns error log id (NULL if
-- rate-limited).
CREATE OR REPLACE FUNCTION public.log_client_error(_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _fingerprint TEXT := LEFT(_payload->>'fingerprint', 128);
  _severity error_severity;
  _message TEXT := LEFT(COALESCE(_payload->>'message', ''), 2000);
  _stack TEXT := LEFT(_payload->>'stack', 8000);
  _title TEXT := LEFT(_payload->>'translated_title', 300);
  _context JSONB := COALESCE(_payload->'context', '{}'::jsonb);
  _farm UUID := NULLIF(_payload->>'farm_id', '')::uuid;
  _count INTEGER := LEAST(GREATEST(COALESCE((_payload->>'occurrence_count')::int, 1), 1), 100);
  _bucket TIMESTAMPTZ := date_trunc('hour', now());
  _rate INTEGER;
  _log_id UUID;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _fingerprint IS NULL OR _fingerprint = '' OR _message = '' THEN
    RAISE EXCEPTION 'Invalid payload';
  END IF;

  BEGIN
    _severity := (_payload->>'severity')::error_severity;
  EXCEPTION WHEN OTHERS THEN
    _severity := 'toast';
  END;
  _severity := COALESCE(_severity, 'toast'::error_severity);
  -- 'server' severity is reserved for Edge Functions (service role inserts)
  IF _severity = 'server' THEN
    _severity := 'silent';
  END IF;

  -- Opportunistic cleanup of old rate buckets (cheap at current scale)
  DELETE FROM error_report_rate WHERE hour_bucket < now() - interval '24 hours';

  INSERT INTO error_report_rate (user_id, hour_bucket, report_count)
  VALUES (_uid, _bucket, 1)
  ON CONFLICT (user_id, hour_bucket)
  DO UPDATE SET report_count = error_report_rate.report_count + 1
  RETURNING report_count INTO _rate;

  IF _rate > 30 THEN
    RETURN NULL;
  END IF;

  -- context is client-supplied; drop it if oversized
  IF pg_column_size(_context) > 4096 THEN
    _context := '{}'::jsonb;
  END IF;

  INSERT INTO client_error_logs AS cel
    (fingerprint, severity, message, stack, translated_title, context,
     user_id, farm_id, seen_user_ids, occurrence_count)
  VALUES
    (_fingerprint, _severity, _message, _stack, _title, _context,
     _uid, _farm, ARRAY[_uid], _count)
  ON CONFLICT (fingerprint) DO UPDATE SET
    message = EXCLUDED.message,
    stack = COALESCE(EXCLUDED.stack, cel.stack),
    translated_title = COALESCE(EXCLUDED.translated_title, cel.translated_title),
    context = EXCLUDED.context,
    -- user_id tracks the LATEST reporter (per design doc); farm_id keeps the
    -- first known farm if the new occurrence has none
    user_id = EXCLUDED.user_id,
    farm_id = COALESCE(EXCLUDED.farm_id, cel.farm_id),
    -- distinct reporters, capped at 50 (submit_error_report accepts anyone once full)
    seen_user_ids = CASE
      WHEN cel.seen_user_ids @> ARRAY[_uid] OR cardinality(cel.seen_user_ids) >= 50
        THEN cel.seen_user_ids
      ELSE cel.seen_user_ids || _uid
    END,
    -- occurrence_count is client-self-reported (clamped 1-100/call); it is a
    -- triage signal, not a verified count
    occurrence_count = cel.occurrence_count + EXCLUDED.occurrence_count,
    last_seen_at = now(),
    updated_at = now(),
    -- regression detection: a resolved error that recurs goes back to 'new'
    status = CASE
      WHEN cel.status = 'resolved' THEN 'new'::error_log_status
      ELSE cel.status
    END
  RETURNING id INTO _log_id;

  RETURN _log_id;
END;
$$;

-- ─── RPC: submit_error_report ─────────────────────────────────────────
-- One-tap farmer report. Creates the pre-filled support ticket on behalf of
-- the caller (support_tickets RLS is super-admin-only by design — this
-- SECURITY DEFINER function is the sanctioned bypass). Idempotent: a second
-- report on the same error adds an internal comment instead of a new ticket.
-- Returns the ticket_number.
CREATE OR REPLACE FUNCTION public.submit_error_report(
  _error_log_id UUID,
  _user_note TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _log client_error_logs%ROWTYPE;
  _ticket support_tickets%ROWTYPE;
  _description TEXT;
  _priority ticket_priority;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- FOR UPDATE serializes concurrent reports on the same error (idempotency guarantee)
  SELECT * INTO _log FROM client_error_logs WHERE id = _error_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Error log not found';
  END IF;

  -- Only a user who actually hit this error may report it. When the reporter
  -- array is at its 50-entry cap we can no longer verify membership, so any
  -- authenticated user is accepted (error is widespread at that point).
  IF cardinality(_log.seen_user_ids) < 50 AND NOT (_log.seen_user_ids @> ARRAY[_uid]) THEN
    RAISE EXCEPTION 'Not a reporter of this error';
  END IF;

  IF _log.linked_ticket_id IS NOT NULL THEN
    SELECT * INTO _ticket FROM support_tickets WHERE id = _log.linked_ticket_id;
    IF FOUND THEN
      INSERT INTO ticket_comments (ticket_id, author_id, content, is_internal)
      VALUES (
        _log.linked_ticket_id, _uid,
        'Also reported via one-tap error report.' ||
        COALESCE(' Note: ' || LEFT(_user_note, 500), ''),
        true
      );
      RETURN _ticket.ticket_number;
    END IF;
  END IF;

  _priority := CASE WHEN _log.severity = 'crash'
    THEN 'high'::ticket_priority ELSE 'medium'::ticket_priority END;

  _description :=
    'Auto-generated from a one-tap error report.' || E'\n\n' ||
    'Error: ' || _log.message || E'\n' ||
    'Shown to user as: ' || COALESCE(_log.translated_title, '—') || E'\n' ||
    'Severity: ' || _log.severity || E'\n' ||
    'Route: ' || COALESCE(_log.context->>'route', '—') || E'\n' ||
    'Device: ' || COALESCE(_log.context->>'user_agent', '—') || E'\n' ||
    'Online at time of error: ' || COALESCE(_log.context->>'online', '—') || E'\n' ||
    'Occurrences so far: ' || _log.occurrence_count ||
    COALESCE(E'\n\nUser note: ' || LEFT(_user_note, 1000), '');

  INSERT INTO support_tickets
    (subject, description, priority, created_by, linked_farm_id, linked_user_id, tags)
  VALUES (
    COALESCE(_log.translated_title, 'App error report'),
    _description, _priority, _uid, _log.farm_id, _uid,
    ARRAY['auto-error']
  )
  RETURNING * INTO _ticket;

  UPDATE client_error_logs
  SET linked_ticket_id = _ticket.id, updated_at = now()
  WHERE id = _error_log_id;

  RETURN _ticket.ticket_number;
END;
$$;

-- ─── RPC: get_error_monitoring_summary ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_error_monitoring_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'counts', jsonb_build_object(
      'new', (SELECT COUNT(*) FROM client_error_logs WHERE status = 'new'),
      'investigating', (SELECT COUNT(*) FROM client_error_logs WHERE status = 'investigating'),
      'crashes_24h', (SELECT COUNT(*) FROM client_error_logs
                      WHERE severity = 'crash' AND last_seen_at > now() - interval '24 hours'),
      'total_24h', (SELECT COUNT(*) FROM client_error_logs
                    WHERE last_seen_at > now() - interval '24 hours')
    ),
    'groups', COALESCE((
      SELECT jsonb_agg(g)
      FROM (
        SELECT jsonb_build_object(
          'id', cel.id,
          'fingerprint', cel.fingerprint,
          'severity', cel.severity,
          'message', cel.message,
          'stack', cel.stack,
          'translated_title', cel.translated_title,
          'context', cel.context,
          'user_id', cel.user_id,
          'farm_id', cel.farm_id,
          'farm_name', f.name,
          'affected_user_count', cardinality(cel.seen_user_ids),
          'occurrence_count', cel.occurrence_count,
          'first_seen_at', cel.first_seen_at,
          'last_seen_at', cel.last_seen_at,
          'status', cel.status,
          'linked_ticket_id', cel.linked_ticket_id,
          'linked_ticket_number', st.ticket_number
        ) AS g
        FROM client_error_logs cel
        LEFT JOIN farms f ON f.id = cel.farm_id
        LEFT JOIN support_tickets st ON st.id = cel.linked_ticket_id
        ORDER BY cel.last_seen_at DESC
        LIMIT 200
      ) sub
    ), '[]'::jsonb),
    'last_updated', now()
  ) INTO result;

  RETURN result;
END;
$$;

-- ─── RPC: update_error_log_status ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_error_log_status(
  _id UUID,
  _status error_log_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE client_error_logs SET status = _status, updated_at = now() WHERE id = _id;
END;
$$;

-- ─── RPC: set_error_log_ticket ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_error_log_ticket(
  _id UUID,
  _ticket_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE client_error_logs
  SET linked_ticket_id = _ticket_id, updated_at = now()
  WHERE id = _id;
END;
$$;
