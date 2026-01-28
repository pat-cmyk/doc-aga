

# Fix `is_farm_manager()` SQL Function

## Problem Confirmed

The `is_farm_manager()` function is broken and returns incorrect results:

| Function | Current Result | Expected |
|----------|---------------|----------|
| `is_farm_manager(pat.ebuna, estehanon_farm)` | `false` | `true` |
| `is_farm_manager_only(pat.ebuna, estehanon_farm)` | `true` | `true` |

## Root Cause

Current broken implementation:
```sql
SELECT EXISTS (
  SELECT 1 FROM public.farm_memberships fm
  JOIN public.user_roles ur ON ur.user_id = fm.user_id  -- WRONG!
  WHERE fm.farm_id = _farm_id 
    AND fm.user_id = _user_id 
    AND ur.role = 'farmer_owner'  -- 'farmer_owner' is NOT in user_roles!
    ...
)
```

The function incorrectly joins the `user_roles` table (which stores global roles like `admin`, `merchant`) and looks for `'farmer_owner'` there. But `'farmer_owner'` is a farm-specific role stored in `farm_memberships.role_in_farm`.

## Solution

Replace the function to match the correct implementation already used by `is_farm_manager_only()`:

```sql
CREATE OR REPLACE FUNCTION public.is_farm_manager(_user_id uuid, _farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farm_memberships fm
    WHERE fm.farm_id = _farm_id 
      AND fm.user_id = _user_id 
      AND fm.role_in_farm = 'farmer_owner'
      AND fm.invitation_status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM public.farms f 
        WHERE f.id = _farm_id AND f.owner_id = _user_id
      )
  )
$$;
```

**Key changes:**
- Remove incorrect `JOIN public.user_roles`
- Check `fm.role_in_farm = 'farmer_owner'` instead of `ur.role`

## Impact

This fix will restore proper access for farm managers across 32+ RLS policies including:
- `pending_activities` - managers can view/approve submissions
- `animals` - managers can add/edit animals
- `milking_records`, `health_records`, `feeding_records`
- `heat_records`, `body_condition_scores`
- And more

## Implementation

A single database migration with the corrected function definition.

## Verification

After applying:
```sql
SELECT is_farm_manager(
  '9297ba26-7a0b-4109-b087-c655d19b44e3'::uuid, 
  '0ffc89c8-152d-42a3-a0f5-67cf772860cc'::uuid
);
-- Should return: true
```

