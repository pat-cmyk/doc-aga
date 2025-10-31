-- Drop the existing global unique constraint on ear_tag
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_ear_tag_key;

-- Add a composite unique constraint: ear_tag must be unique within a farm
-- This allows different farms to have the same ear tags (G001, G002, etc.)
ALTER TABLE animals ADD CONSTRAINT animals_farm_ear_tag_unique 
  UNIQUE (farm_id, ear_tag);

-- Add a new column for global unique animal code
ALTER TABLE animals ADD COLUMN IF NOT EXISTS unique_code TEXT;

-- Create a function to generate unique animal codes
CREATE OR REPLACE FUNCTION generate_animal_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code format: AGR-YYYY-NNNNNN
    -- AGR = Agri/Animal, YYYY = year, NNNNNN = 6-digit sequence
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
$$ LANGUAGE plpgsql;

-- Create a trigger function to auto-generate unique codes for new animals
CREATE OR REPLACE FUNCTION set_animal_unique_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unique_code IS NULL THEN
    NEW.unique_code := generate_animal_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to animals table
DROP TRIGGER IF EXISTS trigger_set_animal_unique_code ON animals;
CREATE TRIGGER trigger_set_animal_unique_code
  BEFORE INSERT ON animals
  FOR EACH ROW
  EXECUTE FUNCTION set_animal_unique_code();

-- Backfill existing animals with unique codes
UPDATE animals 
SET unique_code = generate_animal_code()
WHERE unique_code IS NULL;

-- Make unique_code column NOT NULL and add unique constraint
ALTER TABLE animals 
  ALTER COLUMN unique_code SET NOT NULL,
  ADD CONSTRAINT animals_unique_code_key UNIQUE (unique_code);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_animals_unique_code ON animals(unique_code);