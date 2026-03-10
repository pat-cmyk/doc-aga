

# Plan: Fix Cooperative Login by Re-running Seed Migration

## Root Cause
The previous seed migration for "Golden Sunrise Milk Coop" did not take effect. The `user_roles` table has no `cooperative` entry for `estehanon@gmail.com`, and the `cooperatives` table is empty.

## Fix
Run a new database migration that:
1. Inserts the `cooperative` role into `user_roles` for user `633240e1-84e0-47f3-a9c5-9ee17410a483`
2. Creates the "Golden Sunrise Milk Coop" cooperative record with that user as admin
3. Enrolls all demo farms as accepted cooperative members

The SQL will use direct UUIDs (since we know the user ID) and `ON CONFLICT` guards for safety. This avoids the `auth.users` reference that may have caused the previous migration to fail silently.

## No Code Changes Required
The `CooperativeAuth.tsx` login flow is correct -- the only issue is missing database data.

