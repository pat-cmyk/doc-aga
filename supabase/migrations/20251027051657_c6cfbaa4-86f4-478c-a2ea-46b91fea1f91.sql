-- =============================================
-- SECURITY COMPLIANCE: Storage Bucket Policies
-- =============================================

-- Fix animal-photos bucket policies
CREATE POLICY "animal_photos_select_policy"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'animal-photos');

CREATE POLICY "animal_photos_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'animal-photos' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM farms WHERE owner_id = auth.uid()
    UNION
    SELECT farm_id FROM farm_memberships WHERE user_id = auth.uid() AND invitation_status = 'accepted'
  )
);

CREATE POLICY "animal_photos_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'animal-photos'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM farms WHERE owner_id = auth.uid()
    UNION
    SELECT farm_id FROM farm_memberships WHERE user_id = auth.uid() AND invitation_status = 'accepted'
  )
);

CREATE POLICY "animal_photos_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'animal-photos'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM farms WHERE owner_id = auth.uid()
    UNION
    SELECT farm_id FROM farm_memberships WHERE user_id = auth.uid() AND invitation_status = 'accepted'
  )
);

-- Fix doc-aga-images bucket policies
CREATE POLICY "doc_aga_images_select_policy"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'doc-aga-images');

CREATE POLICY "doc_aga_images_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'doc-aga-images'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "doc_aga_images_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'doc-aga-images'
  AND auth.uid() IS NOT NULL
);

-- Fix merchant-logos bucket policies
CREATE POLICY "merchant_logos_select_policy"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'merchant-logos');

CREATE POLICY "merchant_logos_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'merchant-logos'
  AND auth.uid() IN (SELECT user_id FROM merchants)
);

CREATE POLICY "merchant_logos_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'merchant-logos'
  AND auth.uid() IN (SELECT user_id FROM merchants)
);

CREATE POLICY "merchant_logos_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'merchant-logos'
  AND auth.uid() IN (SELECT user_id FROM merchants)
);

-- Fix product-images bucket policies (update existing)
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;

CREATE POLICY "product_images_select_policy"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid() IN (SELECT user_id FROM merchants)
);

CREATE POLICY "product_images_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid() IN (SELECT user_id FROM merchants)
);

CREATE POLICY "product_images_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid() IN (SELECT user_id FROM merchants)
);

-- Fix ad-campaign-images bucket policies (update existing)
DROP POLICY IF EXISTS "Ad campaign images publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Ad images readable" ON storage.objects;

CREATE POLICY "ad_campaign_images_select_policy"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'ad-campaign-images');

CREATE POLICY "ad_campaign_images_insert_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ad-campaign-images'
  AND (is_super_admin(auth.uid()) OR auth.uid() IN (SELECT user_id FROM merchants))
);

CREATE POLICY "ad_campaign_images_update_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ad-campaign-images'
  AND (is_super_admin(auth.uid()) OR auth.uid() IN (SELECT user_id FROM merchants))
);

CREATE POLICY "ad_campaign_images_delete_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ad-campaign-images'
  AND (is_super_admin(auth.uid()) OR auth.uid() IN (SELECT user_id FROM merchants))
);

-- Update storage bucket configurations with file size limits and allowed MIME types
UPDATE storage.buckets
SET 
  file_size_limit = 5242880, -- 5MB limit
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id IN ('animal-photos', 'doc-aga-images', 'merchant-logos', 'product-images', 'ad-campaign-images');

-- voice-training-samples already has proper auth-only access (private bucket)