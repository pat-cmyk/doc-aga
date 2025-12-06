-- Create preventive health schedules table
CREATE TABLE public.preventive_health_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('vaccination', 'deworming')),
  treatment_name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  completed_by UUID REFERENCES public.profiles(id),
  next_due_date DATE,
  recurring_interval_months INTEGER,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'overdue', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create preventive health protocols lookup table (Philippine-specific)
CREATE TABLE public.preventive_health_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livestock_type TEXT NOT NULL CHECK (livestock_type IN ('cattle', 'goat', 'sheep', 'carabao')),
  treatment_type TEXT NOT NULL CHECK (treatment_type IN ('vaccination', 'deworming')),
  treatment_name TEXT NOT NULL,
  treatment_name_tagalog TEXT,
  first_dose_age_months INTEGER,
  recurring_interval_months INTEGER,
  notes TEXT,
  is_mandatory BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'PH-BAI',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.preventive_health_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventive_health_protocols ENABLE ROW LEVEL SECURITY;

-- RLS Policies for preventive_health_schedules
CREATE POLICY "Farm members can view schedules" ON public.preventive_health_schedules
FOR SELECT USING (can_access_farm(farm_id));

CREATE POLICY "Farm owners and managers can insert schedules" ON public.preventive_health_schedules
FOR INSERT WITH CHECK (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id) OR is_farmhand(auth.uid(), farm_id));

CREATE POLICY "Farm owners and managers can update schedules" ON public.preventive_health_schedules
FOR UPDATE USING (is_farm_owner(auth.uid(), farm_id) OR is_farm_manager(auth.uid(), farm_id));

CREATE POLICY "Farm owners can delete schedules" ON public.preventive_health_schedules
FOR DELETE USING (is_farm_owner(auth.uid(), farm_id));

CREATE POLICY "Government can view all schedules" ON public.preventive_health_schedules
FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- RLS Policies for preventive_health_protocols (read-only for all authenticated)
CREATE POLICY "Authenticated users can view protocols" ON public.preventive_health_protocols
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_preventive_health_schedules_animal ON public.preventive_health_schedules(animal_id);
CREATE INDEX idx_preventive_health_schedules_farm ON public.preventive_health_schedules(farm_id);
CREATE INDEX idx_preventive_health_schedules_status_date ON public.preventive_health_schedules(status, scheduled_date);
CREATE INDEX idx_preventive_health_protocols_livestock ON public.preventive_health_protocols(livestock_type, treatment_type);

-- Trigger to update updated_at
CREATE TRIGGER update_preventive_health_schedules_updated_at
BEFORE UPDATE ON public.preventive_health_schedules
FOR EACH ROW EXECUTE FUNCTION handle_timestamp();

