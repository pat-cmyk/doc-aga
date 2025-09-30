-- Add life_stage and milking_stage columns to animals table
ALTER TABLE public.animals 
ADD COLUMN life_stage TEXT,
ADD COLUMN milking_stage TEXT;

-- Add check constraints for valid values
ALTER TABLE public.animals
ADD CONSTRAINT valid_life_stage CHECK (
  life_stage IS NULL OR life_stage IN (
    'Calf',
    'Heifer Calf',
    'Yearling Heifer',
    'Breeding Heifer',
    'Pregnant Heifer',
    'First-Calf Heifer',
    'Mature Cow',
    'Dry Cow'
  )
);

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

COMMENT ON COLUMN public.animals.life_stage IS 'Life stage of female cattle';
COMMENT ON COLUMN public.animals.milking_stage IS 'Milking/lactation stage of female cattle';