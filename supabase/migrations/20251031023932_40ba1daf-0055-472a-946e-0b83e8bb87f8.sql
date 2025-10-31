-- Drop trigger first to avoid dependency issues
DROP TRIGGER IF EXISTS set_animal_unique_code_trigger ON animals;
DROP TRIGGER IF EXISTS trigger_set_animal_unique_code ON animals;

-- Drop existing functions
DROP FUNCTION IF EXISTS set_animal_unique_code();
DROP FUNCTION IF EXISTS generate_animal_code();

-- Create new function with category support
CREATE OR REPLACE FUNCTION generate_animal_code(animal_type TEXT)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  date_part TEXT;
  sequence_part TEXT;
  new_code TEXT;
BEGIN
  -- Determine prefix based on livestock type
  prefix := CASE animal_type
    WHEN 'cattle' THEN 'LIV'
    WHEN 'goat' THEN 'LIV'
    WHEN 'sheep' THEN 'LIV'
    WHEN 'carabao' THEN 'LIV'
    WHEN 'swine' THEN 'SWI'
    WHEN 'poultry' THEN 'PLT'
    WHEN 'pet' THEN 'PET'
    ELSE 'LIV'
  END;
  
  -- Get current year-month (YYMM)
  date_part := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYMM');
  
  -- Generate 8-digit timestamp-based sequential
  -- Uses microseconds since epoch, modulo 100M to fit in 8 digits
  sequence_part := LPAD(
    ((EXTRACT(EPOCH FROM NOW() AT TIME ZONE 'UTC') * 1000000)::BIGINT % 100000000)::TEXT,
    8,
    '0'
  );
  
  -- Combine parts: PREFIX-YYMM-NNNNNNNN
  new_code := prefix || '-' || date_part || '-' || sequence_part;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger function to pass livestock_type
CREATE OR REPLACE FUNCTION set_animal_unique_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unique_code IS NULL THEN
    NEW.unique_code := generate_animal_code(NEW.livestock_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER set_animal_unique_code_trigger
BEFORE INSERT ON animals
FOR EACH ROW
EXECUTE FUNCTION set_animal_unique_code();