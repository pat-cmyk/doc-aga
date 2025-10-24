-- Policies for farm-logos bucket on storage.objects
-- Allow public read (since bucket is public)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read farm-logos'
  ) THEN
    CREATE POLICY "Public read farm-logos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'farm-logos');
  END IF;
END$$;

-- Allow authenticated users who can access the farm (first folder = farm_id) to upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Farm members upload farm-logos'
  ) THEN
    CREATE POLICY "Farm members upload farm-logos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'farm-logos'
      AND public.can_access_farm(((storage.foldername(name))[1])::uuid)
    );
  END IF;
END$$;

-- Allow updates by farm members on their own farm folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Farm members update farm-logos'
  ) THEN
    CREATE POLICY "Farm members update farm-logos"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'farm-logos'
      AND public.can_access_farm(((storage.foldername(name))[1])::uuid)
    )
    WITH CHECK (
      bucket_id = 'farm-logos'
      AND public.can_access_farm(((storage.foldername(name))[1])::uuid)
    );
  END IF;
END$$;

-- Allow delete by farm members on their own farm folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Farm members delete farm-logos'
  ) THEN
    CREATE POLICY "Farm members delete farm-logos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'farm-logos'
      AND public.can_access_farm(((storage.foldername(name))[1])::uuid)
    );
  END IF;
END$$;