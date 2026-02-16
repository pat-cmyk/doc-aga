-- Drop old, less-secure storage policies that conflict with the farm_id-checking ones
DROP POLICY IF EXISTS "Users can upload animal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their animal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their animal photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view animal photos" ON storage.objects;