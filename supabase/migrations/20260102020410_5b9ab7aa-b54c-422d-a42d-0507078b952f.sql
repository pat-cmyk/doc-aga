-- Enhancement 1: Add columns for "Currently Lactating" toggle
-- These columns allow new entrant animals to immediately be eligible for milk recording
-- without requiring offspring records

ALTER TABLE animals 
ADD COLUMN IF NOT EXISTS is_currently_lactating BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS estimated_days_in_milk INTEGER;

-- Add a comment for documentation
COMMENT ON COLUMN animals.is_currently_lactating IS 'For new entrants: indicates if animal is currently producing milk without calving history in system';
COMMENT ON COLUMN animals.estimated_days_in_milk IS 'For new entrants marked as lactating: estimated days since last calving (0-305)';