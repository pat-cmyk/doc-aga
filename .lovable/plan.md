

# Two Fixes to Implement

## 1. Fix Build Error: `getClaims` in `process-farmer-feedback` Edge Function

**File**: `supabase/functions/process-farmer-feedback/index.ts`

`getClaims(token)` does not exist on `SupabaseAuthClient`. Replace with `getUser()`, which validates the JWT via the `Authorization` header already set on the client:

```typescript
// Replace lines 31-37:
const { data: userData, error: authError } = await supabaseAuth.auth.getUser();
if (authError || !userData?.user) {
  console.error('[process-farmer-feedback] Auth failed:', authError?.message);
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
const userId = userData.user.id;
```

## 2. Fix BCS Migration: Wrong Column References in `heat_stats` CTE

**File**: `supabase/migrations/20260313100000_fix_health_stats_bcs_thresholds.sql`

The migration still references `hr.observed_date` and `hr.cycle_length_days` which don't exist on `heat_records`. Must use:
- `hr.detected_at` instead of `hr.observed_date`
- Window function to derive cycle length: `EXTRACT(EPOCH FROM (hr.detected_at - LAG(hr.detected_at) OVER (PARTITION BY hr.animal_id ORDER BY hr.detected_at))) / 86400.0`

Update the `heat_stats` CTE (lines 98-106) and `optimal_window` CTE (lines 107-117) to use `detected_at`.

## 3. Run Historical Feed Cost Fix

Execute the data-only UPDATE from the screenshot against `feeding_records` using the insert/update tool (not a migration, since it's a data fix).

