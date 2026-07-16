import QRCode from "qrcode";
import { getWarrantyInfo, type Receipt } from "./warranty-db";
import { buildTrackUrl } from "./receipt-share";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function printReceipt(receipt: Receipt): Promise<void> {
  const trackUrl = buildTrackUrl(receipt);
  const qrDataUrl = await QRCode.toDataURL(trackUrl, {
    width: 240,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  const w = getWarrantyInfo(receipt);
  const warrantyLine =
    w.state === "active" && w.expiresAt
      ? `Active — ${w.daysRemaining} day(s) left · expires ${new Date(w.expiresAt).toLocaleDateString()}`
      : w.state === "expired" && w.expiresAt
        ? `Expired on ${new Date(w.expiresAt).toLocaleDateString()}`
        : `Pending — ${w.days}-day cover starts on delivery`;

  const history = receipt.statusHistory
    .map(
      (h) =>
        `<tr><td>${escapeHtml(h.status)}</td><td>${escapeHtml(fmtDateTime(h.updatedAt))}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Warranty Flow Receipt · ${escapeHtml(receipt.trackId)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 32px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .brand small { display: block; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin-top: 2px; }
  .track { text-align: right; }
  .track .label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
  .track .id { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 18px; font-weight: 700; margin-top: 2px; }
  .grid { display: grid; grid-template-columns: 1fr 240px; gap: 24px; }
  dl { margin: 0; display: grid; grid-template-columns: 130px 1fr; row-gap: 8px; column-gap: 12px; font-size: 13px; }
  dt { color: #64748b; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; align-self: center; }
  dd { margin: 0; font-weight: 500; }
  .qr { text-align: center; }
  .qr img { width: 200px; height: 200px; }
  .qr .caption { font-size: 10px; color: #64748b; margin-top: 6px; letter-spacing: 0.04em; text-transform: uppercase; }
  .section { margin-top: 24px; }
  .section h3 { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin: 0 0 8px; }
  .issue { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px; white-space: pre-wrap; }
  .warranty { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px; background: #f8fafc; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  th { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; }
  .foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
  @media print { body { margin: 20mm; } }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="brand">Warranty Flow<small>Immutable repair receipt</small></div>
    </div>
    <div class="track">
      <div class="label">Track ID</div>
      <div class="id">${escapeHtml(receipt.trackId)}</div>
      <div class="label" style="margin-top:8px">Status</div>
      <div style="font-weight:600">${escapeHtml(receipt.currentStatus)}</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:10px;margin:0 0 18px;padding:10px 12px;border:1px solid #16a34a33;background:#f0fdf4;border-radius:8px;font-size:12px;color:#166534;">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
    <div><strong>Verified Immutable Record.</strong> Customer and device information cannot be modified after receipt creation. Only repair status can be updated.</div>
  </div>

  <div class="grid">
    <dl>
      <dt>Customer</dt><dd>${escapeHtml(receipt.customerName)}</dd>
      <dt>Phone</dt><dd>${escapeHtml(receipt.customerPhone)}</dd>
      <dt>Device</dt><dd>${escapeHtml(receipt.deviceModel)}</dd>
      <dt>Serial / IMEI</dt><dd style="font-family:ui-monospace,SFMono-Regular,monospace">${escapeHtml(receipt.serialNumber)}</dd>
      <dt>Reported</dt><dd>${escapeHtml(fmtDateTime(receipt.createdAt))}</dd>
      <dt>Warranty</dt><dd>${escapeHtml(warrantyLine)}</dd>
    </dl>
    <div class="qr">
      <img src="${qrDataUrl}" alt="QR code linking to live tracking page" />
      <div class="caption">Scan to track live</div>
    </div>
  </div>

  <div class="section">
    <h3>Reported issue</h3>
    <div class="issue">${escapeHtml(receipt.issueDescription)}</div>
  </div>

  <div class="section">
    <h3>Status history</h3>
    <table>
      <thead><tr><th>Stage</th><th>Timestamp</th></tr></thead>
      <tbody>${history}</tbody>
    </table>
  </div>

  <div class="foot">
    Track this repair anytime at ${escapeHtml(trackUrl)}
  </div>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 150);
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) {
    alert("Please allow pop-ups to print the receipt.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}