-- Function to get upcoming alerts for dashboard
CREATE OR REPLACE FUNCTION public.get_upcoming_alerts(p_farm_id UUID, p_days_ahead INTEGER DEFAULT 7)
RETURNS TABLE (
  alert_type TEXT,
  alert_title TEXT,
  animal_id UUID,
  animal_name TEXT,
  animal_ear_tag TEXT,
  due_date DATE,
  days_until_due INTEGER,
  urgency TEXT,
  schedule_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check access
  IF NOT can_access_farm(p_farm_id) THEN
    RAISE EXCEPTION 'Access denied to farm';
  END IF;

  RETURN QUERY
  -- Preventive health schedules (vaccinations/deworming)
  SELECT 
    phs.schedule_type::TEXT as alert_type,
    phs.treatment_name as alert_title,
    a.id as animal_id,
    a.name as animal_name,
    a.ear_tag as animal_ear_tag,
    phs.scheduled_date as due_date,
    (phs.scheduled_date - CURRENT_DATE)::INTEGER as days_until_due,
    CASE 
      WHEN phs.scheduled_date < CURRENT_DATE THEN 'overdue'
      WHEN phs.scheduled_date <= CURRENT_DATE + 1 THEN 'urgent'
      WHEN phs.scheduled_date <= CURRENT_DATE + 3 THEN 'soon'
      ELSE 'upcoming'
    END as urgency,
    phs.id as schedule_id
  FROM preventive_health_schedules phs
  JOIN animals a ON a.id = phs.animal_id
  WHERE phs.farm_id = p_farm_id
    AND phs.status = 'scheduled'
    AND phs.scheduled_date <= CURRENT_DATE + p_days_ahead
    AND a.is_deleted = false
  
  UNION ALL
  
  -- Expected deliveries from AI records
  SELECT 
    'delivery'::TEXT as alert_type,
    'Expected Delivery' as alert_title,
    a.id as animal_id,
    a.name as animal_name,
    a.ear_tag as animal_ear_tag,
    air.expected_delivery_date as due_date,
    (air.expected_delivery_date - CURRENT_DATE)::INTEGER as days_until_due,
    CASE 
      WHEN air.expected_delivery_date < CURRENT_DATE THEN 'overdue'
      WHEN air.expected_delivery_date <= CURRENT_DATE + 1 THEN 'urgent'
      WHEN air.expected_delivery_date <= CURRENT_DATE + 3 THEN 'soon'
      ELSE 'upcoming'
    END as urgency,
    air.id as schedule_id
  FROM ai_records air
  JOIN animals a ON a.id = air.animal_id
  WHERE a.farm_id = p_farm_id
    AND air.pregnancy_confirmed = true
    AND air.expected_delivery_date IS NOT NULL
    AND air.expected_delivery_date <= CURRENT_DATE + p_days_ahead
    AND a.is_deleted = false
  
  ORDER BY due_date ASC, urgency DESC;
END;
$$;

-- Seed Philippine-specific protocols
INSERT INTO public.preventive_health_protocols (livestock_type, treatment_type, treatment_name, treatment_name_tagalog, first_dose_age_months, recurring_interval_months, is_mandatory, notes) VALUES
-- Cattle Vaccinations
('cattle', 'vaccination', 'FMD (Foot & Mouth Disease)', 'Bakuna sa FMD', 3, 6, true, 'Required by BAI. Booster every 6 months.'),
('cattle', 'vaccination', 'Hemorrhagic Septicemia (HS)', 'Bakuna sa HS', 3, 12, true, 'Annual vaccination recommended.'),
('cattle', 'vaccination', 'Blackleg', 'Bakuna sa Blackleg', 3, 12, false, 'Annual vaccination for endemic areas.'),
('cattle', 'vaccination', 'Brucellosis', 'Bakuna sa Brucellosis', 4, NULL, true, 'One-time vaccination for heifers 4-8 months.'),
('cattle', 'vaccination', 'Anthrax', 'Bakuna sa Anthrax', 6, 12, false, 'For endemic areas only.'),

-- Carabao Vaccinations
('carabao', 'vaccination', 'FMD (Foot & Mouth Disease)', 'Bakuna sa FMD', 3, 6, true, 'Required by BAI. Booster every 6 months.'),
('carabao', 'vaccination', 'Hemorrhagic Septicemia (HS)', 'Bakuna sa HS', 3, 12, true, 'Annual vaccination recommended.'),
('carabao', 'vaccination', 'Blackleg', 'Bakuna sa Blackleg', 3, 12, false, 'Annual vaccination for endemic areas.'),
('carabao', 'vaccination', 'Surra', 'Bakuna sa Surra', 6, 12, false, 'For areas with high fly population.'),

-- Goat Vaccinations
('goat', 'vaccination', 'PPR (Peste des Petits Ruminants)', 'Bakuna sa PPR', 3, 36, true, 'Single dose provides 3 years protection.'),
('goat', 'vaccination', 'Goat Pox', 'Bakuna sa Goat Pox', 3, 12, false, 'Annual vaccination in endemic areas.'),
('goat', 'vaccination', 'Hemorrhagic Septicemia (HS)', 'Bakuna sa HS', 3, 12, false, 'Annual vaccination recommended.'),
('goat', 'vaccination', 'Enterotoxemia', 'Bakuna sa Enterotoxemia', 2, 6, false, 'For feedlot operations.'),

-- Sheep Vaccinations
('sheep', 'vaccination', 'PPR (Peste des Petits Ruminants)', 'Bakuna sa PPR', 3, 36, true, 'Single dose provides 3 years protection.'),
('sheep', 'vaccination', 'Sheep Pox', 'Bakuna sa Sheep Pox', 3, 12, false, 'Annual vaccination in endemic areas.'),
('sheep', 'vaccination', 'Enterotoxemia', 'Bakuna sa Enterotoxemia', 2, 6, false, 'For feedlot operations.'),

-- Deworming for all (Pre-monsoon: May-June, Post-monsoon: Oct-Nov)
('cattle', 'deworming', 'Pre-Monsoon Deworming', 'Pagpapurga Bago Ulan', 3, 6, true, 'Use Ivermectin or Albendazole. May-June schedule.'),
('cattle', 'deworming', 'Post-Monsoon Deworming', 'Pagpapurga Pagkatapos ng Ulan', 3, 6, true, 'Use Ivermectin or Albendazole. Oct-Nov schedule.'),
('carabao', 'deworming', 'Pre-Monsoon Deworming', 'Pagpapurga Bago Ulan', 3, 6, true, 'Use Ivermectin or Albendazole. May-June schedule.'),
('carabao', 'deworming', 'Post-Monsoon Deworming', 'Pagpapurga Pagkatapos ng Ulan', 3, 6, true, 'Use Ivermectin or Albendazole. Oct-Nov schedule.'),
('goat', 'deworming', 'Pre-Monsoon Deworming', 'Pagpapurga Bago Ulan', 2, 4, true, 'Use Fenbendazole or Albendazole. More frequent for goats.'),
('goat', 'deworming', 'Post-Monsoon Deworming', 'Pagpapurga Pagkatapos ng Ulan', 2, 4, true, 'Use Fenbendazole or Albendazole. More frequent for goats.'),
('sheep', 'deworming', 'Pre-Monsoon Deworming', 'Pagpapurga Bago Ulan', 2, 4, true, 'Use Fenbendazole or Albendazole. More frequent for sheep.'),
('sheep', 'deworming', 'Post-Monsoon Deworming', 'Pagpapurga Pagkatapos ng Ulan', 2, 4, true, 'Use Fenbendazole or Albendazole. More frequent for sheep.'),

-- Additional common treatments
('cattle', 'deworming', 'Liver Fluke Treatment', 'Gamot sa Liver Fluke', 6, 6, false, 'Use Triclabendazole for fluke-endemic areas.'),
('carabao', 'deworming', 'Liver Fluke Treatment', 'Gamot sa Liver Fluke', 6, 6, false, 'Use Triclabendazole for fluke-endemic areas. Common in carabaos.'),
('goat', 'deworming', 'Coccidia Treatment', 'Gamot sa Coccidia', 1, 3, false, 'Use Amprolium for young goats.'),
('sheep', 'deworming', 'Coccidia Treatment', 'Gamot sa Coccidia', 1, 3, false, 'Use Amprolium for young sheep.');