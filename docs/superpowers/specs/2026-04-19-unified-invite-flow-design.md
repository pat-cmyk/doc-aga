# Unified Invite Flow — Design Spec

**Status:** Draft — awaiting user review
**Date:** 2026-04-19
**Owner:** Doc Aga admin platform
**Supersedes:** Ad-hoc three-route invite flow introduced in commits eadb227, 7fc7739, 5397a1b

---

## 1. Problem

Doc Aga currently operates three parallel invite pipelines, each with its own accept page:

| Flow | Sender context | Route | Accept page |
|---|---|---|---|
| Farm team | Farm owner/manager → farmhand, owner | `/invite/accept/:token` | `src/pages/InviteAccept.tsx` |
| Global role | Super admin → admin, government, merchant, distributor, cooperative | `/invite/user/:token` | `src/pages/UserInviteAccept.tsx` |
| Cooperative membership | Cooperative admin → farm owner | `/cooperative/invite/accept/:token` | `src/pages/CooperativeInviteAccept.tsx` |

All three share one critical friction point: **an unauthenticated invitee is bounced to `/auth?redirect=...&email=...` with a generic Sign-in / Sign-up tabbed form**, then must navigate back to the invite page and click "Accept," for a 4–5 screen journey. For less-tech-savvy government staff, cooperative members, and farmhands, this breaks the mental model ("Am I signing up for Doc Aga, or accepting an invite?") and causes drop-off before dashboard landing.

The invite email link itself already proves the recipient controls the address, so the `/auth` interstitial and the separate email-verification round-trip are both redundant — but currently both happen.

## 2. Goals

- A new invitee completes the flow in **one email click + one form submission** → lands on their role-appropriate dashboard.
- An already-registered invitee with a matching active session completes in **one email click + one confirmation click**.
- Security posture is preserved or improved: single-use tokens, email-owner proof, rate limiting, server-side password policy, full audit trail.
- All three existing invite types converge on a single accept surface with type-specific logic confined to server-side RPCs.
- Legacy invite emails sent before rollout continue to work for at least 90 days.

## 3. Non-goals

- SSO / Google sign-in for invitees.
- SMS-based invites for farmhands without email.
- Bulk invite CSV import.
- Self-service "change my invited email" flow.
- Changes to sender-side admin UIs (`InviteUserDialog`, `FarmTeamManagement`, `PendingInvitationsTable`) beyond updating the email CTA URL.

## 4. User journeys

### 4.1 New user (no prior Doc Aga account)

1. Admin sends invite → email arrives with CTA **"Accept your invitation"**.
2. User clicks → lands on `/invite/:token`.
3. Page renders the **Welcome card**: logo, inviter name, role label, two fields (`Full name`, `Password` with show/hide + strength meter), primary button **"Accept & continue →"**.
4. Submit → `accept-invitation` Edge Function validates token → creates auth user with `email_confirm: true` → grants role/membership → returns a session.
5. Client calls `supabase.auth.setSession()` → navigates to role-appropriate dashboard.
6. Dashboard renders welcome toast: "Welcome, [name]. You now have access to [workspace]."

**Total user actions:** 2 (click email, submit form).

### 4.2 Existing user, signed in with matching email

