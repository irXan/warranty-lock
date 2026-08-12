import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_WARRANTY_DAYS,
  generateTrackId,
  type NewReceiptInput,
  type Receipt,
  type StatusEntry,
  type StatusName,
} from "./warranty-db";

type ReceiptRow = {
  id: string;
  track_id: string;
  customer_name: string;
  customer_phone: string;
  device_model: string;
  serial_number: string;
  issue_description: string;
  warranty_days: number | null;
  current_status: StatusName;
  delivered_at: string | null;
  created_at: string;
};

type StatusEventRow = {
  receipt_id: string;
  status: StatusName;
  created_at: string;
};

function rowToReceipt(row: ReceiptRow, history: StatusEntry[]): Receipt {
  return {
    trackId: row.track_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deviceModel: row.device_model,
    serialNumber: row.serial_number,
    issueDescription: row.issue_description,
    warrantyDays: row.warranty_days ?? DEFAULT_WARRANTY_DAYS,
    currentStatus: row.current_status,
    createdAt: row.created_at,
    statusHistory: history,
  };
}

/** Admin-only: list every receipt (RLS enforces role on the server). */
export async function listReceipts(): Promise<Receipt[]> {
  const { data: rows, error } = await supabase
    .from("receipts")
    .select(
      "id, track_id, customer_name, customer_phone, device_model, serial_number, issue_description, warranty_days, current_status, delivered_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  const list = (rows ?? []) as ReceiptRow[];
  if (list.length === 0) return [];

  const ids = list.map((r) => r.id);
  const { data: events, error: evErr } = await supabase
    .from("status_events")
    .select("receipt_id, status, created_at")
    .in("receipt_id", ids)
    .order("created_at", { ascending: true });
  if (evErr) throw evErr;

  const byReceipt = new Map<string, StatusEntry[]>();
  for (const e of (events ?? []) as StatusEventRow[]) {
    const arr = byReceipt.get(e.receipt_id) ?? [];
    arr.push({ status: e.status, updatedAt: e.created_at });
    byReceipt.set(e.receipt_id, arr);
  }

  return list.map((r) => rowToReceipt(r, byReceipt.get(r.id) ?? []));
}

/** Insert a new receipt. DB trigger seeds the initial "Received" status event. */
export async function addReceipt(input: NewReceiptInput): Promise<Receipt> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error("You must be signed in to create receipts.");

  const workshopId = await getCurrentWorkshopId(userId);
  if (!workshopId) {
    throw new Error("Your account isn't linked to a workshop yet. Ask an owner to add you.");
  }

  // Retry once if we hit the unique-track_id collision (extremely rare).
  for (let attempt = 0; attempt < 3; attempt++) {
    const trackId = generateTrackId();
    const { data, error } = await supabase
      .from("receipts")
      .insert({
        track_id: trackId,
        workshop_id: workshopId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        device_model: input.deviceModel,
        serial_number: input.serialNumber,
        issue_description: input.issueDescription,
        warranty_days: input.warrantyDays,
        created_by: userId,
      })
      .select(
        "id, track_id, customer_name, customer_phone, device_model, serial_number, issue_description, warranty_days, current_status, delivered_at, created_at",
      )
      .single();
    if (error) {
      if (error.code === "23505") continue; // track_id collision
      throw error;
    }
    const row = data as ReceiptRow;
    const { data: events } = await supabase
      .from("status_events")
      .select("receipt_id, status, created_at")
      .eq("receipt_id", row.id)
      .order("created_at", { ascending: true });
    const history = ((events ?? []) as StatusEventRow[]).map((e) => ({
      status: e.status,
      updatedAt: e.created_at,
    }));
    return rowToReceipt(row, history);
  }
  throw new Error("Could not allocate a unique Track ID. Please try again.");
}

/** Append a status event. DB trigger syncs receipts.current_status + delivered_at. */
export async function updateStatus(trackId: string, status: StatusName): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error("You must be signed in to update repair status.");

  const { data: r, error: findErr } = await supabase
    .from("receipts")
    .select("id, current_status")
    .eq("track_id", trackId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!r) throw new Error("Receipt not found.");
  if (r.current_status === status) return;

  const { error } = await supabase
    .from("status_events")
    .insert({ receipt_id: r.id, status, created_by: userId });
  if (error) throw error;
}

type PublicReceiptPayload = {
  track_id: string;
  customer_name: string;
  customer_phone: string;
  device_model: string;
  serial_number: string;
  issue_description: string;
  warranty_days: number | null;
  current_status: StatusName;
  delivered_at: string | null;
  created_at: string;
  status_history: Array<{ status: StatusName; updated_at: string }>;
};

/** Public lookup by Track ID via SECURITY DEFINER RPC. Works signed-out. */
export async function findByTrackId(trackId: string): Promise<Receipt | null> {
  const trimmed = trackId.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase.rpc("get_receipt_by_track_id", {
    _track_id: trimmed,
  });
  if (error) throw error;
  if (!data) return null;
  const p = data as unknown as PublicReceiptPayload;
  return {
    trackId: p.track_id,
    customerName: p.customer_name,
    customerPhone: p.customer_phone,
    deviceModel: p.device_model,
    serialNumber: p.serial_number,
    issueDescription: p.issue_description,
    warrantyDays: p.warranty_days ?? DEFAULT_WARRANTY_DAYS,
    currentStatus: p.current_status,
    createdAt: p.created_at,
    statusHistory: (p.status_history ?? []).map((e) => ({
      status: e.status,
      updatedAt: e.updated_at,
    })),
  };
}

export const receiptsQueryKey = ["warranty", "receipts"] as const;
export const receiptByTrackIdQueryKey = (trackId: string) =>
  ["warranty", "receipt", trackId.toUpperCase()] as const;