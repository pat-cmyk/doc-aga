-- RPC to check for stale sync items on other devices
CREATE OR REPLACE FUNCTION public.check_stale_sync_items(
  p_user_id UUID,
  p_client_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'count', COALESCE(COUNT(*), 0),
    'oldest_timestamp', MIN(created_at)
  ) INTO result
  FROM public.sync_queue
  WHERE user_id = p_user_id
    AND sync_status = 'pending'
    AND client_generated_id IS NOT NULL
    AND client_generated_id != p_client_id;
  
  RETURN COALESCE(result, json_build_object('count', 0, 'oldest_timestamp', null));
END;
$$;