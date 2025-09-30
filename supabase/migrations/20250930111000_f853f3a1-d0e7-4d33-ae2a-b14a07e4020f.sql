-- Create table for daily aggregated farm statistics
CREATE TABLE public.daily_farm_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL,
  stat_date DATE NOT NULL,
  total_milk_liters NUMERIC NOT NULL DEFAULT 0,
  stage_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(farm_id, stat_date)
);

-- Add foreign key constraint
ALTER TABLE public.daily_farm_stats
ADD CONSTRAINT daily_farm_stats_farm_id_fkey 
FOREIGN KEY (farm_id) REFERENCES public.farms(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX idx_daily_farm_stats_farm_date ON public.daily_farm_stats(farm_id, stat_date DESC);

-- Enable RLS
ALTER TABLE public.daily_farm_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view stats for their farms"
ON public.daily_farm_stats
FOR SELECT
USING (can_access_farm(farm_id));

CREATE POLICY "System can insert stats"
ON public.daily_farm_stats
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update stats"
ON public.daily_farm_stats
FOR UPDATE
USING (true);

-- Add updated_at trigger
CREATE TRIGGER update_daily_farm_stats_updated_at
BEFORE UPDATE ON public.daily_farm_stats
FOR EACH ROW
EXECUTE FUNCTION public.handle_timestamp();

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;