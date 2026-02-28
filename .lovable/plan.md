

# Fix: Shift Demo Feedback Dates Into Current Filter Range

## Problem
All 120 demo feedback records in the database have `created_at` dates ranging from **2025-08-01 to 2025-11-24**. The current dashboard filter ("Last 90 Days") covers **2025-11-30 to 2026-02-28**, so every demo record falls outside the window. The data category filter is working correctly -- there's simply no demo data within the selected date range.

## Solution
Run a database migration to shift all demo feedback `created_at` timestamps forward so they spread across the current 90-day window. This is a data-only change -- no code modifications needed.

### Migration Logic
- Calculate the offset: difference between the latest demo record (Nov 24, 2025) and today (Feb 28, 2026) = ~96 days
- Add this offset to every demo feedback record's `created_at`, so the newest lands near today and the rest distribute proportionally across the past ~4 months
- This ensures demo data is visible regardless of which date preset the user selects (Last 30, 60, 90 days, etc.)

### SQL Migration
```sql
UPDATE farmer_feedback
SET created_at = created_at + INTERVAL '96 days'
WHERE farm_id IN (
  SELECT id FROM farms WHERE data_category = 'demo'
);
```

### What This Affects
- **120 demo feedback records** get their dates shifted forward by ~96 days
- Original date range (Aug 1 - Nov 24, 2025) becomes (Nov 5, 2025 - Feb 28, 2026)
- Live/production data is untouched
- No code changes needed -- the hook, components, and filters all work correctly already

### Verification
- Switch to Demo on the Farmer Voice tab with "Last 90 Days" -- should now show feedback records
- Stats cards (Total, Pending, Critical, Last 7 Days) should populate
- Sentiment Trend chart (14-day window) should show recent demo activity
- Switch to Live -- should show only live data (unchanged)
- Switch to All -- should show both
