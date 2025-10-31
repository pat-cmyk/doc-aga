-- Fix search_path for generate_animal_code function
CREATE OR REPLACE FUNCTION generate_animal_code()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code format: AGR-YYYY-NNNNNN
    new_code := 'AGR-' || 
                TO_CHAR(NOW(), 'YYYY') || '-' ||
                LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
    
    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM animals WHERE unique_code = new_code
    ) INTO code_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Fix search_path for set_animal_unique_code function
CREATE OR REPLACE FUNCTION set_animal_unique_code()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.unique_code IS NULL THEN
    NEW.unique_code := generate_animal_code();
  END IF;
  RETURN NEW;
END;
$$;