
-- Add the missing resolution_notes column to health_records table
ALTER TABLE public.health_records 
ADD COLUMN IF NOT EXISTS resolution_notes TEXT DEFAULT NULL;

-- Add a comment for clarity
COMMENT ON COLUMN public.health_records.resolution_notes IS 'Notes about how the health issue was resolved';
