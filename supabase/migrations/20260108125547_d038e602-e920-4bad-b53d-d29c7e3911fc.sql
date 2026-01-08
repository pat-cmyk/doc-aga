-- Fix function search path to address security warning
CREATE OR REPLACE FUNCTION public.update_milking_stage_on_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if milking_stage is currently null or animal is in a non-milking state
  UPDATE public.animals
  SET 
    milking_stage = 'Early Lactation',
    updated_at = now()
  WHERE id = NEW.animal_id
    AND (milking_stage IS NULL OR milking_stage NOT IN ('Early Lactation', 'Mid Lactation', 'Late Lactation', 'Peak Lactation'));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;