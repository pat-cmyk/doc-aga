-- Fix search path security warning for validate_milking_gender function
CREATE OR REPLACE FUNCTION validate_milking_gender()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.animals 
    WHERE id = NEW.animal_id 
    AND LOWER(gender) = 'male'
  ) THEN
    RAISE EXCEPTION 'Cannot add milking records for male animals';
  END IF;
  RETURN NEW;
END;
$$;