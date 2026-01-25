-- Create OVR cache table for single source of truth
CREATE TABLE public.animal_ovr_cache (
  animal_id UUID PRIMARY KEY REFERENCES public.animals(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 50,
  tier TEXT NOT NULL DEFAULT 'silver',
  trend TEXT NOT NULL DEFAULT 'stable',
  breakdown JSONB DEFAULT '{}'::jsonb,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.animal_ovr_cache ENABLE ROW LEVEL SECURITY;

-- Allow read access for users who can access the animal's farm
CREATE POLICY "Users can view OVR cache for their farm animals"
ON public.animal_ovr_cache
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.animals a
    JOIN public.farm_memberships fm ON fm.farm_id = a.farm_id
    WHERE a.id = animal_ovr_cache.animal_id
    AND fm.user_id = auth.uid()
    AND fm.invitation_status = 'accepted'
  )
);

-- Allow insert/update for users who can access the animal's farm
CREATE POLICY "Users can upsert OVR cache for their farm animals"
ON public.animal_ovr_cache
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.animals a
    JOIN public.farm_memberships fm ON fm.farm_id = a.farm_id
    WHERE a.id = animal_ovr_cache.animal_id
    AND fm.user_id = auth.uid()
    AND fm.invitation_status = 'accepted'
  )
);

CREATE POLICY "Users can update OVR cache for their farm animals"
ON public.animal_ovr_cache
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.animals a
    JOIN public.farm_memberships fm ON fm.farm_id = a.farm_id
    WHERE a.id = animal_ovr_cache.animal_id
    AND fm.user_id = auth.uid()
    AND fm.invitation_status = 'accepted'
  )
);

-- Add index for faster lookups
CREATE INDEX idx_animal_ovr_cache_computed_at ON public.animal_ovr_cache(computed_at);

-- Add trigger for updated_at
CREATE TRIGGER update_animal_ovr_cache_updated_at
BEFORE UPDATE ON public.animal_ovr_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.animal_ovr_cache IS 'Caches computed OVR scores for animals - single source of truth for both list and detail views';