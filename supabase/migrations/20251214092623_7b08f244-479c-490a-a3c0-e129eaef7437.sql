-- Drop any existing permissive SELECT policies on doc_aga_faqs
DROP POLICY IF EXISTS "Anyone can view active FAQs" ON public.doc_aga_faqs;
DROP POLICY IF EXISTS "Public can view FAQs" ON public.doc_aga_faqs;
DROP POLICY IF EXISTS "faqs_public_select" ON public.doc_aga_faqs;

-- Create policy requiring authentication to view FAQs
CREATE POLICY "Authenticated users can view FAQs"
ON public.doc_aga_faqs
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admins can manage FAQs (insert, update, delete)
CREATE POLICY "Admins can manage FAQs"
ON public.doc_aga_faqs
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));