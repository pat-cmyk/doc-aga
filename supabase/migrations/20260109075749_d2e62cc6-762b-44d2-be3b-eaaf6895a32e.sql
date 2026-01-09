-- Step 1: Update existing null sessions based on creation time
UPDATE milking_records
SET session = CASE 
  WHEN EXTRACT(HOUR FROM created_at) < 12 THEN 'AM'
  ELSE 'PM'
END
WHERE session IS NULL;

-- Step 2: Make session column NOT NULL going forward
ALTER TABLE milking_records 
ALTER COLUMN session SET NOT NULL;

-- Step 3: Drop old constraint that blocks AM/PM on same day
ALTER TABLE milking_records 
DROP CONSTRAINT IF EXISTS milking_records_animal_id_record_date_key;

-- Step 4: Add new constraint that includes session
ALTER TABLE milking_records 
ADD CONSTRAINT milking_records_animal_date_session_key 
UNIQUE (animal_id, record_date, session);