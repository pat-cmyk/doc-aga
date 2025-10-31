-- Drop and recreate the generate_animal_code function with RUM prefix for ruminants
DROP FUNCTION IF EXISTS generate_animal_code(TEXT);

CREATE OR REPLACE FUNCTION generate_animal_code(animal_type TEXT)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  date_part TEXT;
  sequence_part TEXT;
  new_code TEXT;
BEGIN
  -- Determine prefix based on livestock type - RUM for ruminants
  prefix := CASE animal_type
    WHEN 'cattle' THEN 'RUM'
    WHEN 'goat' THEN 'RUM'
    WHEN 'sheep' THEN 'RUM'
    WHEN 'carabao' THEN 'RUM'
    WHEN 'swine' THEN 'SWI'
    WHEN 'poultry' THEN 'PLT'
    WHEN 'pet' THEN 'PET'
    ELSE 'RUM'  -- Default to RUM for ruminants
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