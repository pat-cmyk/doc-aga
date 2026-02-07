-- Add feedback columns to doc_aga_queries
ALTER TABLE public.doc_aga_queries
ADD COLUMN IF NOT EXISTS feedback_rating text CHECK (feedback_rating IN ('positive', 'negative')),
ADD COLUMN IF NOT EXISTS feedback_comment text,
ADD COLUMN IF NOT EXISTS feedback_at timestamptz;

-- Create index for feedback analytics
CREATE INDEX IF NOT EXISTS idx_doc_aga_queries_feedback 
ON public.doc_aga_queries(feedback_rating) 
WHERE feedback_rating IS NOT NULL;

-- Create faq_candidates table for automatic extraction
CREATE TABLE public.faq_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_pattern text NOT NULL,
  normalized_text text NOT NULL,
  occurrence_count integer DEFAULT 1,
  sample_query_ids uuid[] DEFAULT '{}',
  suggested_answer text,
  suggested_category text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
  converted_faq_id uuid REFERENCES public.doc_aga_faqs(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.faq_candidates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage FAQ candidates
CREATE POLICY "admins_manage_faq_candidates" ON public.faq_candidates
FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.user_role));

-- Create updated_at trigger
CREATE TRIGGER update_faq_candidates_updated_at
BEFORE UPDATE ON public.faq_candidates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for status filtering
CREATE INDEX idx_faq_candidates_status ON public.faq_candidates(status);

-- Add index for normalized text matching
CREATE INDEX idx_faq_candidates_normalized ON public.faq_candidates(normalized_text);

-- Allow users to update their own feedback on their queries
CREATE POLICY "users_update_own_feedback" ON public.doc_aga_queries
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);