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
  /** ISO date the device was delivered — null if not yet delivered. */
  startedAt: string | null;
  /** ISO date warranty expires — null if not yet delivered. */
  expiresAt: string | null;
  /** Whole days remaining; 0 once expired or not yet started. */
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

interface DB {
  receipts: Receipt[];
}

const KEY = "warranty_flow_db";

export function getDb(): DB {
  if (typeof window === "undefined") return { receipts: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { receipts: [] };
    const parsed = JSON.parse(raw) as DB;
    return parsed && Array.isArray(parsed.receipts) ? parsed : { receipts: [] };
  } catch {
    return { receipts: [] };
  }
}

export function saveDb(db: DB): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent("warranty_flow_db:change"));
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomSuffix(): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return s;
}

export function generateTrackId(existing: Receipt[]): string {
  const year = new Date().getFullYear();
  const taken = new Set(existing.map((r) => r.trackId));
  let id = `WF-${year}-${randomSuffix()}`;
  while (taken.has(id)) {
    id = `WF-${year}-${randomSuffix()}`;
  }
  return id;
}

export interface NewReceiptInput {
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  serialNumber: string;
  issueDescription: string;
  warrantyDays: number;
}

export function addReceipt(input: NewReceiptInput): Receipt {
  const db = getDb();
  const now = new Date().toISOString();
  const receipt: Receipt = {
    trackId: generateTrackId(db.receipts),
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    deviceModel: input.deviceModel,
    serialNumber: input.serialNumber,
    issueDescription: input.issueDescription,
    createdAt: now,
    currentStatus: "Received",
    statusHistory: [{ status: "Received", updatedAt: now }],
    warrantyDays: input.warrantyDays,
  };
  db.receipts.push(receipt);
  saveDb(db);
  return receipt;
}

export function updateStatus(trackId: string, status: StatusName): Receipt | null {
  const db = getDb();
  const r = db.receipts.find((x) => x.trackId === trackId);
  if (!r) return null;
  if (r.currentStatus === status) return r;
  r.currentStatus = status;
  r.statusHistory.push({ status, updatedAt: new Date().toISOString() });
  saveDb(db);
  return r;
}

export function findByTrackId(trackId: string): Receipt | null {
  const target = trackId.trim().toUpperCase();
  const db = getDb();
  const r = db.receipts.find((x) => x.trackId.toUpperCase() === target);
  return r ? migrate(r) : null;
}

export function listReceipts(): Receipt[] {
  return [...getDb().receipts]
    .map(migrate)
    .sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Backfill legacy receipts written before warrantyDays existed. */
function migrate(r: Receipt): Receipt {
  if (typeof r.warrantyDays === "number") return r;
  return { ...r, warrantyDays: DEFAULT_WARRANTY_DAYS };
}