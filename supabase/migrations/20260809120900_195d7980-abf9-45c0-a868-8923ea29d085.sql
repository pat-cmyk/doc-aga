DROP POLICY IF EXISTS "doc_aga_images_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "doc_aga_images_delete_policy" ON storage.objects;

CREATE POLICY "doc_aga_images_insert_policy"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'doc-aga-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "doc_aga_images_delete_policy"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'doc-aga-images' AND (storage.foldername(name))[1] = (auth.uid())::text);