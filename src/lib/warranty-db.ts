// Domain types + pure derived helpers.
// Data access lives in `warranty-repo.ts` (Supabase). This file has no I/O.

export type StatusName =
  | "Received"
  | "Diagnosing"
  | "In Repair"
  | "Ready for Pickup"
  | "Delivered";

export const STATUS_STAGES: StatusName[] = [
  "Received",
  "Diagnosing",
  "In Repair",
  "Ready for Pickup",
  "Delivered",
];

export interface StatusEntry {
  status: StatusName;
  updatedAt: string;
}

export interface Receipt {
  /** Database id — present for workshop-side records, absent for shared/QR payloads. */
  id?: string;
  workshopId?: string;
  trackId: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  serialNumber: string;
  issueDescription: string;
  createdAt: string;
  currentStatus: StatusName;
  statusHistory: StatusEntry[];
  /** Warranty duration in days, starts counting once currentStatus === "Delivered". */
  warrantyDays: number;
}

export const WARRANTY_OPTIONS: { days: number; label: string }[] = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "180 days" },
  { days: 365, label: "1 year" },
];

export const DEFAULT_WARRANTY_DAYS = 90;

export type WarrantyState = "pending" | "active" | "expired";

export interface WarrantyInfo {
  state: WarrantyState;
  startedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number;
  days: number;
}

const MS_PER_DAY = 86_400_000;

export function getWarrantyInfo(receipt: Receipt, now: Date = new Date()): WarrantyInfo {
  const days = receipt.warrantyDays ?? DEFAULT_WARRANTY_DAYS;
  const deliveredEntry = receipt.statusHistory.find((s) => s.status === "Delivered");
  if (!deliveredEntry) {
    return { state: "pending", startedAt: null, expiresAt: null, daysRemaining: 0, days };
  }
  const start = new Date(deliveredEntry.updatedAt);
  const expires = new Date(start.getTime() + days * MS_PER_DAY);
  const remainingMs = expires.getTime() - now.getTime();
  const daysRemaining = remainingMs > 0 ? Math.ceil(remainingMs / MS_PER_DAY) : 0;
  return {
    state: remainingMs > 0 ? "active" : "expired",
    startedAt: start.toISOString(),
    expiresAt: expires.toISOString(),
    daysRemaining,
    days,
  };
}

export interface NewReceiptInput {
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  serialNumber: string;
  issueDescription: string;
  warrantyDays: number;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Random Track ID in the WF-YYYY-XXXX format. Collisions are handled by the DB's unique constraint. */
export function generateTrackId(): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return `WF-${new Date().getFullYear()}-${s}`;
}