CREATE TYPE public.repair_photo_category AS ENUM ('before', 'during', 'after');

CREATE TABLE public.repair_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  category public.repair_photo_category NOT NULL DEFAULT 'before',
  caption text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX repair_photos_receipt_idx ON public.repair_photos (receipt_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.repair_photos TO authenticated;
GRANT ALL ON public.repair_photos TO service_role;

ALTER TABLE public.repair_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY repair_photos_select_member ON public.repair_photos
  FOR SELECT TO authenticated
  USING (app_private.is_workshop_member(auth.uid(), workshop_id));

CREATE POLICY repair_photos_insert_member ON public.repair_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.is_workshop_member(auth.uid(), workshop_id)
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = repair_photos.receipt_id
        AND r.workshop_id = repair_photos.workshop_id
    )
  );

CREATE POLICY repair_photos_delete_member ON public.repair_photos
  FOR DELETE TO authenticated
  USING (app_private.is_workshop_member(auth.uid(), workshop_id));

-- Storage policies: path is {workshop_id}/{receipt_id}/{file}
CREATE POLICY repair_photo_objects_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'repair-photos'
    AND app_private.is_workshop_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY repair_photo_objects_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'repair-photos'
    AND app_private.is_workshop_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY repair_photo_objects_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'repair-photos'
    AND app_private.is_workshop_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );