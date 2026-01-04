-- Fix get_system_health_metrics: change sync_status = 'failed' to 'error' (correct enum value)
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
    -- User metrics
    'total_users', (SELECT COUNT(*) FROM profiles),
    'active_users_24h', (SELECT COUNT(DISTINCT user_id) FROM user_activity_logs WHERE created_at > now() - interval '24 hours'),
    'active_users_7d', (SELECT COUNT(DISTINCT user_id) FROM user_activity_logs WHERE created_at > now() - interval '7 days'),
    'new_users_7d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days'),
    
    -- Farm metrics
    'total_farms', (SELECT COUNT(*) FROM farms WHERE is_deleted = false),
    'active_farms_7d', (SELECT COUNT(DISTINCT farm_id) FROM animals WHERE created_at > now() - interval '7 days'),
    'new_farms_7d', (SELECT COUNT(*) FROM farms WHERE created_at > now() - interval '7 days' AND is_deleted = false),
    
    -- Animal metrics
    'total_animals', (SELECT COUNT(*) FROM animals WHERE is_deleted = false),
    'new_animals_7d', (SELECT COUNT(*) FROM animals WHERE created_at > now() - interval '7 days' AND is_deleted = false),
    
    -- Doc Aga metrics
    'doc_aga_queries_24h', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at > now() - interval '24 hours'),
    'doc_aga_queries_7d', (SELECT COUNT(*) FROM doc_aga_queries WHERE created_at > now() - interval '7 days'),
    
    -- STT metrics (from stt_analytics table)
    'stt_requests_24h', (SELECT COUNT(*) FROM stt_analytics WHERE created_at > now() - interval '24 hours'),
    'stt_requests_7d', (SELECT COUNT(*) FROM stt_analytics WHERE created_at > now() - interval '7 days'),
    'stt_success_rate', (
      SELECT COALESCE(
        ROUND(
          COUNT(*) FILTER (WHERE success = true)::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          1
        ), 
        100
      )
      FROM stt_analytics 
      WHERE created_at > now() - interval '24 hours'
    ),
    
    -- Pending activities (approval workflow)
    'pending_approvals', (SELECT COUNT(*) FROM pending_activities WHERE status = 'pending'),
    'approvals_24h', (SELECT COUNT(*) FROM pending_activities WHERE reviewed_at > now() - interval '24 hours'),
    
    -- Support tickets
    'open_tickets', (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open', 'in_progress')),
    'tickets_24h', (SELECT COUNT(*) FROM support_tickets WHERE created_at > now() - interval '24 hours'),
    
    -- Farmer feedback
    'pending_feedback', (SELECT COUNT(*) FROM farmer_feedback WHERE status = 'pending'),
    'feedback_7d', (SELECT COUNT(*) FROM farmer_feedback WHERE created_at > now() - interval '7 days'),
    
    -- Sync status (from sync_queue table)
    'sync_pending', (SELECT COUNT(*) FROM sync_queue WHERE sync_status = 'pending'),
    'sync_errors', (SELECT COUNT(*) FROM sync_queue WHERE sync_status = 'error'),
    'failed_24h', (SELECT COUNT(*) FROM sync_queue WHERE created_at > now() - interval '24 hours' AND sync_status = 'error'),
    'sync_success_rate', (
      SELECT COALESCE(
        ROUND(
          COUNT(*) FILTER (WHERE sync_status = 'synced')::numeric / 
          NULLIF(COUNT(*)::numeric, 0) * 100, 
          1
        ), 
        100
      )
      FROM sync_queue 
      WHERE created_at > now() - interval '24 hours'
    ),
    
    -- Activity trends
    'milking_records_7d', (SELECT COUNT(*) FROM milking_records WHERE created_at > now() - interval '7 days'),
    'health_records_7d', (SELECT COUNT(*) FROM health_records WHERE created_at > now() - interval '7 days'),
    'feeding_records_7d', (SELECT COUNT(*) FROM feeding_records WHERE created_at > now() - interval '7 days')
  ) INTO result;
  
  RETURN result;
END;
$$;