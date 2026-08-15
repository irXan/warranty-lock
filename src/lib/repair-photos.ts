import { supabase } from "@/integrations/supabase/client";

export const PHOTO_BUCKET = "repair-photos";

export type PhotoCategory = "before" | "during" | "after";

export const PHOTO_CATEGORIES: { value: PhotoCategory; label: string }[] = [
  { value: "before", label: "Before Repair" },
  { value: "during", label: "During Repair" },
  { value: "after", label: "After Repair" },
];

export const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  before: "Before Repair",
  during: "During Repair",
  after: "After Repair",
};

export interface RepairPhoto {
  id: string;
  receiptId: string;
  workshopId: string;
  storagePath: string;
  category: PhotoCategory;
  caption: string | null;
  createdAt: string;
  url: string;
}

export const repairPhotosQueryKey = (receiptId: string) =>
  ["warranty", "repair-photos", receiptId] as const;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPT_ATTR = "image/jpeg,image/png,image/webp";
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 2000;

export function validateImage(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) {
    return `${file.name}: unsupported format. Use JPG, PNG or WebP.`;
  }
  if (file.size > MAX_INPUT_BYTES) {
    return `${file.name}: file is too large (max 15 MB).`;
  }
  return null;
}

/** Downscale + re-encode in the browser so uploads stay small but legible. */
export async function compressImage(file: File): Promise<Blob> {
  if (typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= MAX_UPLOAD_BYTES && file.type === "image/jpeg") {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
    );
    if (!blob || blob.size > MAX_UPLOAD_BYTES) return blob ?? file;
    return blob;
  } catch {
    return file;
  }
}

type PhotoRow = {
  id: string;
  receipt_id: string;
  workshop_id: string;
  storage_path: string;
  category: PhotoCategory;
  caption: string | null;
  created_at: string;
};

/** Workshop-side listing. RLS restricts rows + signed URLs to workshop members. */
export async function listRepairPhotos(receiptId: string): Promise<RepairPhoto[]> {
  const { data, error } = await supabase
    .from("repair_photos")
    .select("id, receipt_id, workshop_id, storage_path, category, caption, created_at")
    .eq("receipt_id", receiptId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as PhotoRow[];
  if (rows.length === 0) return [];

  const { data: signed, error: sErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 60 * 30);
  if (sErr) throw sErr;
  const byPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
  }

  return rows.map((r) => ({
    id: r.id,
    receiptId: r.receipt_id,
    workshopId: r.workshop_id,
    storagePath: r.storage_path,
    category: r.category,
    caption: r.caption,
    createdAt: r.created_at,
    url: byPath.get(r.storage_path) ?? "",
  }));
}

export async function uploadRepairPhoto(params: {
  receiptId: string;
  workshopId: string;
  category: PhotoCategory;
  file: File;
}): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error("You must be signed in to upload photos.");

  const blob = await compressImage(params.file);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${params.workshopId}/${params.receiptId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (upErr) throw upErr;

  const { error } = await supabase.from("repair_photos").insert({
    receipt_id: params.receiptId,
    workshop_id: params.workshopId,
    storage_path: path,
    category: params.category,
    uploaded_by: userId,
  });
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw error;
  }
}

export async function deleteRepairPhoto(photo: RepairPhoto): Promise<void> {
  const { error } = await supabase.from("repair_photos").delete().eq("id", photo.id);
  if (error) throw error;
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storagePath]);
}
