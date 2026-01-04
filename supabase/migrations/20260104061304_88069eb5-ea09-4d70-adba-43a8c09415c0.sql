-- Drop and recreate get_system_health_metrics with corrected column names and nested structure
DROP FUNCTION IF EXISTS public.get_system_health_metrics();

CREATE OR REPLACE FUNCTION public.get_system_health_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'new_24h', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '24 hours'),
      'new_7d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days'),
      'new_30d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '30 days'),
      'active_24h', (SELECT COUNT(DISTINCT user_id) FROM user_activity_logs WHERE created_at > now() - interval '24 hours'),
      'disabled', COALESCE((SELECT COUNT(*) FROM profiles WHERE is_disabled = true), 0)
    ),
    'farms', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM farms WHERE is_deleted = false),
      'new_7d', (SELECT COUNT(*) FROM farms WHERE created_at > now() - interval '7 days' AND is_deleted = false),
      'new_30d', (SELECT COUNT(*) FROM farms WHERE created_at > now() - interval '30 days' AND is_deleted = false)
    ),
    'animals', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM animals WHERE is_deleted = false),
      'new_7d', (SELECT COUNT(*) FROM animals WHERE created_at > now() - interval '7 days' AND is_deleted = false),
      'exits_30d', (SELECT COUNT(*) FROM animals WHERE exit_date > now() - interval '30 days')
    ),
    'doc_aga', jsonb_build_object(
      'total_queries', (SELECT COUNT(*) FROM doc_aga_queries),
      'queries_7d', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at > now() - interval '7 days'),
      'queries_24h', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at > now() - interval '24 hours')
    ),
    'stt', jsonb_build_object(
      'total_requests', (SELECT COUNT(*) FROM stt_analytics),
      'requests_24h', (SELECT COUNT(*) FROM stt_analytics WHERE created_at > now() - interval '24 hours'),
      'success_rate', COALESCE(
        (SELECT ROUND(
          COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0) * 100, 2
        ) FROM stt_analytics WHERE created_at > now() - interval '24 hours'),
        100
      ),
      'avg_latency_ms', COALESCE(
        (SELECT ROUND(AVG(latency_ms)::numeric, 0) FROM stt_analytics WHERE created_at > now() - interval '24 hours' AND status = 'success'),
        0
      ),
      'failed_24h', (SELECT COUNT(*) FROM stt_analytics WHERE created_at > now() - interval '24 hours' AND status != 'success')
    ),
    'approvals', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM pending_activities WHERE reviewed_at IS NULL),
      'approved_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'approved' AND reviewed_at > now() - interval '7 days'),
      'rejected_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'rejected' AND reviewed_at > now() - interval '7 days'),
      'auto_approved_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'approved' AND auto_approve_at IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_at > now() - interval '7 days')
    ),
    'support', jsonb_build_object(
      'open', (SELECT COUNT(*) FROM support_tickets WHERE status = 'open'),
      'in_progress', (SELECT COUNT(*) FROM support_tickets WHERE status = 'in_progress'),
      'urgent', (SELECT COUNT(*) FROM support_tickets WHERE priority = 'urgent' AND status NOT IN ('resolved', 'closed')),
      'resolved_7d', (SELECT COUNT(*) FROM support_tickets WHERE status = 'resolved' AND resolved_at > now() - interval '7 days')
    ),
    'feedback', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'submitted'),
      'acknowledged', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'acknowledged'),
      'under_review', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'under_review'),
      'total', (SELECT COUNT(*) FROM farmer_feedback)
    ),
    'sync', jsonb_build_object(
      'total_syncs_24h', (SELECT COUNT(*) FROM sync_queue WHERE created_at > now() - interval '24 hours'),
      'success_rate', COALESCE(
        (SELECT ROUND(
          COUNT(*) FILTER (WHERE sync_status = 'synced')::numeric / NULLIF(COUNT(*), 0) * 100, 2
        ) FROM sync_queue WHERE created_at > now() - interval '24 hours'),
        100
      ),
      'avg_duration_ms', 0,
      'failed_24h', (SELECT COUNT(*) FROM sync_queue WHERE created_at > now() - interval '24 hours' AND sync_status = 'error')
    ),
    'activity_trend', COALESCE(
      (SELECT jsonb_agg(daily_data ORDER BY date)
       FROM (
         SELECT 
           date_trunc('day', created_at)::date as date,
           COUNT(*) as logins
         FROM user_activity_logs
         WHERE created_at > now() - interval '7 days'
           AND activity_type = 'login'
         GROUP BY date_trunc('day', created_at)::date
       ) daily_data),
      '[]'::jsonb
    ),
    'last_updated', now()
  ) INTO result;
  
  RETURN result;
END;
$$;