-- Create storage bucket for doc aga query images
INSERT INTO storage.buckets (id, name, public)
VALUES ('doc-aga-images', 'doc-aga-images', true);

-- Create RLS policies for doc-aga-images bucket
CREATE POLICY "Users can upload their own doc aga images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'doc-aga-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own doc aga images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'doc-aga-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add image_url column to doc_aga_queries table
ALTER TABLE public.doc_aga_queries
ADD COLUMN image_url text;