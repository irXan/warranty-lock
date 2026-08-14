# Phase 3 — Feature 1: Workshop Staff Access

## What already exists (verified)

- `workshops` and `workshop_members` tables with roles `owner` / `staff`, plus RLS helpers `is_workshop_member` / `is_workshop_owner` in `app_private`.
- Owner-only policy `members_manage_owner` already restricts all writes on `workshop_members` to the workshop owner; members of a workshop can read the member list.
- `grantWorkshopAdmin` server function: owner-only, looks the person up by email in existing accounts, and if found adds them as `staff` in `workshop_members` plus the `admin` app role. If no account exists it returns a friendly error — so the recipient must register first.
- Receipt access is already workshop-scoped: `admin` app role + membership of that workshop. Staff therefore already get correct receipt access once granted.
- `WorkshopTools` shows the grant form to every admin; `AdminAuthGate` shows "Claim workshop ownership" to every signed-in non-admin.

So the grant path exists. What's missing: a visible staff list, revoke, owner-vs-staff distinction in the UI, and owner-only gating of those controls.

## What will change

### Backend (server functions, no schema change needed)

Add to `src/lib/workshop.functions.ts`:

- `listWorkshopMembers` — owner or staff of the workshop; returns each member's email (via Auth admin lookup), role (`owner`/`staff`), and join date. Caller must be a member; the workshop is derived from the caller's own membership, never from input.
- `revokeWorkshopStaff` — owner-only. Removes the target's `workshop_members` row and their `admin` app role. Refuses to remove an `owner` row and refuses self-revoke, so ownership can't be lost through the UI.
- `grantWorkshopAdmin` stays as-is (already owner-only), with its message clarified to "ask them to register with this email first".

All three verify the caller server-side; hiding buttons is never the only control.

### Database / RLS

No schema change required — existing policies already enforce everything:

- `members_manage_owner` (owner-only writes) blocks staff from granting or revoking.
- `claimWorkshopOwnership` already refuses once any member exists, so staff can't claim ownership.
- Receipts/status policies already scope to the caller's workshop.

One small hardening migration only if verification shows a gap: nothing planned up front.

### Frontend (existing screens, no redesign)

- `src/hooks/use-auth.ts`: also expose `workshopId` and `workshopRole` (`owner` | `staff` | null), read from `workshop_members`.
- `src/components/warranty/WorkshopTools.tsx`: keep the current card and styling; add a compact team list (email, Owner/Staff badge, Revoke button on staff rows only). Grant form and revoke buttons render only for the owner; staff see a read-only team list. Legacy import stays owner-only.
- `src/components/warranty/AdminAuthGate.tsx`: only show "Claim workshop ownership" when the workshop genuinely has no owner yet; otherwise show the existing "ask an admin for access" message.
- Toast success/error feedback reuses the existing sonner pattern.

Nothing else is touched: receipt form, job board, customer tracking, QR, printing, warranty stages, SEO all unchanged.

## Verification

Browser pass with the real app: owner sees team management and can grant/revoke; a staff account signs in, lands in the same admin panel, sees no grant/revoke/claim controls, and a direct server-fn call as staff is rejected; receipt creation, status updates, public Track ID lookup and QR tracking still work.

## Known limitation (accepted for this milestone)

No email invitation system. A staff member must register an account with their email first, then the owner grants access. This is documented in the UI helper text.
