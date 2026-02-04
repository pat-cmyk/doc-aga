
## What I found (thorough assessment)

### 1) Mapbox is working and not the blocker
From the browser network logs:
- The app successfully calls the backend function `mapbox-token` and receives a valid Mapbox public token (HTTP 200).
- Mapbox style loads successfully (`mapbox/light-v11` returns HTTP 200).

So Mapbox requirements (token + map style load) are satisfied. The reason you see a basemap but no pins is almost certainly “no usable marker data is reaching Mapbox”.

### 2) Demo + Live farms DO have GPS coordinates (so data exists)
From the database:
- Total farms: 27
- Demo farms: 15 (15/15 have gps_lat & gps_lng)
- Live farms: 12 (12/12 have gps_lat & gps_lng)
- The analytics view `gov_farm_analytics` also shows **0 rows missing GPS**.

So we do NOT need to “fill in missing GPS” right now; the coordinates are already present.

### 3) The actual blocker: the RPC is failing at runtime
When calling:
`public.get_gov_farm_analytics_with_audit(...)`

It errors with:
- `ERROR: column "role" does not exist`
- Context: inside `get_gov_farm_analytics_with_audit` it runs `SELECT role FROM profiles ...`

Your `public.profiles` table columns (confirmed) do not include `role` or `user_role`. It only has fields like:
- id, full_name, phone, created_at, updated_at, email, voice_training_*, is_disabled

Therefore the RPC crashes immediately, so the frontend receives no farm analytics rows → no regional aggregation → no markers.

### 4) Secondary issue that can still prevent pins even after RPC fix: numeric fields likely arrive as strings
Your `gov_farm_analytics.gps_lat/gps_lng` are `numeric` in the view/table schema. In many PostgREST/Supabase-style JSON responses, `numeric` and `bigint` often arrive as strings in JavaScript.

If the frontend does math like:
- `existing.latSum += farm.gps_lat;` (where gps_lat is `"14.18"` as a string)
it can produce string concatenation and eventually `NaN` averages, which then fails this marker guard:
- `if (!region.avg_gps_lat || !region.avg_gps_lng) return;`
(`NaN` is falsy, so markers are skipped.)

So we should fix both:
1) RPC runtime error (mandatory)
2) numeric parsing/casting (strongly recommended to make pins reliable)

---

## Fix plan (what I will implement next)

### A) Database: repair `get_gov_farm_analytics_with_audit` so it no longer depends on `profiles.role`
Goal: make the function:
- Authorize correctly for government/admin users
- Audit log safely
- Return rows reliably

Changes:
1. Remove `SELECT role FROM profiles ...` (this is invalid).
2. Determine authorization using the already-established pattern:
   - `has_role(auth.uid(), 'government'::user_role)` or `has_role(auth.uid(), 'admin'::user_role)`
3. For audit logging `user_role`, set it deterministically:
   - if admin => `"admin"`
   - else if government => `"government"`
   - else raise unauthorized
4. Return an explicit SELECT list from `gov_farm_analytics` (avoid `SELECT *`) and cast numeric/bigint to JS-friendly types.
   - Option 1 (preferred): make RPC return `double precision` for gps and `bigint` for counts, but explicitly cast:
     - `gps_lat::double precision`, `gps_lng::double precision`
   - This avoids the earlier “structure mismatch” problem because we won’t use `SELECT *`, we’ll match the return signature exactly.

Expected outcome:
- RPC stops throwing 42703 (missing column)
- Frontend gets data again
- Audit log continues to work

### B) Frontend: harden `useRegionalStats` against string numerics (so averages never become NaN)
Even with casting, it’s safest to ensure robust parsing on the client.

Changes in `src/hooks/useRegionalStats.ts`:
1. Introduce small helper converters:
   - `toNum(value): number | null` that does `value == null ? null : Number(value)` and returns `null` if `Number.isFinite` fails.
2. Apply conversions for:
   - `gps_lat`, `gps_lng`
   - `cattle_count`, `goat_count`, `carabao_count`, `sheep_count`
   - `active_animal_count`
3. Update the marker guard logic indirectly by ensuring `avg_gps_lat/lng` is a real finite number. If not, fall back to `getRegionalCoordinates(region)`.

Expected outcome:
- No more NaN coordinates
- Pins render consistently for both demo and live data

### C) Add targeted diagnostics (temporary, removable)
To make sure we never “silently fail” again, I’ll add minimal diagnostics:
- If the RPC returns error: surface a small inline error state in the map card (instead of silently showing an empty map).
- Optionally log `regionalStats.length` and a sample region to console in dev.

Expected outcome:
- If backend breaks again, you’ll immediately see “why” (auth error, rpc error, empty dataset, etc.)

---

## Verification checklist (I’ll run through after implementing)
1. Backend function call succeeds (no errors) and returns rows.
2. `useRegionalStats('demo')` returns 3 regions (NCR, Region IV-A, Region VIII) based on current data.
3. Pins appear in:
   - Demo
   - Live
   - All
4. Clicking a pin opens the detail panel and shows correct region name.

---

## Mismatches / missing information I will notify you about
Current confirmed mismatches:
- RPC function references `profiles.role` but `profiles` has no `role` column (hard failure).
- `gov_farm_analytics.gps_lat/gps_lng` are `numeric`, which can become string values in JS responses and break averaging unless cast/parsed.

Not missing:
- Demo GPS coordinates: present for all demo farms (15/15)
- Live GPS coordinates: present for all live farms (12/12)
- Mapbox token/style loading: working

---

## Files / areas that will change
- Database migration: update `public.get_gov_farm_analytics_with_audit` function body and return query to:
  - remove profiles.role dependency
  - cast return values explicitly
- `src/hooks/useRegionalStats.ts`: numeric parsing hardening + better error surfacing
