-- Phase 1: Fertility Management Data Model Foundation

-- 1. Create fertility_status enum
CREATE TYPE public.fertility_status AS ENUM (
  'not_eligible',      -- Too young, wrong BCS, or male
  'open_cycling',      -- Eligible, not pregnant, awaiting heat
  'in_heat',           -- Optimal breeding window active (auto-expires after 48hrs)
  'bred_waiting',      -- AI performed, waiting for return/non-return (days 0-21)
  'suspected_pregnant', -- No heat return at day 21+, needs confirmation
  'confirmed_pregnant', -- Pregnancy verified
  'fresh_postpartum'   -- Just calved, in Voluntary Waiting Period
);

-- 2. Add fertility columns to animals table
ALTER TABLE public.animals
ADD COLUMN IF NOT EXISTS fertility_status public.fertility_status DEFAULT 'not_eligible',
ADD COLUMN IF NOT EXISTS last_calving_date date,
ADD COLUMN IF NOT EXISTS parity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS services_this_cycle integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS voluntary_waiting_end_date date,
ADD COLUMN IF NOT EXISTS last_ai_date date,
ADD COLUMN IF NOT EXISTS last_heat_date timestamp with time zone;

-- 3. Create breeding_events table to unify reproductive lifecycle
CREATE TABLE public.breeding_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id uuid NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'heat_detected',
    'ai_scheduled',
    'ai_performed',
    'non_return',
    'pregnancy_check_scheduled',
    'pregnancy_confirmed',
    'pregnancy_failed',
    'calving',
    'vwp_ended',
    'heat_return'
  )),
  event_date timestamp with time zone NOT NULL DEFAULT now(),
  related_heat_record_id uuid REFERENCES public.heat_records(id),
  related_ai_record_id uuid REFERENCES public.ai_records(id),
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for breeding_events
CREATE INDEX idx_breeding_events_animal_id ON public.breeding_events(animal_id);
CREATE INDEX idx_breeding_events_farm_id ON public.breeding_events(farm_id);
CREATE INDEX idx_breeding_events_event_date ON public.breeding_events(event_date DESC);
CREATE INDEX idx_breeding_events_event_type ON public.breeding_events(event_type);

-- Create index for fertility_status on animals
CREATE INDEX idx_animals_fertility_status ON public.animals(fertility_status) WHERE is_deleted = false;

-- 4. Enable RLS on breeding_events
ALTER TABLE public.breeding_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for breeding_events
CREATE POLICY "Farm members can view breeding events"
ON public.breeding_events
FOR SELECT
USING (can_access_farm(farm_id));

CREATE POLICY "Farm owners and managers can insert breeding events"
ON public.breeding_events
FOR INSERT
WITH CHECK (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id) OR is_farmhand(auth.uid(), farm_id));

CREATE POLICY "Farm owners and managers can update breeding events"
ON public.breeding_events
FOR UPDATE
USING (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners can delete breeding events"
ON public.breeding_events
FOR DELETE
USING (is_farm_owner(auth.uid(), farm_id));

CREATE POLICY "Government can view all breeding events"
ON public.breeding_events
FOR SELECT
USING (has_role(auth.uid(), 'government'::user_role));

-- 5. Function to update fertility status based on events
CREATE OR REPLACE FUNCTION public.update_animal_fertility_status()
RETURNS TRIGGER AS $$
DECLARE
  v_animal_record RECORD;
  v_new_status public.fertility_status;
BEGIN
  -- Get current animal data
  SELECT * INTO v_animal_record FROM public.animals WHERE id = NEW.animal_id;
  
  -- Determine new status based on event type
  CASE NEW.event_type
    WHEN 'heat_detected' THEN
      v_new_status := 'in_heat';
      UPDATE public.animals 
      SET fertility_status = v_new_status,
          last_heat_date = NEW.event_date,
          updated_at = now()
      WHERE id = NEW.animal_id;
      
    WHEN 'ai_performed' THEN
      v_new_status := 'bred_waiting';
      UPDATE public.animals 
      SET fertility_status = v_new_status,
          last_ai_date = NEW.event_date::date,
          services_this_cycle = COALESCE(services_this_cycle, 0) + 1,
          updated_at = now()
      WHERE id = NEW.animal_id;
      
    WHEN 'non_return' THEN
      v_new_status := 'suspected_pregnant';
      UPDATE public.animals 
      SET fertility_status = v_new_status,
          updated_at = now()
      WHERE id = NEW.animal_id;
      
    WHEN 'pregnancy_confirmed' THEN
      v_new_status := 'confirmed_pregnant';
      UPDATE public.animals 
      SET fertility_status = v_new_status,
          updated_at = now()
      WHERE id = NEW.animal_id;
      
    WHEN 'pregnancy_failed', 'heat_return' THEN
      v_new_status := 'open_cycling';
      UPDATE public.animals 
      SET fertility_status = v_new_status,
          updated_at = now()
      WHERE id = NEW.animal_id;
      
    WHEN 'calving' THEN
      v_new_status := 'fresh_postpartum';
      UPDATE public.animals 
      SET fertility_status = v_new_status,
          last_calving_date = NEW.event_date::date,
          parity = COALESCE(parity, 0) + 1,
          services_this_cycle = 0,
          -- VWP ends 60 days after calving for cattle
          voluntary_waiting_end_date = (NEW.event_date::date + interval '60 days')::date,
          updated_at = now()
      WHERE id = NEW.animal_id;
      
    WHEN 'vwp_ended' THEN
      v_new_status := 'open_cycling';
      UPDATE public.animals 
      SET fertility_status = v_new_status,
          updated_at = now()
      WHERE id = NEW.animal_id;
      
    ELSE
      -- No status change for other events
      NULL;
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic fertility status updates
CREATE TRIGGER trigger_update_fertility_status
AFTER INSERT ON public.breeding_events
FOR EACH ROW
EXECUTE FUNCTION public.update_animal_fertility_status();

-- 6. Function to initialize fertility status for existing animals
CREATE OR REPLACE FUNCTION public.initialize_animal_fertility_status(p_animal_id uuid)
RETURNS public.fertility_status AS $$
DECLARE
  v_animal RECORD;
  v_latest_ai RECORD;
  v_status public.fertility_status;
BEGIN
  SELECT * INTO v_animal FROM public.animals WHERE id = p_animal_id;
  
  -- Males are not breeding eligible
  IF v_animal.gender IS NULL OR lower(v_animal.gender) != 'female' THEN
    RETURN 'not_eligible';
  END IF;
  
  -- Check if confirmed pregnant
  SELECT * INTO v_latest_ai 
  FROM public.ai_records 
  WHERE animal_id = p_animal_id 
  ORDER BY COALESCE(performed_date, scheduled_date) DESC 
  LIMIT 1;
  
  IF v_latest_ai.pregnancy_confirmed = true THEN
    RETURN 'confirmed_pregnant';
  END IF;
  
  -- Check age eligibility (15+ months for cattle)
  IF v_animal.birth_date IS NOT NULL THEN
    IF (CURRENT_DATE - v_animal.birth_date) < 450 THEN -- ~15 months
      RETURN 'not_eligible';
    END IF;
  END IF;
  
  -- Default to open_cycling for eligible females
  RETURN 'open_cycling';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;