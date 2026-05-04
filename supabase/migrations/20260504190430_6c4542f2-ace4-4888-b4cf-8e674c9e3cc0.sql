
DROP POLICY IF EXISTS "org_assets_public_read" ON storage.objects;

-- Members can list/read files of their org via API
CREATE POLICY "org_assets_list_member" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND public.is_org_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );
-- Logo URLs themselves are still publicly viewable since the bucket is public
