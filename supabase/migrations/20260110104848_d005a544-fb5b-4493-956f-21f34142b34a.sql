-- Make doc-aga-images bucket private (was public)
-- This protects AI consultation images containing potentially sensitive animal health information
UPDATE storage.buckets 
SET public = false 
WHERE id = 'doc-aga-images';

-- Drop the public SELECT policy that allows anyone to view
DROP POLICY IF EXISTS "doc_aga_images_select_policy" ON storage.objects;