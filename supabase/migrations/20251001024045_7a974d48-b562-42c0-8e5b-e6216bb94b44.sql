-- Drop existing table if it exists to start fresh
DROP TABLE IF EXISTS public.monthly_farm_stats CASCADE;

-- Create monthly farm stats table
CREATE TABLE public.monthly_farm_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  month_date DATE NOT NULL, -- Last day of the month
  stage_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(farm_id, month_date)
);

-- Enable RLS
ALTER TABLE public.monthly_farm_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view stats for their farms"
  ON public.monthly_farm_stats
  FOR SELECT
  USING (can_access_farm(farm_id));

CREATE POLICY "System can insert stats"
  ON public.monthly_farm_stats
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update stats"
  ON public.monthly_farm_stats
  FOR UPDATE
  USING (true);

-- Add index for better performance
CREATE INDEX idx_monthly_farm_stats_farm_date ON public.monthly_farm_stats(farm_id, month_date);

-- Add trigger for updated_at
CREATE TRIGGER update_monthly_farm_stats_updated_at
  BEFORE UPDATE ON public.monthly_farm_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_timestamp();