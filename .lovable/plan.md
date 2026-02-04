
# Plan: Move Backdating Control to Admin Dashboard (Lenient Mode)

## Confirmed Behavior

When the **"Enforce backdating limit" toggle is OFF**:
- ✅ All farmers can enter records from any past date (no restriction)
- ✅ This is the lenient mode for initial user acquisition

When the **"Enforce backdating limit" toggle is ON**:
- ✅ Farmers can only backdate up to the selected number of days (7/30/60/90/180/365)

---

## Current Architecture

| Component | Current Behavior |
|-----------|------------------|
| `farms.max_backdate_days` | Per-farm setting (7-30 days) |
| Profile page | Farm owners can change their own limit |
| Recording dialogs | Use `useFarm().maxBackdateDays` |
| Edge function | Uses 7-day default |

## Target Architecture

| Component | New Behavior |
|-----------|--------------|
| `platform_settings` table | Global platform-level settings |
| Admin Dashboard → System → Configuration | Toggle on/off + limit selection |
| Recording dialogs | Read from platform settings via context |
| Edge function | Fetch platform setting; if disabled, skip date validation |

---

## Database Changes

### New Table: `platform_settings`

```sql
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default: enforcement OFF during acquisition phase
INSERT INTO platform_settings (setting_key, setting_value)
VALUES ('backdating', '{"enabled": false, "max_days": 7}'::jsonb);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE platform_settings;
```

### RLS Policies

- **SELECT**: Allow all authenticated users (read-only for app consumption)
- **UPDATE**: Allow only super admins via `is_super_admin()` function

---

## Files to Modify

### 1. New Hook: `src/hooks/usePlatformSettings.ts`

Create a hook to:
- Query `platform_settings` table for the `backdating` key
- Return `{ backdatingEnabled: boolean, maxBackdateDays: number | null }`
- Provide mutation hook for admin updates
- Cache for 5 minutes to reduce database calls

### 2. Update: `src/contexts/FarmContext.tsx`

- Import and use `usePlatformSettings` hook
- Replace per-farm `maxBackdateDays` with platform-wide value
- When `backdatingEnabled` is false, return a very large number (36500 = ~100 years) to effectively disable restriction
- Remove fetching `max_backdate_days` from farms table

### 3. Update: `src/components/admin/tabs/SystemTab.tsx`

Replace static `ConfigurationPanel` with interactive `PlatformSettingsPanel`:

- **Toggle Switch**: "Enforce backdating limit" (ON/OFF)
- **Dropdown**: Days selection (7, 30, 60, 90, 180, 365) - only shown when toggle is ON
- **Status indicator**: Shows current state clearly

```text
┌─────────────────────────────────────────────────────┐
│ Platform Settings                                    │
│ Control platform-wide behavior and restrictions      │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Record Backdating Limit                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [Toggle OFF]  Enforce backdating limit          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ When disabled, farmers can enter records for any    │
│ past date. Enable this to restrict backdating.      │
│                                                      │
│ Status: 🔵 Disabled - No limit (acquisition mode)   │
│         OR                                           │
│ Status: 🟢 Enabled - 7 days maximum                 │
└─────────────────────────────────────────────────────┘
```

### 4. Update: `src/pages/Profile.tsx`

- Remove `<RecordBackdatingSettings farmId={farmId} />` component usage (line 415)
- Remove the `RecordBackdatingSettings` function definition (lines 539-592)
- Remove unused imports: `useFarmSettings`, `useUpdateFarmSettings`

### 5. Update: `supabase/functions/process-farmhand-activity/index.ts`

Modify the date validation logic:

```typescript
// Fetch platform setting
const { data: settings } = await supabase
  .from('platform_settings')
  .select('setting_value')
  .eq('setting_key', 'backdating')
  .single();

const backdatingEnabled = settings?.setting_value?.enabled ?? false;
const maxDays = settings?.setting_value?.max_days ?? 7;

// In parseAndValidateDate call:
if (data.date_reference) {
  if (backdatingEnabled) {
    // Enforce limit
    const dateValidation = parseAndValidateDate(data.date_reference, maxDays);
    if (!dateValidation.isValid) {
      // Return error...
    }
  } else {
    // No enforcement - just parse the date without limit check
    const dateValidation = parseAndValidateDate(data.date_reference, 36500);
  }
}
```

### 6. Cleanup: `src/hooks/useFarmSettings.ts`

Keep file but remove the `maxBackdateDays` logic (may be used for other farm settings in future).

---

## Data Flow After Implementation

```text
1. Admin toggles setting in Dashboard → System → Configuration
   ↓
2. platform_settings table updated
   ↓
3. usePlatformSettings hook returns { enabled: false, maxDays: 7 }
   ↓
4. FarmContext provides maxBackdateDays: 36500 (effectively unlimited)
   ↓
5. Recording dialogs show full calendar (no date restrictions)
   ↓
6. Edge function skips backdating validation for voice submissions
```

---

## Summary of Changes

| File | Action |
|------|--------|
| Database | Add `platform_settings` table with RLS |
| `src/hooks/usePlatformSettings.ts` | **NEW** - Query/mutate platform settings |
| `src/contexts/FarmContext.tsx` | Update to use platform settings |
| `src/components/admin/tabs/SystemTab.tsx` | Replace static panel with interactive controls |
| `src/pages/Profile.tsx` | Remove backdating settings section |
| `supabase/functions/process-farmhand-activity/index.ts` | Fetch platform setting, conditionally skip validation |

---

## Testing Checklist

- [ ] Admin can toggle backdating enforcement on/off
- [ ] When OFF: farmers can select any past date in calendars
- [ ] When ON: farmers see date limit enforced
- [ ] Admin can select limit from 7/30/60/90/180/365 days
- [ ] Voice submissions respect the platform setting
- [ ] Setting persists across sessions
- [ ] Non-admin users cannot see/modify the setting
- [ ] Profile page no longer shows backdating option
