-- Add acquisition columns for new entrant animals
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS acquisition_type TEXT DEFAULT 'purchased';
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS purchase_price NUMERIC;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS grant_source TEXT;
ALTER TABLE public.animals ADD COLUMN IF NOT EXISTS grant_source_other TEXT;