import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClaimedRepair = {
  trackId: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  serialNumber: string;
  issueDescription: string;
  warrantyDays: number | null;
  currentStatus: string;
  deliveredAt: string | null;
  createdAt: string;
  statusHistory: Array<{ status: string; updatedAt: string }>;
};

export type ClaimResult = { ok: true; trackId: string } | { ok: false; message: string };

/** One generic failure message for every unsuccessful path — never reveals
 * whether a Track ID exists or is already claimed. */
const GENERIC_FAILURE =
  "That Track ID couldn't be claimed. Check the ID and try again.";

const USER_LIMIT = 5; // attempts per 10 minutes
const IP_LIMIT = 20; // attempts per hour

async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(`claim:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const claimReceiptByTrackId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ trackId: z.string().trim().min(4).max(64) }).parse(data))
  .handler(async ({ data, context }): Promise<ClaimResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const trackId = data.trackId.trim().toUpperCase();

    const rawIp =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      "";
    const ipHash = rawIp ? await hashIp(rawIp) : null;

    // Rate limit before doing any lookup work.
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();

    const { count: userCount } = await supabaseAdmin
      .from("claim_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", tenMinAgo);

    let ipCount = 0;
    if (ipHash) {
      const { count } = await supabaseAdmin
        .from("claim_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", hourAgo);
      ipCount = count ?? 0;
    }

    await supabaseAdmin.from("claim_attempts").insert({ user_id: userId, ip_hash: ipHash });

    if ((userCount ?? 0) >= USER_LIMIT || ipCount >= IP_LIMIT) {
      return { ok: false, message: "Too many attempts. Please try again later." };
    }

    const { data: receipt } = await supabaseAdmin
      .from("receipts")
      .select("id")
      .eq("track_id", trackId)
      .maybeSingle();
    if (!receipt) return { ok: false, message: GENERIC_FAILURE };

    const { data: existing } = await supabaseAdmin
      .from("receipt_claims")
      .select("user_id")
      .eq("receipt_id", receipt.id)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      // Already claimed by this user: idempotent success. By anyone else: generic failure.
      if (existing.user_id === userId) return { ok: true, trackId };
      return { ok: false, message: GENERIC_FAILURE };
    }

    const { error: insErr } = await supabaseAdmin
      .from("receipt_claims")
      .insert({ receipt_id: receipt.id, user_id: userId });
    if (insErr) return { ok: false, message: GENERIC_FAILURE };

    return { ok: true, trackId };
  });

/** Repairs the signed-in customer has actively claimed. Reads go through the
 * caller's RLS-scoped client, so the claim policies are the enforcement point. */
export const listMyRepairs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClaimedRepair[]> => {
    const supabase = context.supabase;

    const { data: claims, error: cErr } = await supabase
      .from("receipt_claims")
      .select("receipt_id")
      .eq("status", "active");
    if (cErr) throw cErr;
    const ids = (claims ?? []).map((c) => c.receipt_id as string);
    if (ids.length === 0) return [];

    const { data: rows, error } = await supabase
      .from("receipts")
      .select(
        "id, track_id, customer_name, customer_phone, device_model, serial_number, issue_description, warranty_days, current_status, delivered_at, created_at",
      )
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const { data: events } = await supabase
      .from("status_events")
      .select("receipt_id, status, created_at")
      .in("receipt_id", ids)
      .order("created_at", { ascending: true });

    const byReceipt = new Map<string, Array<{ status: string; updatedAt: string }>>();
    for (const e of events ?? []) {
      const key = e.receipt_id as string;
      const arr = byReceipt.get(key) ?? [];
      arr.push({ status: e.status as string, updatedAt: e.created_at as string });
      byReceipt.set(key, arr);
    }

    return (rows ?? []).map((r) => ({
      trackId: r.track_id as string,
      customerName: r.customer_name as string,
      customerPhone: r.customer_phone as string,
      deviceModel: r.device_model as string,
      serialNumber: r.serial_number as string,
      issueDescription: r.issue_description as string,
      warrantyDays: r.warranty_days as number | null,
      currentStatus: r.current_status as string,
      deliveredAt: r.delivered_at as string | null,
      createdAt: r.created_at as string,
      statusHistory: byReceipt.get(r.id as string) ?? [],
    }));
  });

/** True when the signed-in user has actively claimed the given Track ID. */
export const isTrackIdClaimedByMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ trackId: z.string().trim().min(4).max(64) }).parse(data))
  .handler(async ({ data, context }): Promise<boolean> => {
    const { data: rows, error } = await context.supabase
      .from("receipts")
      .select("id")
      .eq("track_id", data.trackId.trim().toUpperCase())
      .limit(1);
    if (error) return false;
    return (rows ?? []).length > 0;
  });
