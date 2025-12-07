-- Add sale tracking columns to milking_records
ALTER TABLE public.milking_records 
ADD COLUMN IF NOT EXISTS is_sold boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS price_per_liter numeric,
ADD COLUMN IF NOT EXISTS sale_amount numeric;