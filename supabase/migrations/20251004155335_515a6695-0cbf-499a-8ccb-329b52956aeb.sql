-- Create weight_records table
CREATE TABLE public.weight_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  weight_kg NUMERIC NOT NULL CHECK (weight_kg > 0 AND weight_kg < 2000),
  measurement_date DATE NOT NULL,
  measurement_method TEXT CHECK (measurement_method IN ('scale', 'visual_estimate', 'tape_measure', 'estimated')),
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add current_weight_kg to animals table
ALTER TABLE public.animals ADD COLUMN current_weight_kg NUMERIC;

-- Enable RLS on weight_records
ALTER TABLE public.weight_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for weight_records
CREATE POLICY "weight_records_select" ON public.weight_records
FOR SELECT USING (
  can_access_farm((SELECT farm_id FROM animals WHERE animals.id = weight_records.animal_id))
);

CREATE POLICY "weight_records_insert" ON public.weight_records
FOR INSERT WITH CHECK (
  can_access_farm((SELECT farm_id FROM animals WHERE animals.id = weight_records.animal_id))
);

CREATE POLICY "weight_records_update" ON public.weight_records
FOR UPDATE USING (
  can_access_farm((SELECT farm_id FROM animals WHERE animals.id = weight_records.animal_id))
);

-- Create function to update animal current weight
CREATE OR REPLACE FUNCTION public.update_animal_current_weight()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.animals
  SET current_weight_kg = NEW.weight_kg
  WHERE id = NEW.animal_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update current weight
CREATE TRIGGER after_weight_insert
AFTER INSERT ON public.weight_records
FOR EACH ROW
EXECUTE FUNCTION public.update_animal_current_weight();

-- Create index for performance
CREATE INDEX idx_weight_records_animal_id ON public.weight_records(animal_id);
CREATE INDEX idx_weight_records_measurement_date ON public.weight_records(measurement_date);