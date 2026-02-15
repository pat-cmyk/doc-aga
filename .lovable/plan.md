

# Admin Dashboard Overflow Assessment and Fix Plan

## Problems Found

### 1. Main Navigation Tabs (all views, critical on mobile)
The 5 main tabs (Dashboard, People, Operations, AI & Voice, System) use a `grid-cols-5` layout that squeezes on mobile, with text becoming truncated. No horizontal scroll is provided.

**Fix**: Wrap the `TabsList` in a horizontally scrollable container on mobile with `overflow-x-auto` and gradient fade indicators on the edges.

### 2. User Management Table (People > Users)
On mobile, only Name and Email columns are visible. Phone, Roles, Farms, Joined, and Actions columns are completely hidden with no way to access them - no horizontal scroll wrapper exists.

**Fix**: Wrap the `Table` in a `div` with `overflow-x-auto` so users can scroll horizontally to see all columns.

### 3. Farm Oversight Table (Operations > Farms)
Same issue - 11 columns (Farm Name, Owner, Email, Phone, Region, Animals, Team Members, Category, Status, Created, Actions) are cut off on mobile with no scroll.

**Fix**: Wrap the `Table` in a `div` with `overflow-x-auto`.

### 4. Merchant Oversight Table (Operations > Merchants)
6 columns with action buttons - same overflow issue on mobile.

**Fix**: Wrap the `Table` in a `div` with `overflow-x-auto`.

### 5. Support Tickets Table (Operations > Tickets)
6 columns - same overflow issue.

**Fix**: Wrap the `Table` in a `div` with `overflow-x-auto`.

### 6. User Activity Logs Table (People > Activity Logs)
6 columns including timestamps and descriptions - cut off on mobile.

**Fix**: Wrap the `Table` in a `div` with `overflow-x-auto`.

### 7. DocAga Management Sub-tabs (AI & Voice)
6 sub-tabs (Analytics, Feedback, FAQ Candidates, Recent Queries, FAQ Management, Voice STT) use `flex-wrap` which causes them to flow onto multiple lines. The "Voice STT" tab may be hidden below the fold.

**Fix**: Replace `flex-wrap` with `overflow-x-auto` and `flex-nowrap` for a horizontal scroll behavior, matching the pattern used elsewhere.

### 8. System Tab Sub-tabs
5 sub-tabs (Maintenance, Data Integrity, Sync Monitoring, QA & Tests, Configuration) also wrap onto two lines on mobile.

**Fix**: Add `overflow-x-auto` to the TabsList for horizontal scroll.

### 9. DocAga FAQ Management Table and Recent Queries Table
These inner tables within DocAga also lack horizontal scroll wrappers.

**Fix**: Wrap in `overflow-x-auto` containers.

## Technical Details

### Files to modify:

| File | Change |
|------|--------|
| `src/components/admin/AdminLayout.tsx` | Make main `TabsList` horizontally scrollable on mobile (replace `grid-cols-5` with flex + `overflow-x-auto`) |
| `src/components/admin/UserManagement.tsx` | Wrap `Table` in `overflow-x-auto` div |
| `src/components/admin/FarmOversight.tsx` | Wrap `Table` in `overflow-x-auto` div |
| `src/components/admin/MerchantOversight.tsx` | Wrap `Table` in `overflow-x-auto` div |
| `src/components/admin/SupportTicketsTab.tsx` | Wrap `Table` in `overflow-x-auto` div |
| `src/components/admin/UserActivityLogs.tsx` | Wrap `Table` in `overflow-x-auto` div |
| `src/components/admin/DocAgaManagement.tsx` | Make inner `TabsList` scrollable; wrap FAQ and query tables in `overflow-x-auto` |
| `src/components/admin/tabs/SystemTab.tsx` | Make `TabsList` horizontally scrollable |

### Pattern to apply for tables:
```text
<div className="overflow-x-auto">
  <Table>...</Table>
</div>
```

### Pattern to apply for tab lists:
```text
<TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
  ...tabs...
</TabsList>
```

### No database changes required.
### No new dependencies required.

