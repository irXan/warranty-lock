import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_WARRANTY_DAYS } from "@/lib/warranty-db";

export const WARRANTY_CLAIM_STATUSES = [
  "Submitted",
  "Reviewing",
  "Approved",
  "Rejected",
  "Resolved",
] as const;
export type WarrantyClaimStatus = (typeof WARRANTY_CLAIM_STATUSES)[number];

/** A claim is "open" while it is not finally closed. */
const OPEN_STATUSES: WarrantyClaimStatus[] = ["Submitted", "Reviewing", "Approved"];

/** Allowed forward-only status transitions; mirrored by a database trigger. */
export const ALLOWED_CLAIM_TRANSITIONS: Record<WarrantyClaimStatus, WarrantyClaimStatus[]> = {
  Submitted: ["Reviewing"],
  Reviewing: ["Approved", "Rejected"],
  Approved: ["Resolved"],
  Rejected: [],
  Resolved: [],
};

export type WarrantyClaimEvent = {
  status: WarrantyClaimStatus;
  note: string | null;
  createdAt: string;
  actorId: string | null;
};

export type WarrantyClaim = {
  id: string;
  trackId: string;
  deviceModel: string;
  customerName: string;
  reason: string;
  status: WarrantyClaimStatus;
  createdAt: string;
  updatedAt: string;
  events: WarrantyClaimEvent[];
};

export type SubmitClaimResult = { ok: true; id: string } | { ok: false; message: string };

const MS_PER_DAY = 86_400_000;

function warrantyIsActive(deliveredAt: string | null, warrantyDays: number | null): boolean {
  if (!deliveredAt) return false;
  const days = warrantyDays ?? DEFAULT_WARRANTY_DAYS;
  return new Date(deliveredAt).getTime() + days * MS_PER_DAY > Date.now();
}

type ClaimRow = {
  id: string;
  reason: string;
  status: WarrantyClaimStatus;
  created_at: string;
  updated_at: string;
  receipts: {
    track_id: string;
    device_model: string;
    customer_name: string;
  } | null;
};

const CLAIM_SELECT =
  "id, reason, status, created_at, updated_at, receipts!inner(track_id, device_model, customer_name)";

function mapClaims(
  rows: ClaimRow[],
  events: Array<{
    claim_id: string;
    status: string;
    note: string | null;
    created_at: string;
    actor_id: string | null;
  }>,
): WarrantyClaim[] {
  const byClaim = new Map<string, WarrantyClaimEvent[]>();
  for (const e of events) {
    const arr = byClaim.get(e.claim_id) ?? [];
    arr.push({
      status: e.status as WarrantyClaimStatus,
      note: e.note,
      createdAt: e.created_at,
      actorId: e.actor_id,
    });
    byClaim.set(e.claim_id, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    trackId: r.receipts?.track_id ?? "",
    deviceModel: r.receipts?.device_model ?? "",
    customerName: r.receipts?.customer_name ?? "",
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    events: byClaim.get(r.id) ?? [],
  }));
}

/** Customer submits a warranty claim for a repair they have actively claimed. */
export const submitWarrantyClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        trackId: z.string().trim().min(4).max(64),
        reason: z.string().trim().min(10).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<SubmitClaimResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const trackId = data.trackId.trim().toUpperCase();

    // Ownership: the caller must be able to read the receipt through their own
    // RLS-scoped client, which only succeeds with an active repair claim.
    const { data: owned } = await context.supabase
      .from("receipts")
      .select("id")
      .eq("track_id", trackId)
      .maybeSingle();
    if (!owned) {
      return { ok: false, message: "You can only raise a claim for a repair in your account." };
    }

    const { data: receipt } = await supabaseAdmin
      .from("receipts")
      .select("id, workshop_id, warranty_days, delivered_at")
      .eq("id", owned.id)
      .maybeSingle();
    if (!receipt) {
      return { ok: false, message: "You can only raise a claim for a repair in your account." };
    }

    if (!warrantyIsActive(receipt.delivered_at as string | null, receipt.warranty_days as number | null)) {
      return {
        ok: false,
        message: "This repair's warranty isn't active, so a claim can't be raised.",
      };
    }

    const { data: open } = await supabaseAdmin
      .from("warranty_claims")
      .select("id")
      .eq("receipt_id", receipt.id)
      .eq("user_id", userId)
      .in("status", OPEN_STATUSES)
      .maybeSingle();
    if (open) {
      return { ok: false, message: "You already have an open claim for this repair." };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("warranty_claims")
      .insert({
        receipt_id: receipt.id,
        workshop_id: receipt.workshop_id as string,
        user_id: userId,
        reason: data.reason.trim(),
      })
      .select("id")
      .single();
    if (error || !inserted) {
      return { ok: false, message: "Couldn't submit that claim. Please try again." };
    }

    await supabaseAdmin.from("warranty_claim_events").insert({
      claim_id: inserted.id,
      status: "Submitted",
      note: null,
      actor_id: userId,
    });

    return { ok: true, id: inserted.id };
  });

/** Claims raised by the signed-in customer. */
export const listMyWarrantyClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WarrantyClaim[]> => {
    const { data: rows, error } = await context.supabase
      .from("warranty_claims")
      .select(CLAIM_SELECT)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const claims = (rows ?? []) as unknown as ClaimRow[];
    if (claims.length === 0) return [];

    const { data: events } = await context.supabase
      .from("warranty_claim_events")
      .select("claim_id, status, note, created_at, actor_id")
      .in(
        "claim_id",
        claims.map((c) => c.id),
      )
      .order("created_at", { ascending: true });

    return mapClaims(claims, (events ?? []) as never);
  });

/** Claims for the workshops the signed-in owner/staff belongs to. */
export const listWorkshopWarrantyClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WarrantyClaim[]> => {
    const { data: rows, error } = await context.supabase
      .from("warranty_claims")
      .select(CLAIM_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const claims = (rows ?? []) as unknown as ClaimRow[];
    if (claims.length === 0) return [];

    const { data: events } = await context.supabase
      .from("warranty_claim_events")
      .select("claim_id, status, note, created_at, actor_id")
      .in(
        "claim_id",
        claims.map((c) => c.id),
      )
      .order("created_at", { ascending: true });

    return mapClaims(claims, (events ?? []) as never);
  });

/** Workshop owner/staff moves a claim to a new status and records the history. */
export const updateWarrantyClaimStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        claimId: z.string().uuid(),
        status: z.enum(WARRANTY_CLAIM_STATUSES),
        note: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; message?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorization: the update goes through the caller's RLS-scoped client, so
    // only a member of the claim's workshop can change it.
    const { data: updated, error } = await context.supabase
      .from("warranty_claims")
      .update({ status: data.status })
      .eq("id", data.claimId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: "Couldn't update that claim." };
    if (!updated) return { ok: false, message: "You don't have access to that claim." };

    await supabaseAdmin.from("warranty_claim_events").insert({
      claim_id: data.claimId,
      status: data.status,
      note: data.note?.trim() ? data.note.trim() : null,
      actor_id: context.userId,
    });

    return { ok: true };
  });
