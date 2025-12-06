
-- =============================================
-- PHASE 2 & 3: Heat Detection, Exit Tracking, BCS, Photo Milestones
-- =============================================

-- 1. Create heat_records table for estrus/heat cycle tracking
CREATE TABLE public.heat_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  detection_method TEXT NOT NULL DEFAULT 'visual',
  intensity TEXT DEFAULT 'normal',
  standing_heat BOOLEAN DEFAULT false,
  optimal_breeding_start TIMESTAMP WITH TIME ZONE,
  optimal_breeding_end TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on heat_records
ALTER TABLE public.heat_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for heat_records
CREATE POLICY "Farm members can view heat records"
  ON public.heat_records FOR SELECT
  USING (can_access_farm(farm_id));

CREATE POLICY "Farm members can insert heat records"
  ON public.heat_records FOR INSERT
  WITH CHECK (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id) OR is_farmhand(auth.uid(), farm_id));

CREATE POLICY "Farm owners and managers can update heat records"
  ON public.heat_records FOR UPDATE
  USING (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners can delete heat records"
  ON public.heat_records FOR DELETE
  USING (is_farm_owner(auth.uid(), farm_id));

-- 2. Add exit tracking columns to animals table
ALTER TABLE public.animals 
  ADD COLUMN IF NOT EXISTS exit_date DATE,
  ADD COLUMN IF NOT EXISTS exit_reason TEXT,
  ADD COLUMN IF NOT EXISTS exit_reason_details TEXT,
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC,
  ADD COLUMN IF NOT EXISTS buyer_info TEXT,
  ADD COLUMN IF NOT EXISTS exit_notes TEXT;

-- 3. Create body_condition_scores table
CREATE TABLE public.body_condition_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  score NUMERIC(2,1) NOT NULL CHECK (score >= 1.0 AND score <= 5.0),
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assessor_id UUID REFERENCES public.profiles(id),
  photo_id UUID REFERENCES public.animal_photos(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on body_condition_scores
ALTER TABLE public.body_condition_scores ENABLE ROW LEVEL SECURITY;

-- RLS policies for body_condition_scores
CREATE POLICY "Farm members can view BCS"
  ON public.body_condition_scores FOR SELECT
  USING (can_access_farm(farm_id));

CREATE POLICY "Farm members can insert BCS"
  ON public.body_condition_scores FOR INSERT
  WITH CHECK (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id) OR is_farmhand(auth.uid(), farm_id));

CREATE POLICY "Farm owners and managers can update BCS"
  ON public.body_condition_scores FOR UPDATE
  USING (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners can delete BCS"
  ON public.body_condition_scores FOR DELETE
  USING (is_farm_owner(auth.uid(), farm_id));

-- 4. Add milestone_type to animal_photos
ALTER TABLE public.animal_photos 
  ADD COLUMN IF NOT EXISTS milestone_type TEXT;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_heat_records_animal_id ON public.heat_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_heat_records_farm_id ON public.heat_records(farm_id);
CREATE INDEX IF NOT EXISTS idx_heat_records_detected_at ON public.heat_records(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_bcs_animal_id ON public.body_condition_scores(animal_id);
CREATE INDEX IF NOT EXISTS idx_bcs_farm_id ON public.body_condition_scores(farm_id);
CREATE INDEX IF NOT EXISTS idx_bcs_assessment_date ON public.body_condition_scores(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_animals_exit_date ON public.animals(exit_date) WHERE exit_date IS NOT NULL;

-- 6. Government can view heat records and BCS for analytics
CREATE POLICY "Government can view all heat records"
  ON public.heat_records FOR SELECT
  USING (has_role(auth.uid(), 'government'::user_role));

CREATE POLICY "Government can view all BCS"
  ON public.body_condition_scores FOR SELECT
  USING (has_role(auth.uid(), 'government'::user_role));
