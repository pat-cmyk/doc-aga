-- Add entry weight and birth weight columns to animals table
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS entry_weight_kg NUMERIC;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS entry_weight_unknown BOOLEAN DEFAULT FALSE;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS birth_weight_kg NUMERIC;