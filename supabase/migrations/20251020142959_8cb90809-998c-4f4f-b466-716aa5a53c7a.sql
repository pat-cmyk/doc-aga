-- Clean up feeding records where feed_type is not in inventory
-- This removes test data created before validation was implemented

DELETE FROM feeding_records
WHERE id IN (
  SELECT fr.id
  FROM feeding_records fr
  JOIN animals a ON a.id = fr.animal_id
  LEFT JOIN feed_inventory fi ON fi.farm_id = a.farm_id 
    AND LOWER(TRIM(fi.feed_type)) = LOWER(TRIM(fr.feed_type))
    AND fi.quantity_kg > 0
  WHERE fi.id IS NULL
    AND fr.feed_type IS NOT NULL  -- Only check records that have a feed_type
);