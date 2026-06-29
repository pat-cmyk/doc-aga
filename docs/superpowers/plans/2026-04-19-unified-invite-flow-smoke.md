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
5. With both flags OFF, visit `/invite/accept/real-token` → Expect the legacy `InviteAccept` page to render (not a redirect loop). With the frontend flag ON and the Edge flag OFF, visit `/invite/accept/real-token` → Expect `LegacyInviteRedirect` to navigate to `/invite/real-token` and `UnifiedInviteAccept` to load that token (not treat `accept` as the token).

## Rollout sequence (strict order — flipping the wrong flag first breaks the flow)

Two flags must be on for the unified flow to work end-to-end:
- `VITE_UNIFIED_INVITE_FLOW=true` — **frontend build**, controls whether `/invite/:token` is a registered route and whether legacy routes are redirect shims.
- `UNIFIED_INVITE_FLOW=true` — **Edge Function runtime env**, controls the CTA URL in `send-team-invitation` and `send-user-invitation` emails.

### Correct order

1. **Deploy frontend with `VITE_UNIFIED_INVITE_FLOW=true` first.** Confirm the 13-state smoke matrix below passes on staging.
2. **Only then flip `UNIFIED_INVITE_FLOW=true`** on the Edge Function runtime and ask Lovable to redeploy `send-team-invitation` and `send-user-invitation`.
3. New emails now send `/invite/:token` URLs that the frontend serves directly.

### Why the order matters

If the Edge flag is flipped ON first while the frontend flag is still OFF, emails will contain `/invite/:token` URLs but that route isn't registered — invitees land on the `NotFound` page. The reverse order is safe: emails keep sending legacy URLs, and the legacy routes already redirect to the new unified page once the frontend flag is on.

### Rollback order

Reverse of rollout: flip `UNIFIED_INVITE_FLOW` off first (emails revert to legacy URLs), then flip `VITE_UNIFIED_INVITE_FLOW` off (frontend routes unified page back to legacy behavior). Flipping frontend off first leaves in-flight emails pointing at a route the frontend no longer serves unified.

## Evidence

Attach screenshots of each of the 13 terminal states to the PR description.
