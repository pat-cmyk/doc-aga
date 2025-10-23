-- Create transcription corrections table for user feedback
CREATE TABLE IF NOT EXISTS public.transcription_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  audio_duration_seconds NUMERIC,
  context TEXT, -- e.g., 'milking', 'feeding', 'health'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transcription_corrections ENABLE ROW LEVEL SECURITY;

-- Users can insert their own corrections
CREATE POLICY transcription_corrections_insert ON public.transcription_corrections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own corrections
CREATE POLICY transcription_corrections_select ON public.transcription_corrections
FOR SELECT
USING (auth.uid() = user_id);

-- Farm owners/managers can view corrections from their farm members
CREATE POLICY transcription_corrections_farm_select ON public.transcription_corrections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.farms f
    WHERE f.id = transcription_corrections.farm_id
    AND (is_farm_owner(auth.uid(), f.id) OR is_farm_manager(auth.uid(), f.id))
  )
);

-- Create index for performance
CREATE INDEX idx_transcription_corrections_user_id ON public.transcription_corrections(user_id);
CREATE INDEX idx_transcription_corrections_farm_id ON public.transcription_corrections(farm_id);
CREATE INDEX idx_transcription_corrections_created_at ON public.transcription_corrections(created_at DESC);