-- Add session column to milking_records for AM/PM tracking
ALTER TABLE milking_records ADD COLUMN IF NOT EXISTS session TEXT CHECK (session IN ('AM', 'PM'));