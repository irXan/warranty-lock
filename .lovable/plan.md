# Phase 3 / Feature 3 — Customer Accounts (final implementation plan)

Optional customer accounts, with **Track ID claim as the only authoritative link** between a signed-in customer and a repair. Email is contact metadata only. No UI redesign, no other Phase 3 work.

## What changes for users

- A customer can create an account (same sign-in page, no new UI style).
- Signed in, they see "My repairs" — repairs they have explicitly claimed.
- To add a repair they enter its Track ID (or open a QR/deep link while signed in and press "Claim this repair").
- Public Track ID tracking keeps working exactly as today, signed in or not.

## Security adjustments applied

1. **Claim-only linking.** Access to private customer history comes from a claim row, never from an email match.
2. **`customer_email` is contact metadata.** Still stored on new receipts; never used in any RLS policy or access decision. The existing email-based policies on `receipts` and `status_events` are dropped.
3. **Enumeration-resistant claim endpoint.** Server-side rate limit per user and per IP, a uniform generic failure message and constant-ish response for unknown / already-claimed / invalid Track IDs, so the response never reveals whether a Track ID exists.
4. **One active claimant per repair.** Enforced by a unique partial index on active claims. The table carries `status` and `released_at` columns so a controlled reassignment or secondary claimant can be added later without a migration to the core shape — not implemented now.

## Database changes (one additive migration)

New table `public.receipt_claims`:

- `id uuid pk`, `receipt_id uuid -> receipts(id)`, `user_id uuid -> auth.users(id)`
- `status claim_status not null default 'active'` (enum: `active`, `released`)
- `claimed_at timestamptz default now()`, `released_at timestamptz`
- unique partial index on `(receipt_id) where status = 'active'` — one active claimant
- unique partial index on `(receipt_id, user_id) where status = 'active'`

New table `public.claim_attempts` (rate limiting / abuse audit): `id`, `user_id`, `ip_hash text`, `created_at`, index on `(user_id, created_at)` and `(ip_hash, created_at)`. Written server-side only; no client grants.

Grants: `SELECT` on `receipt_claims` to `authenticated`, `ALL` to `service_role`. `claim_attempts`: `service_role` only.

RLS:
- `receipt_claims`: customer may `SELECT` own rows (`user_id = auth.uid()`); workshop members may `SELECT` claims for receipts in their workshop. No client `INSERT`/`UPDATE`/`DELETE` — claims are created only by the server function.
- Helper `app_private.has_active_claim(_user_id uuid, _receipt_id uuid)` — `SECURITY DEFINER`, fixed `search_path`, execute revoked from `public`/`anon`.
- `receipts`: drop `receipts_customer_select` (email match), add `receipts_claimant_select` using `app_private.has_active_claim(auth.uid(), id)`.
- `status_events`: same swap — drop the email-match policy, add a claim-based one.
- `repair_photos`: add a claimant `SELECT` policy so a claiming customer sees photos for their repair; workshop-member policies unchanged.

Nothing on `receipts` is altered — immutability trigger, status history, warranty logic and workshop policies are untouched.

## Server functions (`src/lib/customer-claims.functions.ts`)

All authenticated via `requireSupabaseAuth`.

- `claimReceiptByTrackId({ trackId })` — records an attempt, checks the rate limit (e.g. 5 attempts / 10 min per user, 20 / hour per hashed IP), looks up the receipt with the admin client, and inserts the claim only if there is no active claim. Every failure path returns the same generic `{ ok: false }` with one message: "That Track ID couldn't be claimed. Check the ID and try again." Success returns the claim id and track id.
- `listMyRepairs()` — reads through the caller's RLS-scoped client so the claim policies are the enforcement point; returns the same receipt shape the customer panel already renders, plus status history.
- `getMyRepair({ trackId })` — single claimed repair with status history and signed photo URLs, reusing the existing repair-photos signing helper.

## Frontend

- `src/hooks/use-auth.ts` — no shape change; customer accounts are simply users with no admin role and no workshop membership.
- `src/routes/index.tsx` — when signed in and not an admin, show the existing customer panel plus a "My repairs" section. Public tracking form stays exactly where it is.
- New `src/components/warranty/MyRepairs.tsx` — list of claimed repairs using the existing card/status/warranty components; a Track ID input to claim a new one.
- New `src/components/warranty/ClaimRepairButton.tsx` — shown on the public tracking result when the visitor is signed in and the repair is unclaimed by them.
- `src/routes/auth.tsx` — after sign-in, if a `?track=` param or stored pending track id exists, run the claim once and route back to tracking.
- Existing components (`CustomerPanel`, `StatusStepper`, `RepairPhotoGrid`, `CustomerRepairPhotos`, print/PDF) are reused as-is.

## Implementation order

1. Migration: enum, `receipt_claims`, `claim_attempts`, grants, helper function, RLS swap on `receipts` / `status_events` / `repair_photos`.
2. `customer-claims.functions.ts` with rate limiting and generic errors.
3. `MyRepairs` + claim button, wired into the existing home route.
4. Sign-in claim hand-off from `/auth`.
5. QA: public tracking unchanged, QR deep link unchanged, claim once, second account cannot claim the same repair, admin/staff views unchanged, photos and print unchanged.

## Risks

- Dropping the email-match policies is the one behavioral removal; it is intentional and nothing in the current UI depends on it.
- Rate-limit counters live in the database, so the limit is per project rather than per edge node — acceptable at this scale.
- Signed photo URLs for customers keep their existing short TTL.
