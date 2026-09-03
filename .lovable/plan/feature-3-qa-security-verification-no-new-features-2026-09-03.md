# Feature 3 QA & Security Verification (no new features)

Verification-only pass over the existing Customer Accounts implementation. No redesign, no new features; the only code changes allowed are fixes for defects the tests surface.

## What is already confirmed by reading code and access rules

- Claim endpoint is authenticated, validates input, rate limits (5 attempts / 10 min per user, 20 / hour per IP hash) before any lookup, and returns one generic failure message for "not found" and "claimed by someone else".
- Re-claiming your own repair is an idempotent success; a second account cannot take an active claim.
- Email-based access to receipts is gone. Private customer reads are gated on an active claim only (receipts, status history, repair photos each have a claimant-only read rule).
- Customers have no create/update/delete access to receipts or status events.
- Public Track ID tracking is a separate server path and untouched by the claim rules.

These are structural confirmations; the run below verifies actual behaviour end to end.

## Test run

Automated browser runs against the live app, plus read-only database checks between steps.

1. Customer signup + sign-in, and that "My repairs" appears for a signed-in non-admin.
2. Claim a valid Track ID; confirm it appears in "My repairs" with status history, warranty state, and permitted photos.
3. Re-claim the same ID from the same account (expect no duplicate) and from a second account (expect the generic failure).
4. Invalid / non-existent Track IDs return the identical generic message with no timing or wording tell.
5. Trip the rate limiter with repeated attempts; confirm the throttle message and that attempts are recorded.
6. Direct API attempts from a customer session: edit a receipt, insert a status event, read an unclaimed repair, read another workshop's receipts and photos — all expected to be refused.
7. Signed-out checks: Track ID lookup, QR/deep-link (`/?track=…#r=…`) hydration, print/PDF output.
8. Owner/staff regression: sign-in, job board, receipt creation, status advance, photo upload, staff roster, and confirmation that an admin session is never shown the customer "My repairs" surface.

## Fixes

Any defect found is fixed in place, narrowly, then re-tested. No unrelated refactors.

## Report

A concise report at the end: tests passed, tests failed, security issues found, bugs fixed, remaining limitations, and a clear verdict on whether Feature 3 is fully verified.

## Technical notes

- Test accounts are created through the normal signup flow; a claim test needs one real receipt in a workshop, so one throwaway workshop/receipt may be created and left in place unless you want it removed afterwards.
- Rate-limit testing writes rows to the attempt log for the test user only; it does not affect real users.
- Negative access tests are executed as the signed-in test customer against the real endpoints, so they prove the access rules rather than the UI hiding buttons.
