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
  return db.receipts.find((r) => r.trackId.toUpperCase() === target) ?? null;
}

export function listReceipts(): Receipt[] {
  return [...getDb().receipts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}