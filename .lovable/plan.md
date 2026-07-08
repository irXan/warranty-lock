## Warranty Flow — Build Plan

### Stack note
Your SRS asks for vanilla HTML/CSS/JS, but this project is a TanStack Start + React + Tailwind v4 app (the supported Lovable stack). I'll implement the same spec faithfully in React with `localStorage` persistence — no backend, no database — so behavior, immutability, and data shape match the SRS exactly. If you actually need a single static `.html` file instead, tell me and I'll swap approach.

### Scope
Single-page app with a header toggle between Admin and Customer views. All data lives in `localStorage` under `warranty_flow_db` using the exact schema in the SRS.

### Routes / structure
- `src/routes/index.tsx` — hosts the app shell (header + view toggle). Replaces the placeholder.
- `src/routes/__root.tsx` — update `head()` with real title/description/OG ("Warranty Flow — Immutable Repair Receipts").
- `src/lib/warranty-db.ts` — typed `localStorage` layer: `getDb`, `saveDb`, `addReceipt`, `updateStatus`, `findByTrackId`, `generateTrackId` (with collision check).
- `src/components/warranty/Header.tsx` — logo + Admin/Customer toggle.
- `src/components/warranty/AdminPanel.tsx` — composes the two admin sections.
- `src/components/warranty/ReceiptForm.tsx` — creation form + validation + success modal with Copy-to-Clipboard.
- `src/components/warranty/JobBoard.tsx` — sorted list of receipts (newest first), static immutable fields + status `<select>` that writes back.
- `src/components/warranty/CustomerPanel.tsx` — search input + results.
- `src/components/warranty/StatusStepper.tsx` — 5-stage timeline (horizontal desktop / vertical mobile), completed/active/future states, timestamps from `statusHistory`.
- `src/components/warranty/TrackIdModal.tsx` — success modal.

Reuses existing shadcn primitives (Button, Input, Textarea, Select, Dialog, Card) already available in the project.

### Data & rules
- Schema exactly as SRS §2.1.
- `trackId` format `WF-{YYYY}-{4 A–Z0–9}`, regenerated on collision.
- On create: set `createdAt`, `currentStatus = "Received"`, seed `statusHistory` with one `Received` entry.
- On status change: update `currentStatus` and append `{ status, updatedAt: nowISO }` to `statusHistory`. Core fields never mutated (enforced by only exposing an `updateStatus(trackId, status)` API — no edit/delete surface).
- Rendering: user-supplied strings rendered as React text children (equivalent to `.textContent`) — never `dangerouslySetInnerHTML`. XSS-safe.
- Validation: name ≥3 chars, phone required, model required, serial required, issue ≥10 chars. Inline error styling under each field.
- Customer search: case-insensitive, triggers on click or Enter. Not-found banner as specified.

### UI / design
- Tailwind v4 tokens in `src/styles.css`: primary `#2563eb` (indigo/cobalt), success `#10b981` (emerald), background `#f8fafc`. Register as `--color-primary`, `--color-success`, `--color-background` in `@theme inline`. No hardcoded hex in components.
- Clean tech-professional aesthetic: rounded cards, subtle borders, focus rings, hover transitions, pulse animation on the active stepper stage.
- Responsive: job board becomes a card grid on mobile; stepper flips vertical on mobile.

### View switching
Local React state in the index route toggles Admin vs Customer — no route change, per SRS "SPA via DOM toggle".

### Out of scope
No auth, no backend, no Lovable Cloud, no edit/delete of receipts (by design).

### Verification
After build: load `/`, create a receipt in Admin, copy the Track ID, switch to Customer, look it up, advance status from Admin, confirm stepper reflects new stage and timestamp on refresh.
