-- Create STT Analytics table for tracking voice-to-text performance
CREATE TABLE public.stt_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  farm_id UUID REFERENCES public.farms(id),
  
  -- Model tracking (critical for Whisper vs Gemini comparison)
  model_provider TEXT NOT NULL DEFAULT 'gemini',
  model_version TEXT NOT NULL DEFAULT 'gemini-3-pro-preview',
  
  -- Performance metrics
  latency_ms INTEGER NOT NULL,
  audio_size_bytes INTEGER NOT NULL,
  audio_duration_seconds NUMERIC,
  
  -- Result tracking
  status TEXT NOT NULL DEFAULT 'success',
  transcription_length INTEGER,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX idx_stt_analytics_created_at ON public.stt_analytics(created_at);
CREATE INDEX idx_stt_analytics_model ON public.stt_analytics(model_provider, model_version);
CREATE INDEX idx_stt_analytics_user ON public.stt_analytics(user_id);
CREATE INDEX idx_stt_analytics_status ON public.stt_analytics(status);

-- Enable RLS
ALTER TABLE public.stt_analytics ENABLE ROW LEVEL SECURITY;

-- Super admins can view all analytics
CREATE POLICY "Super admins can view all STT analytics"
ON public.stt_analytics
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Users can view their own analytics
CREATE POLICY "Users can view their own STT analytics"
ON public.stt_analytics
FOR SELECT
USING (auth.uid() = user_id);

-- Edge function can insert analytics (service role)
CREATE POLICY "Service role can insert STT analytics"
ON public.stt_analytics
FOR INSERT
WITH CHECK (true);

-- RPC function for aggregated STT analytics
CREATE OR REPLACE FUNCTION public.get_stt_analytics(
  start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Only super admins can access
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'total_transcriptions', COUNT(*),
        'success_count', COUNT(*) FILTER (WHERE status = 'success'),
        'error_count', COUNT(*) FILTER (WHERE status = 'error'),
        'rate_limited_count', COUNT(*) FILTER (WHERE status = 'rate_limited'),
        'success_rate', ROUND(
          (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2
        ),
        'avg_latency_ms', ROUND(AVG(latency_ms) FILTER (WHERE status = 'success')),
        'p95_latency_ms', ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE status = 'success')),
        'avg_audio_size_bytes', ROUND(AVG(audio_size_bytes)),
        'avg_transcription_length', ROUND(AVG(transcription_length) FILTER (WHERE status = 'success'))
      )
      FROM stt_analytics
      WHERE created_at::DATE BETWEEN start_date AND end_date
    ),
    'daily_breakdown', (
      SELECT COALESCE(json_agg(daily_data ORDER BY day), '[]'::json)
      FROM (
        SELECT 
          created_at::DATE as day,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'success') as success_count,
          ROUND(AVG(latency_ms) FILTER (WHERE status = 'success')) as avg_latency_ms,
          ROUND(
            (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2
          ) as success_rate
        FROM stt_analytics
        WHERE created_at::DATE BETWEEN start_date AND end_date
        GROUP BY created_at::DATE
      ) daily_data
    ),
    'model_breakdown', (
      SELECT COALESCE(json_agg(model_data), '[]'::json)
      FROM (
        SELECT 
          model_provider,
          model_version,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'success') as success_count,
          ROUND(AVG(latency_ms) FILTER (WHERE status = 'success')) as avg_latency_ms,
          ROUND(
            (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2
          ) as success_rate
        FROM stt_analytics
        WHERE created_at::DATE BETWEEN start_date AND end_date
        GROUP BY model_provider, model_version
      ) model_data
    ),
    'error_breakdown', (
      SELECT COALESCE(json_agg(error_data), '[]'::json)
      FROM (
        SELECT 
          error_message,
          COUNT(*) as count
        FROM stt_analytics
        WHERE created_at::DATE BETWEEN start_date AND end_date
          AND status = 'error'
          AND error_message IS NOT NULL
        GROUP BY error_message
        ORDER BY count DESC
        LIMIT 10
      ) error_data
    ),
    'unique_users', (
      SELECT COUNT(DISTINCT user_id)
      FROM stt_analytics
      WHERE created_at::DATE BETWEEN start_date AND end_date
    )
  ) INTO result;

  RETURN result;
END;
$$;