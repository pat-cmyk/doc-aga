-- Create RPC function for system health metrics
CREATE OR REPLACE FUNCTION public.get_system_health_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only super admins can call this
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  SELECT jsonb_build_object(
    -- User metrics with trends
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'new_24h', (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '24 hours'),
      'new_7d', (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '7 days'),
      'new_30d', (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '30 days'),
      'active_24h', (SELECT COUNT(DISTINCT user_id) FROM user_activity_logs WHERE created_at >= NOW() - INTERVAL '24 hours'),
      'disabled', (SELECT COUNT(*) FROM profiles WHERE is_disabled = true)
    ),
    -- Farm metrics
    'farms', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM farms WHERE is_deleted = false),
      'new_7d', (SELECT COUNT(*) FROM farms WHERE created_at >= NOW() - INTERVAL '7 days' AND is_deleted = false),
      'new_30d', (SELECT COUNT(*) FROM farms WHERE created_at >= NOW() - INTERVAL '30 days' AND is_deleted = false)
    ),
    -- Animal metrics  
    'animals', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM animals WHERE is_deleted = false),
      'new_7d', (SELECT COUNT(*) FROM animals WHERE created_at >= NOW() - INTERVAL '7 days' AND is_deleted = false),
      'exits_30d', (SELECT COUNT(*) FROM animals WHERE exit_date >= NOW() - INTERVAL '30 days')
    ),
    -- AI/Voice health
    'doc_aga', jsonb_build_object(
      'total_queries', (SELECT COUNT(*) FROM doc_aga_queries),
      'queries_7d', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at >= NOW() - INTERVAL '7 days'),
      'queries_24h', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at >= NOW() - INTERVAL '24 hours')
    ),
    -- STT metrics
    'stt', jsonb_build_object(
      'total_requests', (SELECT COUNT(*) FROM stt_analytics),
      'requests_24h', (SELECT COUNT(*) FROM stt_analytics WHERE created_at >= NOW() - INTERVAL '24 hours'),
      'success_rate', (SELECT COALESCE(ROUND(COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0) * 100, 1), 0) FROM stt_analytics WHERE created_at >= NOW() - INTERVAL '7 days'),
      'avg_latency_ms', (SELECT COALESCE(ROUND(AVG(latency_ms)::numeric, 0), 0) FROM stt_analytics WHERE created_at >= NOW() - INTERVAL '7 days'),
      'failed_24h', (SELECT COUNT(*) FROM stt_analytics WHERE status = 'error' AND created_at >= NOW() - INTERVAL '24 hours')
    ),
    -- Approval queue health
    'approvals', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM pending_activities WHERE status = 'pending'),
      'approved_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'approved' AND reviewed_at >= NOW() - INTERVAL '7 days'),
      'rejected_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'rejected' AND reviewed_at >= NOW() - INTERVAL '7 days'),
      'auto_approved_7d', (SELECT COUNT(*) FROM pending_activities WHERE status = 'auto_approved' AND reviewed_at >= NOW() - INTERVAL '7 days')
    ),
    -- Support tickets
    'support', jsonb_build_object(
      'open', (SELECT COUNT(*) FROM support_tickets WHERE status = 'open'),
      'in_progress', (SELECT COUNT(*) FROM support_tickets WHERE status = 'in_progress'),
      'urgent', (SELECT COUNT(*) FROM support_tickets WHERE priority = 'urgent' AND status NOT IN ('resolved', 'closed')),
      'resolved_7d', (SELECT COUNT(*) FROM support_tickets WHERE status = 'resolved' AND resolved_at >= NOW() - INTERVAL '7 days')
    ),
    -- Government feedback backlog
    'feedback', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'submitted'),
      'acknowledged', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'acknowledged'),
      'under_review', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'under_review'),
      'total', (SELECT COUNT(*) FROM farmer_feedback)
    ),
    -- Activity trends (last 7 days)
    'activity_trend', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.date)
      FROM (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as logins
        FROM user_activity_logs
        WHERE activity_type = 'login' 
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date
      ) t
    ), '[]'::jsonb),
    -- Recent errors from edge function logs (placeholder - would need analytics query)
    'last_updated', NOW()
  ) INTO result;

  RETURN result;
END;
$$;