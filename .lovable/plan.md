# Phase 2 — Warranty Flow Supabase Migration Plan

Goal: move receipts and status history from `localStorage` to Supabase without changing UI/UX or breaking any Phase 1 feature. Add real auth + RLS. No Phase 3 features.

---

## 1. Database Schema

Three tables in `public`, plus a roles table and enums.

```text
auth.users (Supabase managed)
   │
   ├── public.profiles           (1:1 with auth.users)
   ├── public.user_roles         (role assignment; separate table)
   │
   └── public.receipts           (immutable core record)
           │
           ├── public.status_events   (append-only history, 5 stages)
           └── (derived: warranty via delivered_at + warranty_days)
```

### Enums
- `app_role`: `admin`, `customer`
- `repair_status`: `received`, `diagnosing`, `repairing`, `ready`, `delivered`

### `profiles`
- `id uuid pk references auth.users on delete cascade`
- `full_name text`, `phone text`, `created_at timestamptz default now()`

### `user_roles`
- `id uuid pk`, `user_id uuid → auth.users`, `role app_role`, unique(user_id, role)
- Read via `public.has_role(_user_id, _role)` security-definer function (avoids recursive RLS).

### `receipts` (immutable after insert)
- `id uuid pk default gen_random_uuid()`
- `track_id text unique not null` — existing `WF-YYYY-XXXX` format
- `customer_name`, `customer_phone`, `customer_email` (nullable)
- `device_type`, `device_model`, `issue_description`
- `warranty_days int not null` (30/90/180/365)
- `created_by uuid references auth.users` (the admin who created it)
- `created_at timestamptz default now()`
- `current_status repair_status default 'received'`
- `delivered_at timestamptz` (set when status transitions to delivered; drives warranty countdown)
- **Immutability enforced by a trigger**: block UPDATE of everything except `current_status` and `delivered_at`; block DELETE for non-service_role.

### `status_events` (append-only)
- `id uuid pk`, `receipt_id uuid → receipts on delete cascade`
- `status repair_status not null`, `note text`, `created_at timestamptz default now()`
- `created_by uuid references auth.users`
- No UPDATE/DELETE policies → append-only by construction.

---

## 2. Authentication Flow

Supabase Auth (email + password), using the integration-managed `_authenticated` gate.

- **Sign up (customer)**: standard email/password. Trigger `handle_new_user()` creates a `profiles` row and assigns default role `customer` in `user_roles`.
- **Admin (Workshop Owner)**: first admin is bootstrapped via SQL (insert into `user_roles`); afterwards admins can promote others via a server function using `supabaseAdmin`.
- **Routes**
  - `/auth` — public sign in / sign up (replaces the current passcode gate).
  - `/_authenticated/admin` — admin panel (JobBoard + ReceiptForm). Gated by `has_role(uid, 'admin')` inside loaders/server fns.
  - `/` — customer tracking stays public (track by ID + QR deep-link still works without login).
  - `/_authenticated/my-repairs` — optional signed-in customer view (list of receipts matching the user's email/phone). UI unchanged, just an additional entry point.
- Retire client-side SHA-256 passcode (`warranty-auth.ts`, `AdminAuthGate.tsx`) once admin login works.

---

## 3. RLS Policies

RLS enabled on every table.

### `receipts`
- SELECT `anon`: allow `true` filtered by `track_id` only — public tracking must keep working via track ID. Implement as: policy `USING (true)` **plus** narrow the server publishable client to always `.eq('track_id', ?)` for anon. (Alternative: only expose a `get_receipt_by_track_id(text)` security-definer RPC to `anon` and revoke direct SELECT — safer, chosen default.)
- SELECT `authenticated`:
  - admin: `has_role(auth.uid(),'admin')`
  - customer: `customer_email = auth.jwt()->>'email'`
- INSERT `authenticated`: admin only.
- UPDATE `authenticated`: admin only, and trigger restricts columns to `current_status`, `delivered_at`.
- DELETE: none (service_role only).

### `status_events`
- SELECT: same visibility rules as parent receipt (via `EXISTS` subquery on receipts).
- INSERT `authenticated`: admin only; trigger auto-sets `receipts.current_status` and `delivered_at` when status = `delivered`.
- No UPDATE/DELETE policies.

### `profiles`
- SELECT/UPDATE: own row (`auth.uid() = id`), admins can read all.

### `user_roles`
- SELECT: own rows + admins.
- INSERT/UPDATE/DELETE: admins only.

Grants: `GRANT SELECT, INSERT, UPDATE ON public.receipts TO authenticated; GRANT ALL TO service_role; GRANT EXECUTE ON FUNCTION get_receipt_by_track_id TO anon, authenticated;` (and equivalent per table).

---

## 4. Migration Strategy (incremental, non-breaking)

Six steps, each leaves the app fully functional.

1. **Enable Lovable Cloud** (`supabase--enable`). Generates types + browser client.
2. **Schema migration** — create enums, tables, triggers, `has_role`, `handle_new_user`, `get_receipt_by_track_id` RPC, grants, RLS policies.
3. **Data layer abstraction** — introduce `src/lib/warranty-repo.ts` with the same function signatures the UI already uses (`listReceipts`, `getByTrackId`, `createReceipt`, `appendStatus`, `getWarrantyInfo`). Point it at Supabase. Keep `warranty-db.ts` as a thin fallback during cutover, then delete.
4. **Auth swap** — add `/auth` route + `useAuth` hook + integration-managed `_authenticated` gate. Replace `AdminAuthGate` in `AdminPanel` with route-based gating. Customer panel unchanged.
5. **Cutover per surface**, in order (verify after each):
   - `CustomerPanel` tracking read → `get_receipt_by_track_id` RPC.
   - QR deep-link hydration → same RPC (drop URL-fragment fallback once live).
   - `JobBoard` list + filters → `receipts` select via `requireSupabaseAuth`.
   - `ReceiptForm` create → server fn insert.
   - `StatusStepper` status updates → server fn insert into `status_events`.
6. **One-time local import** — a "Import legacy receipts" admin action reads existing `localStorage` `warranty_flow_db` and inserts via server fn (idempotent on `track_id`). After success, clear local DB.

Server-side code uses `createServerFn` + `requireSupabaseAuth` per the TanStack Start integration; no Edge Functions.

Rollback: each step is a single PR-sized change; if a surface breaks, revert that file — schema stays.

---

## 5. Technical Details

- New files: `src/lib/warranty-repo.ts`, `src/lib/warranty-repo.functions.ts` (server fns), `src/hooks/use-auth.ts`, `src/routes/auth.tsx`, `src/routes/_authenticated/admin.tsx`, migration SQL.
- Removed after cutover: `warranty-auth.ts`, `AdminAuthGate.tsx`, `use-warranty-db.ts`, `warranty-db.ts` writes (keep read shim until step 6 done).
- Track-ID collision check moves from client loop to a unique constraint + retry on `23505`.
- Warranty state (`pending/active/expired`) stays a pure derived helper — no schema change.
- Print, QR, invoice generator, SEO routes: untouched.

---

## 6. Out of Scope (Phase 3)

Notifications, analytics, multi-tenant workshops, photo uploads, warranty-claim workflow, public REST APIs, realtime subscriptions. Not built in this phase.

---

## 7. Deliverable

After implementation: a migration progress report listing schema created, policies applied, files added/removed, and a checklist of each Phase 1 feature verified against Supabase.

Approve this plan and I'll start with step 1 (enable Lovable Cloud) and the schema migration.