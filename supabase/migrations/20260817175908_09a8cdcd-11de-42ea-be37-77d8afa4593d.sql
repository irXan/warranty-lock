CREATE POLICY "repair_photos_objects_update_member"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'repair-photos'
  AND app_private.is_workshop_member(auth.uid(), (split_part(name, '/', 1))::uuid)
)
WITH CHECK (
  bucket_id = 'repair-photos'
  AND app_private.is_workshop_member(auth.uid(), (split_part(name, '/', 1))::uuid)
);