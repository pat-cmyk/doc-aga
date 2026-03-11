

# Fix: "Boses ng Magsasaka" Edge Function Error

## Problem
- `process-farmer-feedback` has `verify_jwt = true` in `config.toml`
- Lovable Cloud's signing-keys system rejects the request before code runs (hence zero logs)
- CORS headers are also incomplete

## Changes

### 1. `supabase/config.toml` — set `verify_jwt = false`
Change the existing entry to `verify_jwt = false`.

### 2. `supabase/functions/process-farmer-feedback/index.ts`
- Update CORS headers to include full set: `x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`
- Add in-code JWT validation using `getClaims()` — extract user from Authorization header, verify with Supabase auth, reject if unauthorized
- Use the authenticated Supabase client (with user's auth header) instead of service role for the farm query, keeping service role only where needed

This matches the proven pattern used by `voice-to-text`, `text-to-speech`, and `doc-aga`.

