

# Farm Switcher on Profile Page - SSOT Implementation Plan

## Problem Analysis

The Profile page currently maintains its own local state for farm information, which violates the Single Source of Truth (SSOT) principle established in your architecture:

**Current Issue in `Profile.tsx`:**
- Lines 41-42: `const [farmId, setFarmId] = useState<string | null>(null);` and `const [farmData, setFarmData] = useState<any>(null);`
- Lines 76-117: Custom `loadFarmData()` function that duplicates logic from FarmContext
- This creates data inconsistency when users switch farms in other parts of the app

**Existing SSOT Pattern:**
- `FarmContext.tsx` already provides global farm state with localStorage persistence
- `Dashboard.tsx` correctly uses `useFarm()` hook for shared state
- `FarmSwitcher.tsx` component already exists and handles multi-farm switching

---

## Solution Overview

Refactor the Profile page to use the global FarmContext and add a FarmSwitcher dropdown for users with multiple farm associations.

---

## Implementation Details

### File 1: `src/pages/Profile.tsx`

**Changes Required:**

1. **Import useFarm hook** (add to existing imports)
   ```typescript
   import { useFarm } from "@/contexts/FarmContext";
   import { FarmSwitcher } from "@/components/FarmSwitcher";
   ```

2. **Replace local state with context** (remove lines 41-42)
   - Remove: `const [farmId, setFarmId] = useState<string | null>(null);`
   - Remove: `const [farmData, setFarmData] = useState<any>(null);`
   - Add: `const { farmId, farmName, farmLogoUrl, canManageFarm, setFarmId, setFarmDetails } = useFarm();`

3. **Remove the duplicate `loadFarmData` useEffect** (lines 76-117)
   - This logic is already handled by FarmContext when `farmId` changes
   - Keep a simplified effect to fetch additional farm details (like region, livestock_type) that aren't in FarmContext

4. **Add new state for extended farm details** (only fields not in FarmContext)
   ```typescript
   const [extendedFarmData, setExtendedFarmData] = useState<{
     region?: string;
     livestock_type?: string;
     biosecurity_level?: string;
     water_source?: string;
     distance_to_market_km?: number;
     pcic_enrolled?: boolean;
   } | null>(null);
   ```

5. **Add simplified useEffect to fetch extended farm data**
   ```typescript
   useEffect(() => {
     const loadExtendedFarmData = async () => {
       if (!farmId) {
         setExtendedFarmData(null);
         return;
       }
       const { data } = await supabase
         .from("farms")
         .select("region, livestock_type, biosecurity_level, water_source, distance_to_market_km, pcic_enrolled")
         .eq("id", farmId)
         .single();
       if (data) setExtendedFarmData(data);
     };
     loadExtendedFarmData();
   }, [farmId]);
   ```

6. **Add Farm Switcher to Profile Header Card**
   ```typescript
   <Card>
     <CardHeader className="text-center">
       {/* Existing Avatar code */}
       <CardTitle className="text-2xl">{profile?.full_name || "User Profile"}</CardTitle>
       
       {/* NEW: Farm Switcher Section */}
       <div className="flex items-center justify-center gap-2 mt-2">
         {farmName && (
           <Badge variant="outline" className="gap-1">
             <Building2 className="h-3 w-3" />
             {farmName}
           </Badge>
         )}
         <FarmSwitcher 
           currentFarmId={farmId} 
           onFarmChange={handleFarmChange} 
         />
       </div>
       
       {/* Existing roles display */}
     </CardHeader>
   </Card>
   ```

7. **Add handleFarmChange function** (similar to Dashboard.tsx pattern)
   ```typescript
   const handleFarmChange = async (newFarmId: string) => {
     setFarmId(newFarmId);
     
     // FarmContext will automatically fetch name, logo, canManage
     // We only need to fetch extended data
     const { data } = await supabase
       .from("farms")
       .select("region, livestock_type, biosecurity_level, water_source, distance_to_market_km, pcic_enrolled")
       .eq("id", newFarmId)
       .single();
     
     if (data) setExtendedFarmData(data);
   };
   ```

8. **Update Farm Settings section references**
   - Replace `farmData?.logo_url` with `farmLogoUrl`
   - Replace `farmData?.name` with `farmName`
   - Replace `farmData?.region` with `extendedFarmData?.region`
   - Replace `farmData?.livestock_type` with `extendedFarmData?.livestock_type`
   - Update FarmLogoUpload's `onUploadSuccess` to also update FarmContext

---

## Data Flow After Changes

```text
User clicks FarmSwitcher dropdown
         |
         v
handleFarmChange(newFarmId)
         |
    +----+----+
    |         |
    v         v
setFarmId()   Fetch extended
(FarmContext) farm data
    |         |
    v         v
FarmContext   setExtendedFarmData()
auto-fetches  (local state for
name, logo,   region, livestock, etc.)
canManage
    |
    v
All components using useFarm()
automatically update (SSOT)
```

---

## UI Preview

The Profile Header Card will show:
1. User avatar and name (existing)
2. Current farm name badge with Building2 icon (new)
3. Farm switcher dropdown - only visible when user has multiple farms (new)
4. User roles badges (existing)

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/Profile.tsx` | Use FarmContext instead of local state, add FarmSwitcher, refactor farm data loading |

---

## Testing Checklist

- [ ] User with single farm: FarmSwitcher hidden, farm name shown
- [ ] User with multiple farms: FarmSwitcher visible, can switch farms
- [ ] Farm switch updates: Farm Settings section, Team Management, Logo upload
- [ ] Farm switch persists: Navigating away and back maintains selected farm
- [ ] Logout clears farm: FarmContext is cleared on sign out

