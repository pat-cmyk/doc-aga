-- Fix: Replace invalid 'pending' enum with correct 'submitted' for feedback_status
-- Also update the frontend interface mapping

CREATE OR REPLACE FUNCTION public.get_system_health_metrics(data_category_filter text DEFAULT 'all')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  filtered_farm_ids uuid[];
BEGIN
  -- Get filtered farm IDs based on data category
  IF data_category_filter = 'all' THEN
    SELECT array_agg(id) INTO filtered_farm_ids FROM farms WHERE is_deleted = false;
  ELSE
    SELECT array_agg(id) INTO filtered_farm_ids FROM farms WHERE data_category = data_category_filter AND is_deleted = false;
  END IF;

  -- Handle empty array
  IF filtered_farm_ids IS NULL THEN
    filtered_farm_ids := ARRAY[]::uuid[];
  END IF;

  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'new_24h', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '24 hours'),
      'new_7d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days'),
      'new_30d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '30 days'),
      'active_24h', (SELECT COUNT(DISTINCT user_id) FROM farm_memberships WHERE created_at > now() - interval '24 hours'),
      'disabled', 0
    ),
    'farms', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM farms WHERE is_deleted = false AND id = ANY(filtered_farm_ids)),
      'new_7d', (SELECT COUNT(*) FROM farms WHERE created_at > now() - interval '7 days' AND is_deleted = false AND id = ANY(filtered_farm_ids)),
      'new_30d', (SELECT COUNT(*) FROM farms WHERE created_at > now() - interval '30 days' AND is_deleted = false AND id = ANY(filtered_farm_ids))
    ),
    'animals', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM animals WHERE is_deleted = false AND farm_id = ANY(filtered_farm_ids)),
      'new_7d', (SELECT COUNT(*) FROM animals WHERE created_at > now() - interval '7 days' AND is_deleted = false AND farm_id = ANY(filtered_farm_ids)),
      'exits_30d', (SELECT COUNT(*) FROM animals WHERE exit_date > now() - interval '30 days' AND farm_id = ANY(filtered_farm_ids))
    ),
    'doc_aga', jsonb_build_object(
      'total_queries', (SELECT COUNT(*) FROM doc_aga_queries WHERE farm_id = ANY(filtered_farm_ids)),
      'queries_7d', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at > now() - interval '7 days' AND farm_id = ANY(filtered_farm_ids)),
      'queries_24h', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at > now() - interval '24 hours' AND farm_id = ANY(filtered_farm_ids))
    ),
    'stt', jsonb_build_object(
      'total_requests', (SELECT COUNT(*) FROM stt_analytics WHERE farm_id = ANY(filtered_farm_ids)),
      'requests_24h', (SELECT COUNT(*) FROM stt_analytics WHERE created_at > now() - interval '24 hours' AND farm_id = ANY(filtered_farm_ids)),
      'success_rate', COALESCE((SELECT ROUND(AVG(CASE WHEN success THEN 100 ELSE 0 END)::numeric, 1) FROM stt_analytics WHERE farm_id = ANY(filtered_farm_ids)), 0),
      'avg_latency_ms', COALESCE((SELECT ROUND(AVG(latency_ms)::numeric, 0) FROM stt_analytics WHERE farm_id = ANY(filtered_farm_ids)), 0),
      'failed_24h', (SELECT COUNT(*) FROM stt_analytics WHERE success = false AND created_at > now() - interval '24 hours' AND farm_id = ANY(filtered_farm_ids))
    ),
    'approvals', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM pending_activities WHERE status = 'pending' AND farm_id = ANY(filtered_farm_ids)),
      'approved_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'approved' AND reviewed_at > now() - interval '7 days' AND farm_id = ANY(filtered_farm_ids)),
      'rejected_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'rejected' AND reviewed_at > now() - interval '7 days' AND farm_id = ANY(filtered_farm_ids)),
      'auto_approved_7d', 0
    ),
    'support', jsonb_build_object(
      'open', (SELECT COUNT(*) FROM support_tickets WHERE status = 'open' AND farm_id = ANY(filtered_farm_ids)),
      'in_progress', (SELECT COUNT(*) FROM support_tickets WHERE status = 'in_progress' AND farm_id = ANY(filtered_farm_ids)),
      'urgent', (SELECT COUNT(*) FROM support_tickets WHERE priority = 'urgent' AND status != 'resolved' AND farm_id = ANY(filtered_farm_ids)),
      'resolved_7d', (SELECT COUNT(*) FROM support_tickets WHERE status = 'resolved' AND updated_at > now() - interval '7 days' AND farm_id = ANY(filtered_farm_ids))
    ),
    'feedback', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'submitted' AND farm_id = ANY(filtered_farm_ids)),
      'acknowledged', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'acknowledged' AND farm_id = ANY(filtered_farm_ids)),
      'under_review', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'under_review' AND farm_id = ANY(filtered_farm_ids)),
      'total', (SELECT COUNT(*) FROM farmer_feedback WHERE farm_id = ANY(filtered_farm_ids))
    ),
    'sync', jsonb_build_object(
      'total_syncs_24h', (SELECT COUNT(*) FROM sync_logs WHERE created_at > now() - interval '24 hours' AND farm_id = ANY(filtered_farm_ids)),
      'success_rate', COALESCE((SELECT ROUND(AVG(CASE WHEN status = 'success' THEN 100 ELSE 0 END)::numeric, 1) FROM sync_logs WHERE farm_id = ANY(filtered_farm_ids)), 100),
      'avg_duration_ms', COALESCE((SELECT ROUND(AVG(duration_ms)::numeric, 0) FROM sync_logs WHERE farm_id = ANY(filtered_farm_ids)), 0),
      'failed_24h', (SELECT COUNT(*) FROM sync_logs WHERE status = 'failed' AND created_at > now() - interval '24 hours' AND farm_id = ANY(filtered_farm_ids))
    ),
    'activity_trend', (
      SELECT COALESCE(jsonb_agg(daily_stats ORDER BY date), '[]'::jsonb)
      FROM (
        SELECT 
          date_trunc('day', created_at)::date as date,
          COUNT(*) as logins
        FROM farm_memberships
        WHERE created_at > now() - interval '7 days'
        GROUP BY date_trunc('day', created_at)::date
      ) daily_stats
    ),
    'last_updated', now()
  ) INTO result;

  RETURN result;
END;
$$;