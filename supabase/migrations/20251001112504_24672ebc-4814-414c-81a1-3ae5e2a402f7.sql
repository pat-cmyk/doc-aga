-- Add pregnancy tracking fields to ai_records table
ALTER TABLE public.ai_records 
ADD COLUMN pregnancy_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN expected_delivery_date DATE,
ADD COLUMN confirmed_at TIMESTAMP WITH TIME ZONE;