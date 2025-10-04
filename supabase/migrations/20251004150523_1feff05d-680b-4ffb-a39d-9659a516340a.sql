-- Create RLS policies for product-images storage bucket

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow users to view their own uploaded images
CREATE POLICY "Users can view product images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'product-images');

-- Allow users to update their own images
CREATE POLICY "Users can update their product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');