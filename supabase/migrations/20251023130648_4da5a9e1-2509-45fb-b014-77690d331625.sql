-- Phase 1: Add livestock_type to animals table

-- Add livestock_type column with default value
ALTER TABLE animals 
ADD COLUMN livestock_type text DEFAULT 'cattle';

-- Add check constraint for valid livestock types
ALTER TABLE animals
ADD CONSTRAINT valid_livestock_type 
CHECK (livestock_type IN ('cattle', 'goat', 'sheep', 'carabao'));

-- Backfill existing animals with their farm's livestock_type
UPDATE animals 
SET livestock_type = (
  SELECT livestock_type 
  FROM farms 
  WHERE farms.id = animals.farm_id
)
WHERE livestock_type = 'cattle';

-- Make column not null after backfill
ALTER TABLE animals 
ALTER COLUMN livestock_type SET NOT NULL;

-- Note: Keeping livestock_type in farms table as "primary" livestock type for reference
-- It will no longer enforce restrictions on animal types