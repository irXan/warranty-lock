import type { Receipt } from "./warranty-db";

// Compact URL-safe payload that lets a QR / shared link render a receipt
// on a device that has never seen it before. Read-only — the recipient
// device still cannot mutate the original ledger.

function toBase64Url(str: string): string {
  const b64 =
    typeof window === "undefined"
      ? Buffer.from(str, "utf-8").toString("base64")
      : window.btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof window === "undefined") return Buffer.from(b64, "base64").toString("utf-8");
  return decodeURIComponent(escape(window.atob(b64)));
}

export function encodeReceiptForShare(receipt: Receipt): string {
  return toBase64Url(JSON.stringify(receipt));
}

export function decodeSharedReceipt(payload: string): Receipt | null {
  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as Receipt;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.trackId !== "string" || !Array.isArray(parsed.statusHistory)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Build the shareable tracking URL for a receipt. Embeds a signed-free
 *  payload in the URL fragment so QR scans work across devices. */
export function buildTrackUrl(receipt: Receipt, origin?: string): string {
  const base =
    origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  const id = encodeURIComponent(receipt.trackId);
  const payload = encodeReceiptForShare(receipt);
  return `${base}/?track=${id}#r=${payload}`;
}