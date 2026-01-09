-- Fix existing animals: set is_currently_lactating = true for animals with recent milk records
UPDATE animals
SET is_currently_lactating = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT animal_id 
  FROM milking_records 
  WHERE record_date >= CURRENT_DATE - INTERVAL '30 days'
    AND is_sold = false
)
AND (is_currently_lactating = false OR is_currently_lactating IS NULL);