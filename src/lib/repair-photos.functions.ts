import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicRepairPhoto = {
  id: string;
  category: "before" | "during" | "after";
  caption: string | null;
  created_at: string;
  url: string;
};

/**
 * Public repair-photo listing for the customer tracking view. Signed URLs are
 * minted server-side after an exact Track ID match, so a Track ID can never
 * surface another repair's files and the bucket stays private.
 */
export const listPublicRepairPhotos = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ trackId: z.string().trim().min(4).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<PublicRepairPhoto[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trackId = data.trackId.trim().toUpperCase();

    const { data: receipt, error } = await supabaseAdmin
      .from("receipts")
      .select("id")
      .eq("track_id", trackId)
      .maybeSingle();
    if (error) throw error;
    if (!receipt) return [];

    const { data: rows, error: pErr } = await supabaseAdmin
      .from("repair_photos")
      .select("id, category, caption, storage_path, created_at")
      .eq("receipt_id", receipt.id)
      .order("created_at", { ascending: true });
    if (pErr) throw pErr;
    if (!rows || rows.length === 0) return [];

    const out: PublicRepairPhoto[] = [];
    for (const row of rows) {
      const { data: signed } = await supabaseAdmin.storage
        .from("repair-photos")
        .createSignedUrl(row.storage_path as string, 60 * 30);
      if (!signed?.signedUrl) continue;
      out.push({
        id: row.id as string,
        category: row.category as PublicRepairPhoto["category"],
        caption: (row.caption as string | null) ?? null,
        created_at: row.created_at as string,
        url: signed.signedUrl,
      });
    }
    return out;
  });
