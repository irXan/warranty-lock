# Phase 2 (continued) — Finish the Supabase Migration, Scalably

The backend swap is already live: schema, RLS, auth, and every data path (tracking RPC, job board, receipt creation, status updates) now run on Supabase. No `localStorage` reads/writes remain in the app code. UI, receipt design, printing, QR, and SEO are untouched and stay untouched.

Remaining work, in order, verifying Phase 1 behaviour after each step.

---

## Step 1 — Make the schema multi-workshop ready (scalability decision)

Today every admin sees every receipt. That does not scale to multiple workshops, and retrofitting a tenant column after real data exists is painful. Add the tenancy dimension now, even though the UI stays single-workshop.

- New table `workshops`: name, slug, contact details, owner.
- New table `workshop_members`: which user belongs to which workshop, with a role (`owner`, `staff`).
- `receipts` gains a required `workshop_id` pointing at `workshops`.
- A default workshop row is created and every existing receipt is attached to it, so nothing changes visually.
- Track IDs stay globally unique, so public tracking links keep working exactly as they do now.

Access rules become workshop-scoped:
- Admins see and manage only receipts belonging to a workshop they are a member of.
- Customers keep seeing receipts matching their signed-in email.
- Public tracking by Track ID keeps working signed-out through the existing lookup function.
- Status history follows the same visibility as its parent receipt.

The app keeps behaving as one workshop because the current user is a member of the single default workshop.

## Step 2 — Admin bootstrap

Right now every new signup becomes a customer, so nobody can reach the admin panel. Add a one-time promotion so the first account (yours) becomes workshop owner + admin, and add a small admin-only screen to grant the admin role to other staff accounts by email. No visual redesign — same card/table styling as the rest of the app.

## Step 3 — Legacy data import

Receipts created before the migration still live in browsers' local storage. Add an admin-only "Import legacy receipts" action that reads that data once and uploads it, skipping any Track ID that already exists, then clears local storage after a confirmed success. Placed as a quiet secondary control in the admin panel, not a redesign.

## Step 4 — Full Phase 1 regression pass

Verified end-to-end in a real browser session against the live database:
- Create receipt → Track ID modal → copy → QR renders
- Print receipt output matches Phase 1 layout
- Public tracking by Track ID while signed out
- QR deep link opens the correct receipt on a fresh device
- 5-stage status stepper + derived Warranty Active stage and countdown
- Immutability: core receipt fields reject edits
- Job board search, empty states, toasts
- Invoice generator, sitemap, robots, per-route metadata

## Step 5 — Migration report

Written summary of schema, access rules, files changed, and the verification checklist above with pass/fail per item.

---

## Technical notes

- Tenancy: `workshops` + `workshop_members` + `receipts.workshop_id NOT NULL`; membership checked through a `security definer` helper (`is_workshop_member(uid, workshop_id)`) to avoid recursive RLS, mirroring the existing `has_role` pattern.
- RLS on `receipts`/`status_events` switches from `has_role(uid,'admin')` to `has_role(uid,'admin') AND is_workshop_member(auth.uid(), workshop_id)`; customer-email and RPC policies unchanged.
- `get_receipt_by_track_id` stays the only anon-reachable path; it gains no new columns, so the customer payload is unchanged.
- Data backfill: insert default workshop, backfill `workshop_id`, then set `NOT NULL` in the same migration; grants issued for every new table.
- Client changes are limited to passing/deriving the active workshop id in `warranty-repo.ts` plus the two new small admin surfaces. No component restyling.
- Out of scope (Phase 3): workshop switcher UI, invitations, notifications, analytics, realtime.
