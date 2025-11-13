-- First, set all carabao life_stage values to NULL to prepare for recalculation
UPDATE animals 
SET life_stage = NULL, milking_stage = NULL 
WHERE livestock_type = 'carabao';

-- Drop the old valid_life_stage constraint
ALTER TABLE animals DROP CONSTRAINT IF EXISTS valid_life_stage;

-- Create new constraint with all existing values plus carabao-specific terms
ALTER TABLE animals ADD CONSTRAINT valid_life_stage CHECK (
  life_stage IS NULL OR
  (
    (livestock_type = 'cattle' AND life_stage IN (
      'Calf',
      'Heifer Calf',
      'Bull Calf',
      'Weaned Heifer',
      'Yearling Heifer',
      'Breeding Heifer',
      'Pregnant Heifer',
      'First Calf Heifer',
      'First-Calf Heifer',
      'Second Lactation Cow',
      'Mature Cow',
      'Weaned Bull',
      'Yearling Bull',
      'Young Bull',
      'Mature Bull',
      'Bull'
    )) OR
    (livestock_type = 'carabao' AND life_stage IN (
      'Carabao Calf',
      'Young Carabao',
      'Breeding Carabao',
      'Pregnant Carabao',
      'First-Time Mother',
      'Mature Carabao',
      'Young Bull Carabao',
      'Mature Bull Carabao'
    )) OR
    (livestock_type = 'goat' AND life_stage IN (
      'Kid',
      'Buckling',
      'Doeling',
      'Young Doe',
      'Breeding Doe',
      'Pregnant Doe',
      'First Freshener',
      'Mature Doe',
      'Young Buck',
      'Mature Buck',
      'Buck'
    )) OR
    (livestock_type = 'sheep' AND life_stage IN (
      'Lamb',
      'Ram Lamb',
      'Ewe Lamb',
      'Young Ewe',
      'Breeding Ewe',
      'Pregnant Ewe',
      'First-Time Mother Ewe',
      'Mature Ewe',
      'Young Ram',
      'Mature Ram'
    ))
  )
)