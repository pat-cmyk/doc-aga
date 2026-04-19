# Unified Invite Flow — Smoke Test Runbook

Run before flipping `VITE_UNIFIED_INVITE_FLOW` to `true` in production. All checks at viewport 390×844 (mobile).

## 3 × 3 matrix: 9 scripted runs, 1 screenshot per terminal state

| # | Invite type | User state | Expected terminal state |
|---|---|---|---|
| 1 | Global role (admin) | New user | Lands on `/admin` after setting password |
| 2 | Global role (admin) | Existing user, matching session | Lands on `/admin` after one confirmation click |
| 3 | Global role (admin) | Existing user, not signed in | Lands on `/admin` after inline sign-in |
| 4 | Farm (farmhand) | New user | Lands on `/farmhand` |
| 5 | Farm (farmhand) | Existing user, matching | Lands on `/farmhand` |
| 6 | Farm (farmhand) | Existing user, signed out | Lands on `/farmhand` |
| 7 | Cooperative (farm owner) | New user (unlikely path — coop invites go to farm owners who should already exist) | Document outcome |
| 8 | Cooperative | Existing matching | Lands on `/` (farm dashboard) |
| 9 | Cooperative | Signed-out existing | Lands on `/` |

## Error-state checks (4 additional runs)

1. Visit `/invite/not-a-real-token` → Expect "Invite not found" card.
2. Fast-forward a test invite's `token_expires_at` 8 days → visit → Expect "Expired" card + Resend button.
3. Admin revokes an invite → invitee visits → Expect "Cancelled" card.
4. Invitee clicks invite link with a session on a different email → Expect mismatch warning.

## Evidence

Attach screenshots of each of the 13 terminal states to the PR description.
