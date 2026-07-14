// Lightweight passcode gate for the admin view. This is deliberately
// client-only — a proper auth system belongs to the Lovable Cloud step.
// The passcode is SHA-256 hashed before being stored in localStorage.

const KEY = "warranty_flow_admin_hash";
const SESSION_KEY = "warranty_flow_admin_session";

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPasscode(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem(KEY);
}

export async function setPasscode(pass: string): Promise<void> {
  const h = await sha256(pass);
  window.localStorage.setItem(KEY, h);
  window.sessionStorage.setItem(SESSION_KEY, "1");
}

export async function verifyPasscode(pass: string): Promise<boolean> {
  const stored = window.localStorage.getItem(KEY);
  if (!stored) return false;
  const h = await sha256(pass);
  const ok = h === stored;
  if (ok) window.sessionStorage.setItem(SESSION_KEY, "1");
  return ok;
}

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}

export function signOut(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
}