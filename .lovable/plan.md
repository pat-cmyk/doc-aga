
# Fix: Farm Manager Cannot See Approvals Tab

## Problem Summary

`pat.ebuna@gmail.com` (farm manager for Estehanon Farm) cannot see the "For Approval" entries despite:
1. Having `role_in_farm: 'farmer_owner'` in the database
2. The `is_farm_manager()` SQL function now returning `true` correctly

The Approvals tab is completely hidden from their view.

## Root Cause

The Dashboard component uses `canManageFarm` from the wrong context:

**Current Code (Dashboard.tsx line 51):**
```typescript
const { farmId, farmName, farmLogoUrl, canManageFarm, ... } = useFarm();
```

**FarmContext.tsx (line 59) - WRONG:**
```typescript
setCanManageFarm(farmResult.data.owner_id === userResult.data.user?.id);
// Only checks if user is the OWNER, ignores managers!
```

**PermissionsContext.tsx (line 261) - CORRECT:**
```typescript
canManageFarm: isOwner || isManager || isAdmin,
// Correctly includes owners, managers, AND admins
```

## Impact

The Approvals tab is shown/hidden based on `canManageFarm`:
- Line 587: `{canManageFarm && <TabsTrigger value="approvals">...`
- Line 603: `{canManageFarm && <TabsContent value="approvals">...`

Since `FarmContext.canManageFarm` is `false` for managers, they cannot see:
- The Approvals tab
- The Settings tab
- Pending count badge

## Solution

Update Dashboard.tsx to use `canManageFarm` from `useUnifiedPermissions()` instead of `useFarm()`.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Import `useUnifiedPermissions` and use its `canManageFarm` instead of FarmContext's version |

## Implementation Details

**Step 1: Update imports in Dashboard.tsx**
```typescript
import { useUnifiedPermissions } from "@/contexts/PermissionsContext";
```

**Step 2: Get canManageFarm from PermissionsContext**
```typescript
// Current:
const { farmId, farmName, farmLogoUrl, canManageFarm, setFarmId, setFarmDetails } = useFarm();

// Changed to:
const { farmId, farmName, farmLogoUrl, setFarmId, setFarmDetails } = useFarm();
const { canManageFarm } = useUnifiedPermissions();
```

## Expected Result After Fix

| User | Before | After |
|------|--------|-------|
| Farm Owner | Can see Approvals tab | Can see Approvals tab |
| Farm Manager (`pat.ebuna`) | Cannot see Approvals tab | Can see Approvals tab |
| Farmhand | Cannot see Approvals tab | Cannot see Approvals tab |

## Testing

1. Log in as `pat.ebuna@gmail.com`
2. Navigate to Estehanon Farm dashboard
3. Go to "More" tab
4. Verify "Approvals" sub-tab is now visible
5. Verify pending farmhand entries are displayed
6. Test approve/reject functionality
