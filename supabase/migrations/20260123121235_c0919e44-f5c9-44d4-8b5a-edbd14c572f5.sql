-- Add configurable backdating limit to farms table
ALTER TABLE public.farms 
ADD COLUMN IF NOT EXISTS max_backdate_days INTEGER DEFAULT 7;

-- Add constraint to ensure valid range (1-30 days)
ALTER TABLE public.farms 
ADD CONSTRAINT max_backdate_days_range 
CHECK (max_backdate_days >= 1 AND max_backdate_days <= 30);

-- Add comment for documentation
COMMENT ON COLUMN public.farms.max_backdate_days IS 
'Maximum number of days users can backdate records. Default: 7, Max: 30';