import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicReceiptPayload = {
  track_id: string;
  customer_name: string;
  customer_phone: string;
  device_model: string;
  serial_number: string;
  issue_description: string;
  warranty_days: number | null;
  current_status: string;
  delivered_at: string | null;
  created_at: string;
  status_history: Array<{ status: string; updated_at: string }>;
};

/**
 * Public Track ID lookup. Runs server-side with elevated privileges so the
 * database keeps no publicly callable SECURITY DEFINER function. Only the
 * fields shown on the tracking page are returned, and only for an exact
 * Track ID match.
 */
export const lookupReceiptByTrackId = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ trackId: z.string().trim().min(4).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<PublicReceiptPayload | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trackId = data.trackId.trim().toUpperCase();

    const { data: row, error } = await supabaseAdmin
      .from("receipts")
      .select(
        "id, track_id, customer_name, customer_phone, device_model, serial_number, issue_description, warranty_days, current_status, delivered_at, created_at",
      )
      .eq("track_id", trackId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;

    const { data: events, error: evErr } = await supabaseAdmin
      .from("status_events")
      .select("status, created_at")
      .eq("receipt_id", row.id)
      .order("created_at", { ascending: true });
    if (evErr) throw evErr;

    return {
      track_id: row.track_id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      device_model: row.device_model,
      serial_number: row.serial_number,
      issue_description: row.issue_description,
      warranty_days: row.warranty_days,
      current_status: row.current_status,
      delivered_at: row.delivered_at,
      created_at: row.created_at,
      status_history: (events ?? []).map((e) => ({
        status: e.status as string,
        updated_at: e.created_at as string,
      })),
    };
  });
