-- Create heat_observation_checks table to track when animals are checked for heat but no signs observed
CREATE TABLE public.heat_observation_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX idx_heat_obs_checks_animal_date ON public.heat_observation_checks(animal_id, checked_at DESC);
CREATE INDEX idx_heat_obs_checks_farm_date ON public.heat_observation_checks(farm_id, checked_at DESC);

-- Enable RLS
ALTER TABLE public.heat_observation_checks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Farm members can insert observation checks"
ON public.heat_observation_checks FOR INSERT
WITH CHECK (
  is_farm_owner(auth.uid(), farm_id) OR 
  is_farm_manager(auth.uid(), farm_id) OR 
  is_farmhand(auth.uid(), farm_id)
);

CREATE POLICY "Farm members can view observation checks"
ON public.heat_observation_checks FOR SELECT
USING (can_access_farm(farm_id));

CREATE POLICY "Farm owners and managers can delete observation checks"
ON public.heat_observation_checks FOR DELETE
USING (
  is_farm_owner(auth.uid(), farm_id) OR 
  is_farm_manager(auth.uid(), farm_id)
);