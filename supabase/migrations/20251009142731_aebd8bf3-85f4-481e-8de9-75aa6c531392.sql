-- Create validation function to prevent milking records for male animals
CREATE OR REPLACE FUNCTION validate_milking_gender()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM animals 
    WHERE id = NEW.animal_id 
    AND LOWER(gender) = 'male'
  ) THEN
    RAISE EXCEPTION 'Cannot add milking records for male animals';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce validation
CREATE TRIGGER check_milking_gender
  BEFORE INSERT ON milking_records
  FOR EACH ROW
  EXECUTE FUNCTION validate_milking_gender();