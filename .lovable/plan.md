

# Farm Oversight Table Optimization: Fit Within One Screen

## Current Problem

The table has **11 columns**: Farm Name, Owner, Email, Phone, Region, Animals, Team Members, Category, Status, Created, Actions. This forces horizontal scrolling on all viewports.

---

## Option A: Merge Owner/Email/Phone as Subtitles Under Farm Name (User's Suggestion)

**Layout:**
```text
| Farm & Owner Info              | Region   | Animals | Team | Category | Status | Created  | Actions |
|--------------------------------|----------|---------|------|----------|--------|----------|---------|
| SSG Cattle                     | IV-A     | 9 / 0   | 2    | Live v   | Active | 2/15/26  | ...     |
|   Rolando Giangan              |          |         |      |          |        |          |         |
|   rtgiangan@yahoo.com | N/A     |          |         |      |          |        |          |         |
```

**Pros:**
- Eliminates 3 columns (Owner, Email, Phone) -- down to 8 columns
- All contact info is contextually grouped under the farm it belongs to
- Matches common admin dashboard patterns (e.g., Shopify order lists)
- Farm name becomes the primary anchor for scanning

**Cons:**
- Rows become taller (3 lines per row vs 1-2), reducing visible farms per screen
- Cannot sort by Owner name, Email, or Phone independently
- Harder to visually scan a single field (e.g., "find all N/A phone numbers") since data is stacked
- Long emails + phone on the same subtitle line may still wrap on narrow screens

---

## Option B: Card-Based Layout (No Table)

Replace the table with responsive cards showing key info at a glance, with a "View Details" expansion.

**Pros:**
- Fully responsive -- no horizontal scroll at any viewport
- Can show summary stats prominently, hide secondary info behind expand/click
- Mobile-native feel

**Cons:**
- Loses the dense, scannable grid that admins expect for oversight
- Harder to compare farms side-by-side
- Significant UI rewrite

---

## Option C: Hybrid -- Merge Subtitles + Hide Low-Value Columns (Recommended)

Combine Option A (merge owner info) with hiding columns that have low information density:

1. **Merge** Owner, Email, Phone as subtitles under Farm Name (removes 3 columns)
2. **Remove "Created" column** -- available in the detail dialog, rarely needed in the list
3. **Remove "Team Members" column** -- low-value for oversight scanning, available in detail dialog
4. **Keep**: Farm Name (with subtitles), Region, Animals, Category, Status, Actions

**Result: 6 columns** -- fits comfortably on a 1024px+ screen without any horizontal scroll.

```text
| Farm & Owner                   | Region | Animals | Category | Status | Actions    |
|--------------------------------|--------|---------|----------|--------|------------|
| SSG Cattle                     | IV-A   | 9 / 0   | Live v   | Active | [icons]    |
|   Rolando Giangan              |        |         |          |        |            |
|   rtgiangan@yahoo.com          |        |         |          |        |            |
```

**Pros:**
- Only 6 columns -- no scroll needed even on tablet (768px)
- All critical oversight data visible: which farm, where, how many animals, live/demo, active/deactivated
- Contact details still visible inline for quick reference
- Detail dialog already exists for Created date, Team Members, etc.

**Cons:**
- Taller rows (mitigated by using smaller text for subtitles)
- Created date and Team count move to detail-only

---

## Recommendation: Option C (Hybrid)

This is the cleanest path: merge 3 contact columns into subtitles, drop 2 low-value columns, and remove the `minWidth` constraint entirely so the table flows naturally.

### Implementation Details

**File: `src/components/admin/FarmOversight.tsx`**

1. Remove `style={{ minWidth: '1400px' }}` from the Table element
2. Replace 3 column headers (Owner, Email, Phone) with single "Farm & Owner" header
3. Remove "Created" and "Team Members" column headers
4. In each TableRow:
   - First cell becomes a stacked layout:
     ```
     <div class="font-medium">SSG Cattle</div>
     <div class="text-xs text-muted-foreground">Rolando Giangan</div>
     <div class="text-xs text-muted-foreground truncate">rtgiangan@yahoo.com · N/A</div>
     ```
   - Remove the 3 old cells (Owner, Email, Phone)
   - Remove the Created and Team Members cells
5. Actions column: keep as-is (icon buttons are compact)

**No other files changed** -- this is a single-component refactor.

