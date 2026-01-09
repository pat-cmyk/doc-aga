-- Set milking_start_date for existing lactating animals based on their first milking record
-- This enables automatic milking stage progression
UPDATE animals a
SET milking_start_date = (
  SELECT MIN(record_date)
  FROM milking_records mr
  WHERE mr.animal_id = a.id AND mr.is_sold = false
)
WHERE a.is_currently_lactating = true
  AND a.milking_start_date IS NULL
  AND EXISTS (
    SELECT 1 FROM milking_records mr 
    WHERE mr.animal_id = a.id AND mr.is_sold = false
  );