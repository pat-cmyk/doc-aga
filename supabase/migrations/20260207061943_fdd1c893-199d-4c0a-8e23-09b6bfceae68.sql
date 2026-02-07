-- Update get_system_health_metrics RPC to accept data_category_filter parameter
DROP FUNCTION IF EXISTS public.get_system_health_metrics(text);
DROP FUNCTION IF EXISTS public.get_system_health_metrics();

CREATE OR REPLACE FUNCTION public.get_system_health_metrics(
  data_category_filter text DEFAULT 'all'
)
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
      'total', (
        SELECT COUNT(*) FROM farms 
        WHERE is_deleted = false 
          AND (data_category_filter = 'all' OR data_category = data_category_filter)
      ),
      'new_7d', (
        SELECT COUNT(*) FROM farms 
        WHERE created_at > now() - interval '7 days' 
          AND is_deleted = false
          AND (data_category_filter = 'all' OR data_category = data_category_filter)
      ),
      'new_30d', (
        SELECT COUNT(*) FROM farms 
        WHERE created_at > now() - interval '30 days' 
          AND is_deleted = false
          AND (data_category_filter = 'all' OR data_category = data_category_filter)
      )
    ),
    'animals', jsonb_build_object(
      'total', (
        SELECT COUNT(*) FROM animals a
        JOIN farms f ON a.farm_id = f.id
        WHERE a.is_deleted = false
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'new_7d', (
        SELECT COUNT(*) FROM animals a
        JOIN farms f ON a.farm_id = f.id
        WHERE a.created_at > now() - interval '7 days' 
          AND a.is_deleted = false
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'exits_30d', (
        SELECT COUNT(*) FROM animals a
        JOIN farms f ON a.farm_id = f.id
        WHERE a.exit_date > now() - interval '30 days'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      )
    ),
    'doc_aga', jsonb_build_object(
      'total_queries', (
        SELECT COUNT(*) FROM doc_aga_queries q
        LEFT JOIN farms f ON q.farm_id = f.id
        WHERE data_category_filter = 'all' 
          OR f.data_category = data_category_filter 
          OR q.farm_id IS NULL
      ),
      'queries_7d', (
        SELECT COUNT(*) FROM doc_aga_queries q
        LEFT JOIN farms f ON q.farm_id = f.id
        WHERE q.created_at > now() - interval '7 days'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter OR q.farm_id IS NULL)
      ),
      'queries_24h', (
        SELECT COUNT(*) FROM doc_aga_queries q
        LEFT JOIN farms f ON q.farm_id = f.id
        WHERE q.created_at > now() - interval '24 hours'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter OR q.farm_id IS NULL)
      )
    ),
    'stt', jsonb_build_object(
      'total_requests', (SELECT COUNT(*) FROM stt_requests),
      'requests_24h', (SELECT COUNT(*) FROM stt_requests WHERE created_at > now() - interval '24 hours'),
      'success_rate', (
        SELECT COALESCE(
          ROUND(
            (SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
            1
          ),
          0
        )
        FROM stt_requests
      ),
      'avg_latency_ms', (
        SELECT COALESCE(ROUND(AVG(processing_time_ms)::numeric, 0), 0)
        FROM stt_requests
        WHERE success = true
      ),
      'failed_24h', (
        SELECT COUNT(*) FROM stt_requests 
        WHERE created_at > now() - interval '24 hours' 
          AND success = false
      )
    ),
    'approvals', jsonb_build_object(
      'pending', (
        SELECT COUNT(*) FROM backdate_approval_requests bar
        JOIN farms f ON bar.farm_id = f.id
        WHERE bar.status = 'pending'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'approved_7d', (
        SELECT COUNT(*) FROM backdate_approval_requests bar
        JOIN farms f ON bar.farm_id = f.id
        WHERE bar.status = 'approved' 
          AND bar.updated_at > now() - interval '7 days'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'rejected_7d', (
        SELECT COUNT(*) FROM backdate_approval_requests bar
        JOIN farms f ON bar.farm_id = f.id
        WHERE bar.status = 'rejected' 
          AND bar.updated_at > now() - interval '7 days'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'auto_approved_7d', (
        SELECT COUNT(*) FROM backdate_approval_requests bar
        JOIN farms f ON bar.farm_id = f.id
        WHERE bar.status = 'auto_approved' 
          AND bar.updated_at > now() - interval '7 days'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      )
    ),
    'support', jsonb_build_object(
      'open', (SELECT COUNT(*) FROM support_tickets WHERE status = 'open'),
      'in_progress', (SELECT COUNT(*) FROM support_tickets WHERE status = 'in_progress'),
      'urgent', (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress') AND priority = 'urgent'),
      'resolved_7d', (SELECT COUNT(*) FROM support_tickets WHERE status = 'resolved' AND updated_at > now() - interval '7 days')
    ),
    'feedback', jsonb_build_object(
      'pending', (
        SELECT COUNT(*) FROM farmer_feedback fb
        JOIN farms f ON fb.farm_id = f.id
        WHERE fb.status = 'pending'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'acknowledged', (
        SELECT COUNT(*) FROM farmer_feedback fb
        JOIN farms f ON fb.farm_id = f.id
        WHERE fb.status = 'acknowledged'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'under_review', (
        SELECT COUNT(*) FROM farmer_feedback fb
        JOIN farms f ON fb.farm_id = f.id
        WHERE fb.status = 'under_review'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'total', (
        SELECT COUNT(*) FROM farmer_feedback fb
        JOIN farms f ON fb.farm_id = f.id
        WHERE (data_category_filter = 'all' OR f.data_category = data_category_filter)
      )
    ),
    'sync', jsonb_build_object(
      'total_syncs_24h', (SELECT COUNT(*) FROM farm_sync_checkpoints WHERE last_sync_at > now() - interval '24 hours'),
      'success_rate', 100,
      'avg_duration_ms', 0,
      'failed_24h', 0
    ),
    'activity_trend', (
      SELECT COALESCE(jsonb_agg(daily_data ORDER BY daily_data->>'date'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'date', to_char(date_trunc('day', created_at), 'YYYY-MM-DD'),
          'logins', COUNT(*)
        ) as daily_data
        FROM user_activity_logs
        WHERE created_at > now() - interval '7 days'
          AND event_type = 'login'
        GROUP BY date_trunc('day', created_at)
      ) subq
    ),
    'last_updated', now()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_system_health_metrics(text) TO authenticated;