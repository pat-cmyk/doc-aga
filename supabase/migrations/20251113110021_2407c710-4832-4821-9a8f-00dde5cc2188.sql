-- Drop the existing restrictive life_stage constraint
ALTER TABLE public.animals DROP CONSTRAINT IF EXISTS valid_life_stage;

-- Drop the existing restrictive milking_stage constraint  
ALTER TABLE public.animals DROP CONSTRAINT IF EXISTS valid_milking_stage;

-- Add updated life_stage constraint that supports all livestock types
ALTER TABLE public.animals
ADD CONSTRAINT valid_life_stage CHECK (
  life_stage IS NULL OR 
  (
    -- Cattle life stages
    (livestock_type = 'cattle' AND life_stage IN (
      'Calf',
      'Heifer Calf',
      'Yearling Heifer',
      'Breeding Heifer',
      'Pregnant Heifer',
      'First-Calf Heifer',
      'Mature Cow',
      'Dry Cow',
      'Bull'
    )) OR
    -- Goat life stages
    (livestock_type = 'goat' AND life_stage IN (
      'Kid',
      'Weaner',
      'Doeling',
      'Buckling',
      'Breeding Doe',
      'Pregnant Doe',
      'Lactating Doe',
      'Dry Doe',
      'Buck'
    )) OR
    -- Carabao life stages (similar to cattle)
    (livestock_type = 'carabao' AND life_stage IN (
      'Calf',
      'Heifer Calf',
      'Yearling Heifer',
      'Breeding Heifer',
      'Pregnant Heifer',
      'First-Calf Heifer',
      'Mature Cow',
      'Dry Cow',
      'Bull'
    )) OR
    -- Sheep life stages (similar to goats)
    (livestock_type = 'sheep' AND life_stage IN (
      'Lamb',
      'Weaner',
      'Ewe Lamb',
      'Ram Lamb',
      'Breeding Ewe',
      'Pregnant Ewe',
      'Lactating Ewe',
      'Dry Ewe',
      'Ram'
    ))
  )
);

-- Add updated milking_stage constraint
ALTER TABLE public.animals
ADD CONSTRAINT valid_milking_stage CHECK (
  milking_stage IS NULL OR milking_stage IN (
    'Early Lactation',
    'Mid-Lactation',
    'Late Lactation',
    'Dry Period',
    'Not Milking'
  )
);