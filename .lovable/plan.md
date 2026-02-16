
# Data Entry Analytics Dashboard (Voice vs. Typed + Location Filters)

## The Problem

Currently, **none of the core record tables** (`feeding_records`, `milking_records`, `weight_records`, `health_records`, `injection_records`) track whether an entry was made via **voice** or **typed** input. The `pending_activities` table also does not store this metadata. This means we have zero visibility into how farmers are using each input method.

## What Changes

### Phase 1: Schema -- Add `input_method` Column

Add an `input_method` column (text, default `'typed'`) to these tables:
- `feeding_records`
- `milking_records`
- `weight_records`
- `health_records`
- `injection_records`
- `pending_activities`

This is a non-breaking change -- existing records default to `'typed'`, and new voice entries will be tagged `'voice'`.

### Phase 2: Tag Voice Entries at Source

Update the two code paths that create records:

1. **Voice path** (`ActivityConfirmation.tsx`): When `data` originates from voice parsing, include `input_method: 'voice'` in the `activity_data` JSON and in direct inserts.
2. **Typed path** (manual forms like `RecordSingleFeedDialog`, `RecordMilkingDialog`, etc.): These already default to `'typed'` via the column default -- no code change needed.
3. **Approval processor** (`usePendingActivities.ts`): When approving a pending activity and inserting the final record, carry forward the `input_method` from the activity data.

### Phase 3: Admin Analytics RPC

Create a database function `get_data_entry_analytics` that returns:
- **Summary**: Total entries, voice count, typed count, voice adoption % -- filterable by date range, data category, region, province, municipality
- **Daily breakdown**: Voice vs. typed counts per day for trend charting
- **By activity type**: Breakdown per record type (feeding, milking, weight, health, injection)
- **By location**: Aggregated by region/province showing voice adoption rates
- **Top voice users**: Farmers with highest voice usage (for adoption tracking)

### Phase 4: Admin Dashboard UI

Add a new subtab **"Entry Methods"** inside the existing **Operations** tab (alongside Farms, Merchants, Support Tickets). This keeps it contextually grouped with operational oversight.

The dashboard will include:

**Filters Bar:**
- Date range (7d / 30d / 90d)
- Data category (inherits from global toggle)
- Region dropdown (from Philippine locations)
- Province dropdown (cascading)
- Municipality dropdown (cascading)
- Export CSV button

**Summary Cards (top row):**
- Total Entries
- Voice Entries (count + %)
- Typed Entries (count + %)
- Voice Adoption Trend (up/down arrow)

**Charts:**
- Line chart: Daily Voice vs. Typed volume over time
- Bar chart: Voice adoption % by activity type (feeding, milking, etc.)
- Horizontal bar chart: Voice adoption % by region (top 10)

**Table:**
- Location-level breakdown with columns: Region, Province, Total, Voice, Typed, Voice %

## Technical Details

### Migration SQL

```sql
-- Add input_method to core tables
ALTER TABLE feeding_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE milking_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE weight_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE health_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE injection_records ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
ALTER TABLE pending_activities ADD COLUMN input_method text NOT NULL DEFAULT 'typed';
```

### Files to Create
- `src/components/admin/DataEntryAnalytics.tsx` -- Main dashboard component
- `src/hooks/useDataEntryAnalytics.ts` -- Hook calling the RPC

### Files to Modify
- `src/components/farmhand/ActivityConfirmation.tsx` -- Tag voice entries with `input_method: 'voice'`
- `src/hooks/usePendingActivities.ts` -- Carry `input_method` through approval flow
- `src/components/admin/tabs/OperationsTab.tsx` -- Add "Entry Methods" subtab
- `src/components/feed-recording/RecordSingleFeedDialog.tsx` -- Pass `input_method: 'typed'` explicitly (safety)
- Any direct record insertion points that originate from voice flow

### Data Flow (SSOT)

```
Voice Input → ActivityConfirmation (input_method: 'voice') → pending_activities → approval → feeding_records/milking_records (input_method carried)
Typed Input → Manual Forms (input_method: 'typed' default) → direct insert → feeding_records/milking_records
Admin RPC → JOIN records with farms (region/province) → aggregate by input_method → Dashboard
```

### Existing Patterns Followed
- Uses `useLocationFilters` hook for cascading region/province/municipality dropdowns
- Follows `STTAnalyticsDashboard.tsx` pattern for date range selector, summary cards, charts, and CSV export
- Inherits `dataCategory` from the global admin toggle
- Uses recharts for visualization (already installed)
