# Phase 3 / Feature 2: Repair Photos

Attach photos to a repair record, visible to the workshop team and to the customer tracking that repair. No redesign, no changes to the immutable receipt fields.

## Storage and database

New private storage bucket `repair-photos` (not public). File path convention:

```text
repair-photos/{workshop_id}/{receipt_id}/{uuid}.{ext}
```

New table `public.repair_photos`:
- `receipt_id`, `workshop_id`, `storage_path`, `category` (`before` | `during` | `after`), `caption` (optional), `uploaded_by`, `created_at`

Nothing is written to `receipts`, so the immutability trigger and all core fields stay untouched.

## Security

- Table RLS: workshop members (owner and staff alike) can read, insert, and delete rows for their own workshop only, reusing the existing `app_private.is_workshop_member` helper. Insert additionally checks the receipt actually belongs to that workshop, so a forged `workshop_id` or `receipt_id` is rejected.
- Storage RLS on `storage.objects`: read/insert/delete restricted to members of the workshop named in the first path segment. Bucket stays private, so there are no unrestricted public URLs.
- Staff gain no new management rights: this is scoped exactly like the receipt permissions they already have.
- Customer access: the existing public Track ID server function is extended to also return short-lived signed URLs for that one receipt's photos. Signed URLs are minted server-side after matching the Track ID; nothing else is exposed, and one Track ID can never surface another repair's files.

## Upload handling

- Client-side validation: JPEG, PNG, WebP, HEIC-converted only; reject anything else; max ~8 MB per file after processing.
- Images are downscaled in the browser (long edge capped ~2000px, JPEG/WebP re-encode) before upload — enough detail for damage evidence, far smaller uploads.
- Multiple files per selection, uploaded sequentially with progress feedback.

## UI

Admin (inside the existing job board card, per receipt — same card styling, no redesign):
- "Repair photos" section with a category selector (Before / During / After), an upload button, thumbnail grid grouped by category, per-photo delete with a confirmation dialog, and loading/success/error toasts consistent with the rest of the app.
- Clicking a thumbnail opens a larger preview dialog.

Customer tracking (`CustomerPanel`):
- A "Repair photos" block appears only when the tracked repair has photos, grouped under Before / During / After labels, with a lightbox preview. No workshop-internal data shown.

Both grids are responsive (2 columns mobile, 3-4 desktop).

## Technical notes

- New migration: bucket creation via the storage tool, then `repair_photos` table with GRANTs, RLS, and policies, plus `storage.objects` policies.
- New `src/lib/repair-photos.functions.ts` for signed-URL listing (server-side) and any privileged checks; direct uploads/deletes go through the RLS-protected storage client from the browser.
- New components `src/components/warranty/RepairPhotos.tsx` (admin) and `RepairPhotoGallery.tsx` (shared display) reusing existing shadcn dialog/button/select primitives.
- `Receipt` type gains an internal `id` field so the admin UI can key photos by receipt; the public payload keeps only what tracking already exposes plus signed photo URLs.
- Print/PDF receipts, QR tracking, warranty logic, status history, and staff roster stay unchanged.

## Verification

Owner upload/view/delete, staff upload/view/delete, cross-workshop access attempt blocked, customer tracking shows only its own photos, and a regression pass on receipt creation, status updates, QR tracking, printing, and warranty display.
