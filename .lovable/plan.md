

# Plan: Deactivate Cooperative Module

## What Changes

### 1. Remove cooperative routes from `src/App.tsx`
- Remove the 3 lazy imports: `CooperativeAuth`, `CooperativeDashboard`, `CooperativeInviteAccept`
- Remove the 3 route definitions: `/auth/cooperative`, `/cooperative`, `/cooperative/invite/accept/:token`
- Remove `/auth/cooperative` and `/cooperative` from the public paths array

### 2. Stop redirecting cooperative-role users in `src/pages/Auth.tsx`
- Remove the `else if (userRoles.includes("cooperative"))` redirect blocks (lines 67-68 and 198-199) — cooperative users will fall through to the normal farmer flow
- Remove the `pendingRedirect?.startsWith('/cooperative/invite/accept/')` checks so cooperative invite URLs are ignored

### 3. Leave files in place (no deletion)
- Keep `src/pages/Cooperative*.tsx`, `src/components/cooperative/*`, `src/hooks/useCooperative.ts` on disk — they just won't be routed to
- Keep database tables/RPCs intact (no destructive migration) — they're unused without the routes

### 4. Remove cooperative from `PermissionsContext.tsx`
- Remove `"cooperative"` from the `GlobalRole` type and `GLOBAL_ROLES` array so it's not checked anywhere

This ensures any user with the cooperative role who logs in via the main `/auth` page will be treated as a normal farmer and land on `/` instead of being redirected to the (now removed) `/cooperative` dashboard.

