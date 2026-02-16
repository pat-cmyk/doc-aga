

# Complete Cooperative Module — Pending Items

Two items remain from the original 5-phase plan: the cooperative invitation acceptance flow and documentation updates.

---

## 1. Cooperative Invitation Acceptance Page

Farm owners currently have no way to accept or decline cooperative invitations. The `invite_farm_to_cooperative` RPC creates a membership row with a token, but there is no UI for the farm owner to act on it.

### New File: `src/pages/CooperativeInviteAccept.tsx`

A standalone page at `/cooperative/invite/accept/:token` that:
- Reads the token from the URL
- Queries `cooperative_memberships` to find the matching pending invitation
- Shows the cooperative name, and Accept / Decline buttons
- On accept: updates `invitation_status` to `accepted` and sets `accepted_at`
- On decline: updates `invitation_status` to `declined`
- If the user is not logged in, redirects to `/auth` with a redirect parameter back to this page (same pattern as the existing farm invitation flow in `Auth.tsx`)
- If the token is expired or not found, shows a clear error

### Route Addition: `src/App.tsx`

Add one new route:
```
/cooperative/invite/accept/:token -> CooperativeInviteAccept
```

### Auth.tsx Update

Add cooperative invite redirect handling alongside the existing farm invite pattern — when `pendingRedirect` starts with `/cooperative/invite/accept/`, preserve it through login (mirror the existing `/invite/accept/` logic).

---

## 2. Documentation Updates

### EDIT: `docs/data-relationships-map.md`

Add a new section for the Cooperative Module covering:
- `cooperatives` table schema and RLS policies
- `cooperative_memberships` table schema and RLS policies
- Aggregation RPCs (`get_cooperative_herd_summary`, `get_cooperative_milk_production`, `get_cooperative_health_overview`, `get_cooperative_financial_summary`, `get_cooperative_member_farms`)
- `invite_farm_to_cooperative` RPC
- Data flow: `cooperative_memberships (accepted) -> SECURITY DEFINER RPCs -> useCooperative hooks -> Dashboard components`

### EDIT: `docs/ssot-architecture.md`

Add cooperative data flow entry:
- Cooperative Aggregation: `cooperative_memberships` (accepted farms) -> aggregation RPCs -> `useCooperative` hooks -> `CooperativeDashboard` tabs
- Note that cooperative reads are entirely via SECURITY DEFINER functions and do not touch existing farm RLS policies

---

## Files Summary

| File | Action |
|------|--------|
| `src/pages/CooperativeInviteAccept.tsx` | CREATE |
| `src/App.tsx` | EDIT — add 1 route |
| `src/pages/Auth.tsx` | EDIT — add cooperative invite redirect handling |
| `docs/data-relationships-map.md` | EDIT — add cooperative section |
| `docs/ssot-architecture.md` | EDIT — add cooperative data flow |
| **Total** | **5 files** |
