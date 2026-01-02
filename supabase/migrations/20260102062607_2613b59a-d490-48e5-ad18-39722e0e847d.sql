-- Phase 4: Database Migration for Offline Sync Support

-- Create enum for sync status
CREATE TYPE sync_status AS ENUM ('pending', 'syncing', 'synced', 'conflict', 'error');

-- Create sync_queue table to track offline operations server-side
CREATE TABLE public.sync_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('insert', 'update', 'delete')),
  table_name TEXT NOT NULL,
  record_id UUID,
  client_generated_id TEXT,
  payload JSONB NOT NULL,
  sync_status sync_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  client_timestamp TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient sync queries
CREATE INDEX idx_sync_queue_farm_status ON public.sync_queue(farm_id, sync_status);
CREATE INDEX idx_sync_queue_user_pending ON public.sync_queue(user_id, sync_status) WHERE sync_status = 'pending';
CREATE INDEX idx_sync_queue_client_id ON public.sync_queue(client_generated_id) WHERE client_generated_id IS NOT NULL;

-- Create sync_conflicts table to track data conflicts
CREATE TABLE public.sync_conflicts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  client_data JSONB NOT NULL,
  server_data JSONB NOT NULL,
  resolution TEXT CHECK (resolution IN ('client_wins', 'server_wins', 'merged', 'pending')),
  resolved_data JSONB,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create index for unresolved conflicts
CREATE INDEX idx_sync_conflicts_pending ON public.sync_conflicts(farm_id, resolution) WHERE resolution = 'pending';

-- Add client_generated_id to record tables that don't have it yet
ALTER TABLE public.milking_records ADD COLUMN IF NOT EXISTS client_generated_id TEXT;
ALTER TABLE public.weight_records ADD COLUMN IF NOT EXISTS client_generated_id TEXT;
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS client_generated_id TEXT;
ALTER TABLE public.feeding_records ADD COLUMN IF NOT EXISTS client_generated_id TEXT;
ALTER TABLE public.ai_records ADD COLUMN IF NOT EXISTS client_generated_id TEXT;
ALTER TABLE public.heat_records ADD COLUMN IF NOT EXISTS client_generated_id TEXT;
ALTER TABLE public.body_condition_scores ADD COLUMN IF NOT EXISTS client_generated_id TEXT;
ALTER TABLE public.farm_expenses ADD COLUMN IF NOT EXISTS client_generated_id TEXT;

-- Create unique indexes for client_generated_id to prevent duplicate syncs
CREATE UNIQUE INDEX IF NOT EXISTS idx_milking_records_client_id ON public.milking_records(client_generated_id) WHERE client_generated_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_weight_records_client_id ON public.weight_records(client_generated_id) WHERE client_generated_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_records_client_id ON public.health_records(client_generated_id) WHERE client_generated_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_feeding_records_client_id ON public.feeding_records(client_generated_id) WHERE client_generated_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_records_client_id ON public.ai_records(client_generated_id) WHERE client_generated_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_heat_records_client_id ON public.heat_records(client_generated_id) WHERE client_generated_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bcs_client_id ON public.body_condition_scores(client_generated_id) WHERE client_generated_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_farm_expenses_client_id ON public.farm_expenses(client_generated_id) WHERE client_generated_id IS NOT NULL;

-- Create farm_sync_checkpoints table to track last sync per farm
CREATE TABLE public.farm_sync_checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_record_timestamp TIMESTAMP WITH TIME ZONE,
  records_synced INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(farm_id, user_id, table_name)
);

-- Create index for checkpoint lookups
CREATE INDEX idx_sync_checkpoints_farm ON public.farm_sync_checkpoints(farm_id, table_name);

-- Enable RLS on new tables
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_sync_checkpoints ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_queue
CREATE POLICY "Users can view own sync queue entries"
  ON public.sync_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync queue entries"
  ON public.sync_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync queue entries"
  ON public.sync_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync queue entries"
  ON public.sync_queue FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for sync_conflicts
CREATE POLICY "Users can view own sync conflicts"
  ON public.sync_conflicts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync conflicts"
  ON public.sync_conflicts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync conflicts"
  ON public.sync_conflicts FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for farm_sync_checkpoints
CREATE POLICY "Users can view own sync checkpoints"
  ON public.farm_sync_checkpoints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own sync checkpoints"
  ON public.farm_sync_checkpoints FOR ALL
  USING (auth.uid() = user_id);

-- Create function to handle sync conflict detection
CREATE OR REPLACE FUNCTION public.detect_sync_conflict(
  p_table_name TEXT,
  p_record_id UUID,
  p_client_timestamp TIMESTAMP WITH TIME ZONE,
  p_client_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server_data JSONB;
  v_server_updated_at TIMESTAMP WITH TIME ZONE;
  v_has_conflict BOOLEAN := FALSE;
BEGIN
  -- Get server data based on table name
  EXECUTE format(
    'SELECT to_jsonb(t.*), t.updated_at FROM %I t WHERE t.id = $1',
    p_table_name
  ) INTO v_server_data, v_server_updated_at USING p_record_id;

  -- Check if server was updated after client timestamp
  IF v_server_updated_at IS NOT NULL AND v_server_updated_at > p_client_timestamp THEN
    v_has_conflict := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'has_conflict', v_has_conflict,
    'server_data', v_server_data,
    'server_updated_at', v_server_updated_at
  );
END;
$$;

-- Create function to update sync checkpoint
CREATE OR REPLACE FUNCTION public.update_sync_checkpoint(
  p_farm_id UUID,
  p_table_name TEXT,
  p_last_record_timestamp TIMESTAMP WITH TIME ZONE,
  p_records_synced INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.farm_sync_checkpoints (
    farm_id,
    user_id,
    table_name,
    last_sync_at,
    last_record_timestamp,
    records_synced,
    updated_at
  ) VALUES (
    p_farm_id,
    auth.uid(),
    p_table_name,
    now(),
    p_last_record_timestamp,
    p_records_synced,
    now()
  )
  ON CONFLICT (farm_id, user_id, table_name)
  DO UPDATE SET
    last_sync_at = now(),
    last_record_timestamp = COALESCE(EXCLUDED.last_record_timestamp, farm_sync_checkpoints.last_record_timestamp),
    records_synced = farm_sync_checkpoints.records_synced + EXCLUDED.records_synced,
    updated_at = now();
END;
$$;