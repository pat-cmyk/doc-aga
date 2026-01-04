-- Fix get_system_health_metrics to use user_activity_logs instead of auth_events
DROP FUNCTION IF EXISTS public.get_system_health_metrics();

CREATE FUNCTION public.get_system_health_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'users', json_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'new_24h', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '24 hours'),
      'new_7d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days'),
      'new_30d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '30 days'),
      'active_24h', (SELECT COUNT(DISTINCT user_id) FROM user_activity_logs WHERE activity_type = 'login' AND created_at > now() - interval '24 hours'),
      'disabled', (SELECT COUNT(*) FROM profiles WHERE is_disabled = true)
    ),
    'farms', json_build_object(
      'total', (SELECT COUNT(*) FROM farms WHERE is_deleted = false),
      'new_7d', (SELECT COUNT(*) FROM farms WHERE created_at > now() - interval '7 days' AND is_deleted = false),
      'new_30d', (SELECT COUNT(*) FROM farms WHERE created_at > now() - interval '30 days' AND is_deleted = false)
    ),
    'animals', json_build_object(
      'total', (SELECT COUNT(*) FROM animals WHERE is_deleted = false),
      'new_7d', (SELECT COUNT(*) FROM animals WHERE created_at > now() - interval '7 days' AND is_deleted = false),
      'exits_30d', (SELECT COUNT(*) FROM animals WHERE exit_date IS NOT NULL AND exit_date > now() - interval '30 days')
    ),
    'doc_aga', json_build_object(
      'total_queries', (SELECT COUNT(*) FROM doc_aga_queries),
      'queries_7d', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at > now() - interval '7 days'),
      'queries_24h', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at > now() - interval '24 hours')
    ),
    'stt', json_build_object(
      'total_requests', (SELECT COUNT(*) FROM stt_analytics),
      'requests_24h', (SELECT COUNT(*) FROM stt_analytics WHERE created_at > now() - interval '24 hours'),
      'success_rate', COALESCE(
        (SELECT ROUND(
          COUNT(*) FILTER (WHERE success = true)::numeric / NULLIF(COUNT(*), 0) * 100, 2
        ) FROM stt_analytics WHERE created_at > now() - interval '24 hours'),
        100
      ),
      'avg_latency_ms', COALESCE(
        (SELECT ROUND(AVG(latency_ms)) FROM stt_analytics WHERE created_at > now() - interval '24 hours'),
        0
      ),
      'failed_24h', (SELECT COUNT(*) FROM stt_analytics WHERE created_at > now() - interval '24 hours' AND success = false)
    ),
    'approvals', json_build_object(
      'pending', (SELECT COUNT(*) FROM pending_activities WHERE status = 'pending'),
      'approved_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'approved' AND reviewed_at > now() - interval '7 days'),
      'rejected_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'rejected' AND reviewed_at > now() - interval '7 days'),
      'auto_approved_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'auto_approved' AND reviewed_at > now() - interval '7 days')
    ),
    'support', json_build_object(
      'open', (SELECT COUNT(*) FROM support_tickets WHERE status = 'open'),
      'in_progress', (SELECT COUNT(*) FROM support_tickets WHERE status = 'in_progress'),
      'urgent', (SELECT COUNT(*) FROM support_tickets WHERE priority = 'urgent' AND status IN ('open', 'in_progress')),
      'resolved_7d', (SELECT COUNT(*) FROM support_tickets WHERE status = 'resolved' AND updated_at > now() - interval '7 days')
    ),
    'feedback', json_build_object(
      'pending', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'pending'),
      'acknowledged', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'acknowledged'),
      'under_review', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'under_review'),
      'total', (SELECT COUNT(*) FROM farmer_feedback)
    ),
    'sync', json_build_object(
      'total_syncs_24h', (SELECT COUNT(*) FROM sync_analytics WHERE created_at > now() - interval '24 hours'),
      'success_rate', COALESCE(
        (SELECT ROUND(
          (SUM(items_succeeded)::numeric / NULLIF(SUM(items_processed), 0) * 100), 2
        ) FROM sync_analytics WHERE created_at > now() - interval '24 hours'),
        100
      ),
      'avg_duration_ms', COALESCE(
        (SELECT ROUND(AVG(duration_ms)) FROM sync_analytics WHERE created_at > now() - interval '24 hours' AND duration_ms IS NOT NULL),
        0
      ),
      'failed_24h', (SELECT COUNT(*) FROM sync_analytics WHERE created_at > now() - interval '24 hours' AND items_failed > 0)
    ),
    'activity_trend', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT 
          date_trunc('day', created_at)::date as date,
          COUNT(*) as logins
        FROM user_activity_logs
        WHERE activity_type = 'login' AND created_at > now() - interval '7 days'
        GROUP BY date_trunc('day', created_at)::date
        ORDER BY date DESC
      ) t
    ), '[]'::json),
    'last_updated', now()
  ) INTO result;
  
  RETURN result;
END;
$$;