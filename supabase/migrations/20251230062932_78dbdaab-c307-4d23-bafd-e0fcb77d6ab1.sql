-- Add farm entry date and unknown flags for new entrant animals
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS farm_entry_date DATE;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS birth_date_unknown BOOLEAN DEFAULT FALSE;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS mother_unknown BOOLEAN DEFAULT FALSE;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS father_unknown BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.animals.farm_entry_date IS 'Date when the animal was introduced to the farm (for new entrants)';
COMMENT ON COLUMN public.animals.birth_date_unknown IS 'True if birth date is unknown (for new entrants)';
COMMENT ON COLUMN public.animals.mother_unknown IS 'True if mother is unknown (for new entrants)';
COMMENT ON COLUMN public.animals.father_unknown IS 'True if father is unknown (for new entrants)';