1. Click invite → lands on `/invite/:token`.
2. Page detects matching session → calls `accept-invitation` Edge Function (with the user's JWT) in the background.
3. Renders confirmation card: "You've been granted **[role]** access by **[inviter name]**. [Go to Dashboard →]"
4. Click → dashboard.

**Total user actions:** 2 (click email, click "Go to Dashboard").

### 4.3 Existing user, not signed in

1. Click invite → lands on `/invite/:token`.
2. Page renders compact **"Sign in to accept"** form — email field is pre-filled and locked; only password is editable.
3. Sign in → auto-accept → dashboard.

### 4.4 Session mismatch (wrong account signed in)

E.g., invite sent to `mayor@lgu.gov.ph`, device signed in as `personal@gmail.com`.

1. Page detects mismatch → renders warning card: "This invite was sent to `mayor@lgu.gov.ph`. You're signed in as `personal@gmail.com`."
2. Single primary button: **"Sign out & continue."**
3. Click → sign out → redirect back to `/invite/:token`, which now falls through to journey 4.1 (if no account) or 4.3 (if account exists, email pre-filled).

No "accept anyway with current account" option. The invited email must equal the accepting email — this preserves the audit trail and prevents shared-device hijacking.

## 5. Architecture

### 5.1 New artifacts

1. **Single route** `/invite/:token` → `src/pages/UnifiedInviteAccept.tsx`. Renders a state machine driven by the `lookup_invitation` response. Knows nothing about which backend table the token belongs to.

2. **`lookup_invitation(p_token uuid)` RPC** (SECURITY DEFINER). Probes `farm_memberships`, `user_invitations`, and `cooperative_memberships` in that order; returns a normalized row:
   ```
   {
     type: 'farm' | 'user' | 'coop',
     status: 'pending' | 'accepted' | 'revoked' | 'expired',
     email: text,
     role: text,
     role_label: text,            -- e.g. "Farm Manager", "Government Account"
     inviter_name: text,
     inviter_email: text,
     target_name: text,           -- farm name, cooperative name, or "Doc Aga"
     invited_at: timestamptz,
     expires_at: timestamptz
   }
   ```
   Returns `NULL` for unknown/malformed tokens. Single-query fast path: tokens are UUIDs with unique indexes on all three tables.

3. **`accept-invitation` Edge Function** (`supabase/functions/accept-invitation/index.ts`). The only code path that calls `supabase.auth.admin.createUser`. Responsibilities:
   - Validate token + expiry + status via `lookup_invitation`.
   - For new-user branch: enforce password policy, call `admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`, then dispatch to the type-specific accept RPC.
   - For existing-user branch (request carries a valid JWT): verify the JWT's email matches the invite email (case-insensitive); dispatch to the accept RPC only.
   - Return `{ session, redirectTo }` or a typed error code (see §7).
   - Rate-limited: 10 attempts per token per hour, 60 per IP per hour.
   - Idempotent: re-checks invitation status before any auth mutation.

4. **`request_invitation_resend(p_token uuid)` RPC** (SECURITY DEFINER). Expired-link auto-resend:
   - Guardrails: inviter still active, invitation not revoked, ≤1 auto-resend per original token per 24h.
   - Generates a fresh token, updates the invitation row, triggers `send-team-invitation` or `send-user-invitation` as appropriate.
   - Returns `{ sent: true }` or `{ sent: false, reason: 'revoked' | 'inviter_inactive' | 'recent_resend' }`.

5. **`accepted_ip inet` column** added to `farm_memberships`, `user_invitations`, `cooperative_memberships`. Populated by the Edge Function on accept.

6. **Shared redirect helper** `src/lib/inviteRedirects.ts`. Pure function `resolveInviteRedirect({ type, role, farm_id?, cooperative_id? }): string`. Extracts today's scattered logic from three accept pages + `ROLE_HOMES` map.

### 5.2 Reused artifacts (unchanged)

- `send-team-invitation` and `send-user-invitation` Edge Functions — only the email CTA URL changes to `/invite/:token`.
- `accept_farm_invitation`, `accept_user_invitation`, cooperative membership accept logic — already validate and mutate correctly. The new Edge Function dispatches into them by type.
- Admin sender UIs: `InviteUserDialog`, `FarmTeamManagement`, `PendingInvitationsTable`.
- RLS policies on all three backend tables.

### 5.3 Retired artifacts

- `src/pages/InviteAccept.tsx` → replaced by redirect shim `<Navigate to={`/invite/${token}`} replace />` during the 90-day window, then deleted.
- `src/pages/UserInviteAccept.tsx` → same.
- `src/pages/CooperativeInviteAccept.tsx` → same.

## 6. Data flow — new user accept (canonical path)

```
Browser                    Edge Function                  Supabase
   │                              │                           │
   │  GET /invite/:token          │                           │
   │──────────────────────────────┼──────────────────────────▶│ lookup_invitation(token)
   │◀── normalized row            │                           │
   │                              │                           │
   │  user fills name+password    │                           │
   │                              │                           │
   │  POST /accept-invitation     │                           │
   │     { token, name, pwd }     │                           │
   │─────────────────────────────▶│  verify token + expiry    │
   │                              │──────────────────────────▶│ lookup_invitation(token)
   │                              │◀── row                    │
   │                              │                           │
   │                              │  admin.createUser({       │
   │                              │    email, password,       │
   │                              │    email_confirm: true,   │
   │                              │    user_metadata:{name}   │
   │                              │  })                       │
   │                              │──────────────────────────▶│ auth.users
   │                              │◀── user_id                │
   │                              │                           │
   │                              │  accept_<type>_invitation │
   │                              │──────────────────────────▶│ grant role / membership
   │                              │◀── success + redirectTo   │
   │                              │                           │
   │                              │  signInWithPassword       │
   │                              │──────────────────────────▶│ session
   │◀─── { session, redirectTo }  │                           │
   │                              │                           │
   │  setSession() + navigate()   │                           │
   │─── window.location ──────────┼──────────────────────────▶│ role-appropriate dashboard
```

## 7. Error & edge-case matrix

| Case | Page state | Available action |
|---|---|---|
| Valid token, new user | Welcome card with name+password form | Accept & continue |
| Valid token, existing user signed in, email matches | Confirmation card with inviter + role | Go to Dashboard |
| Valid token, existing user signed in, email mismatches | Warning card | Sign out & continue |
| Valid token, existing user NOT signed in | Compact sign-in form, email locked | Sign in & accept |
| Token expired | "This link expired on [date]" | Request new link (auto-resend if guardrails pass) |
| Token already accepted | "You've already joined [workspace]" | Go to Dashboard |
| Token revoked by admin | "This invite was cancelled" | Copy inviter email — no auto-resend |
| Token doesn't exist / malformed | "This invite link is invalid" | Home link |
| Inviter account deactivated | "The person who invited you is no longer active" | `support@goldenforage.com` link |
| User has existing pending invite for same workspace | Auto-merge: most recent token wins, older tokens marked superseded | — |
| Network failure during accept | Inline toast "Couldn't complete — retry?" | Retry (idempotent) |
| Password too weak | Inline field error | Fix and resubmit |
| Email already has an auth account | Fall through to "Sign in to accept" | Sign in |
| Supabase outage / 5xx during createUser | "We're having trouble right now" | Retry button; logged |
| User clicks same link in two tabs | Second tab sees "already accepted" | Go to Dashboard |

Edge Function error codes (returned as `{ code, message }`): `TOKEN_NOT_FOUND`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_ALREADY_ACCEPTED`, `EMAIL_MISMATCH`, `WEAK_PASSWORD`, `RATE_LIMITED`, `INVITER_INACTIVE`, `INTERNAL`.

## 8. Security

- **Token transit:** HTTPS only. Tokens are logged only with last-4-character masking in Edge Function error traces.
- **Token single-use:** cleared from the invitation row on accept. Farm invites already do this; this spec extends the pattern to `user_invitations` and `cooperative_memberships`.
- **Email proof-of-ownership:** the invite link is treated as a verification token — `email_confirm: true` is set at user creation. This matches Slack / Notion / Linear.
- **Password policy:** enforced server-side in the Edge Function. Minimum 8 characters; reject if present in an embedded top-1k common-password list. No client-side bypass.
- **Email mismatch:** returns `409 EMAIL_MISMATCH`. No "accept anyway as current account" path exists, preventing shared-device hijacking.
- **Rate limiting:** `accept-invitation` at 10/token/hour and 60/IP/hour; `request_invitation_resend` at 1/token/24h; existing `send-user-invitation` 20/min unchanged.
- **Audit:** every accept writes `accepted_user_id`, `accepted_at`, and the new `accepted_ip` column.
- **RLS unchanged:** SECURITY DEFINER RPCs remain the gatekeepers; the new Edge Function is the only caller of `admin.createUser`.
- **Typo safety net:** a mis-addressed invite that is never claimed expires harmlessly after 7 days. Admin can revoke at any time.

## 9. URL migration

`/invite/:token` is the new canonical route. The token namespace is unified by UUID uniqueness across the three tables; `lookup_invitation` resolves type server-side.

Legacy routes become `<Navigate to={`/invite/${token}`} replace />` shims:
- `/invite/accept/:token`
- `/invite/user/:token`
- `/cooperative/invite/accept/:token`

Shims remain for 90 days from rollout, then are deleted. Email CTA generation in `send-team-invitation` and `send-user-invitation` is updated to emit the new URL from rollout day forward.

## 10. Testing

- **RPC unit tests** (Supabase SQL): `lookup_invitation`, `request_invitation_resend`, accept RPCs — cover valid / expired / revoked / accepted / mismatched-email / unknown-token / 24h resend guardrail.
- **Edge Function tests** (Deno test runner, per `supabase/functions/` convention): new-user happy path, existing-user happy path, token reuse, weak password, `admin.createUser` failure, rate-limit trip, idempotency under double-submit.
- **React component tests** (Vitest + Testing Library, `renderWithProviders`): each of the 15 states in §7, form validation, sign-out-and-return, auto-accept for matching-session existing users.
- **Legacy-redirect tests**: assert the three legacy routes navigate to `/invite/:token`.
- **E2E smoke** (manual, scripted in the PR): 3 invite types × 3 user states = 9 runs on mobile viewport 390×844 per CLAUDE.md. Screenshot each terminal state.
- **Coverage:** 10% global gate unchanged; aim for ~85% line coverage on `UnifiedInviteAccept` + `accept-invitation` Edge Function.

## 11. Rollout

Phased, single week, behind `VITE_UNIFIED_INVITE_FLOW` feature flag.

| Day | Action |
|---|---|
| 1 | Land DB migration: `lookup_invitation`, `request_invitation_resend`, `accepted_ip` column, indexes. User runs SQL in Supabase SQL Editor per CLAUDE.md backend rules. |
| 2 | Land `accept-invitation` Edge Function — user relays to Lovable for deploy. Land new React page + keep legacy pages behind flag (default off). |
| 3 | Flip flag to on in staging, run E2E script, verify all 9 paths. |
| 4 | Update email CTAs in `send-team-invitation` and `send-user-invitation` to point at `/invite/:token`. |
| 5 | Flip flag in prod. Legacy pages become redirect shims. Monitor error rates + completion rate for 48h. |
| 90 | Remove legacy routes and retired page files. |

## 12. Success metrics

- **Invite completion rate** (accepted / delivered): ≥80%. Capture baseline during rollout week.
- **Median time from email delivery → dashboard landing** for new users: <90 seconds.
- **"Invite confusion" support tickets:** zero for 30 days after rollout.

## 13. Governance updates (per CLAUDE.md)

- `docs/ssot-architecture.md` — add section on the unified accept flow; note `lookup_invitation` as the single entry point.
- `docs/data-relationships-map.md` — document new `accepted_ip` column on all three invitation tables, new `request_invitation_resend` RPC.
- `changelog.md` — user-facing entry describing the UX change + 90-day migration window for legacy URLs.

## 14. Open questions

None at spec time. All seven design decisions resolved during brainstorming (Q1–Q7).

## 15. References

- CLAUDE.md — governance, Supabase backend rules, RLS mandate, `useOnlineStatus` pattern
- `docs/enhanced-governance-protocol.md` — pre-coding review framework
- Commit 5397a1b — current global-role invite flow (`/invite/user/:token`)
- Commits eadb227, 7fc7739 — `send-team-invitation` Edge Function
