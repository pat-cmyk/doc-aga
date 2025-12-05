-- Add semen_code column to ai_records table
ALTER TABLE public.ai_records ADD COLUMN semen_code text;

-- Add index for efficient querying of semen codes in government analytics
CREATE INDEX idx_ai_records_semen_code ON public.ai_records(semen_code) WHERE semen_code IS NOT NULL;