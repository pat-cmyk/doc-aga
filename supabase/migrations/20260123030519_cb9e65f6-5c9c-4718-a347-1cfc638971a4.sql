-- Create storage bucket for APK releases
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-releases',
  'app-releases',
  true,
  104857600, -- 100MB limit
  ARRAY['application/vnd.android.package-archive', 'application/json', 'application/octet-stream']
);

-- Allow public read access to app releases
CREATE POLICY "Public read access for app releases"
ON storage.objects
FOR SELECT
USING (bucket_id = 'app-releases');

-- Allow authenticated admins to upload releases
CREATE POLICY "Admins can upload app releases"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'app-releases' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow admins to update releases
CREATE POLICY "Admins can update app releases"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'app-releases'
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Allow admins to delete releases
CREATE POLICY "Admins can delete app releases"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'app-releases'
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);