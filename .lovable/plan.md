
# Fix: QR Code Farm Join Flow Stuck in Loading State

## Problem Analysis

When users scan the QR code to join a farm, the UI gets stuck showing "Loading profile..." or "joining farm..." even though the invitation was successfully accepted.

**Root Cause Identified:**

The `FarmhandDashboard.tsx` page ignores the `farmId` already set in `FarmContext` by `InviteAccept.tsx` and re-queries the database for `farm_memberships`. This creates two issues:

1. **Race Condition**: The navigation happens immediately after the RPC call, but `FarmhandDashboard` queries the database before the transaction is fully visible (eventual consistency)
2. **Unnecessary Re-query**: Even when `farmId` is already set via context, the dashboard overwrites it with its own database query that uses `.single()` which throws an error if no rows found

### Current Flow (Broken):
```
InviteAccept → setFarmId(result.farm_id) → navigate("/farmhand")
                                                    ↓
                                         FarmhandDashboard loads
                                                    ↓
                               Ignores FarmContext, queries farm_memberships
                                                    ↓
                             Query may fail (timing) or find no "accepted" membership
                                                    ↓
                                         Shows "No Farm Assigned" 
                                             or stuck loading
```

### Fixed Flow:
```
InviteAccept → setFarmId(result.farm_id) → navigate("/farmhand")
                                                    ↓
                                         FarmhandDashboard loads
                                                    ↓
                             Checks: Is farmId already set in context?
                                          ↓ YES               ↓ NO
                               Trust it, skip query    Query farm_memberships
                                          ↓
                                   Show dashboard
```

---

## Solution

### File 1: `src/pages/FarmhandDashboard.tsx`

**Changes Required:**

1. **Trust FarmContext when farmId is already set** (lines 75-130)
   - If `farmId` is already present in context, skip the database query
   - Only query `farm_memberships` if context is empty

2. **Add error handling for the `.single()` query** (line 102)
   - Use `.maybeSingle()` instead of `.single()` to prevent throwing errors when no row found

**Updated `initializeUser` function:**

```typescript
useEffect(() => {
  const initializeUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }
    
    setUser(session.user);
    
    // SSOT: If farmId is already set in context (e.g., from InviteAccept), trust it
    if (farmId) {
      console.log('[FarmhandDashboard] Using farmId from context:', farmId);
      setLoading(false);
      return;
    }
    
    // Only query database if no farmId in context
    const { data: membership, error: membershipError } = await supabase
      .from("farm_memberships")
      .select(`
        farm_id,
        role_in_farm,
        farms!inner (
          id,
          name,
          owner_id
        )
      `)
      .eq("user_id", session.user.id)
      .eq("invitation_status", "accepted")
      .limit(1)
      .maybeSingle();  // Changed from .single() to prevent errors
    
    if (membershipError) {
      console.error('[FarmhandDashboard] Membership query error:', membershipError);
      setLoading(false);
      return;
    }
    
    if (!membership) {
      // User has no farm membership - show no farm assigned state
      setLoading(false);
      return;
    }
    
    const farm = membership.farms as unknown as { id: string; name: string; owner_id: string };
    const isOwner = farm.owner_id === session.user.id;
    const isFarmOwnerRole = membership.role_in_farm === 'farmer_owner';
    
    // If user owns the farm or has farmer_owner role, redirect to main dashboard
    if (isOwner || isFarmOwnerRole) {
      navigate("/");
      return;
    }
    
    // Only farmhand role should access this dashboard
    if (membership.role_in_farm !== 'farmhand') {
      navigate("/");
      return;
    }
    
    setFarmId(membership.farm_id);
    setLoading(false);
  };

  initializeUser();
  // ... rest of useEffect
}, [navigate, toast, farmId]);  // Add farmId to dependencies
```

---

### File 2: `src/pages/Dashboard.tsx`

**Similar changes required** (lines 82-200):

1. **Trust FarmContext when farmId is already set**
   - Skip re-querying owned/member farms if context already has a valid farmId

```typescript
// Inside initializeUser, after role-based redirects:

// SSOT: If farmId is already set in context (e.g., from InviteAccept), trust it
if (farmId) {
  console.log('[Dashboard] Using farmId from context:', farmId);
  setLoading(false);
  return;
}

// Only query database if no farmId in context
// ... existing parallel queries for owned/member farms
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/FarmhandDashboard.tsx` | Trust context farmId, use `.maybeSingle()`, add farmId to useEffect deps |
| `src/pages/Dashboard.tsx` | Trust context farmId, skip re-query when already set |

---

## Expected Behavior After Fix

| Scenario | Before (Bug) | After (Fixed) |
|----------|-------------|---------------|
| Farmhand scans QR, accepts invitation | Stuck loading or "No Farm Assigned" | Immediately shows farmhand dashboard |
| Owner scans QR, accepts invitation | May get stuck | Immediately shows main dashboard |
| User refreshes page after joining | Works (membership visible in DB) | Works (same behavior) |
| User visits dashboard without context | Queries DB for farm | Queries DB for farm (same) |

---

## Testing Scenarios

1. **New farmhand accepts invitation via QR**
   - Should navigate to `/farmhand` immediately
   - Should show farmhand dashboard with correct farm

2. **New farmer_owner accepts invitation via QR**
   - Should navigate to `/` immediately
   - Should show main dashboard with correct farm

3. **Existing user refreshes `/farmhand` page**
   - farmId is loaded from localStorage
   - Should show dashboard (no change in behavior)

4. **User with no farm visits `/farmhand` directly**
   - Should show "No Farm Assigned" (no change in behavior)
