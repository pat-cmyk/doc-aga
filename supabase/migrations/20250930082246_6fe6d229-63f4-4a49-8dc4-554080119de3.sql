-- Create storage bucket for animal photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('animal-photos', 'animal-photos', true);

-- Add avatar_url column to animals table
ALTER TABLE public.animals 
ADD COLUMN avatar_url text;

-- Create RLS policies for animal photos bucket
CREATE POLICY "Users can view animal photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'animal-photos');

CREATE POLICY "Users can upload animal photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'animal-photos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their animal photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'animal-photos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their animal photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'animal-photos' 
  AND auth.uid() IS NOT NULL
);