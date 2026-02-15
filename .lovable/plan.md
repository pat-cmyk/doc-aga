
# Fix: Force Horizontal Scrollbar on Admin Data Tables

## Root Cause (Third Time's the Charm)

The `table` element in the `Table` component has `w-full`, which means it always shrinks to fit its container. CSS tables naturally compress their columns to avoid overflow. So even with `overflow-auto` on the wrapper and `overflow-hidden` on the Card, the table just squeezes its columns until they're unreadable -- it never actually overflows.

**The fix**: Give each table a `min-width` so it cannot shrink below a readable size. Once the table is wider than the container, the existing `overflow-auto` wrapper in the Table component will produce a visible horizontal scrollbar.

## Changes

### 1. `src/components/admin/FarmOversight.tsx`
- Add `className="min-w-[1200px]"` to the `<Table>` component (11 columns, needs wide min-width)

### 2. `src/components/admin/UserManagement.tsx`
- Add `className="min-w-[1000px]"` to the `<Table>` component

### 3. `src/components/admin/MerchantOversight.tsx`
- Add `className="min-w-[800px]"` to the `<Table>` component (6 columns)

### 4. `src/components/admin/SupportTicketsTab.tsx`
- Add `className="min-w-[800px]"` to the `<Table>` component (6 columns)

### 5. `src/components/admin/UserActivityLogs.tsx`
- Add `className="min-w-[800px]"` to the `<Table>` component

### 6. `src/components/admin/DocAgaManagement.tsx`
- Add `className="min-w-[700px]"` to the Recent Queries table
- Add `className="min-w-[700px]"` to the FAQ Management table

## How It Works

```text
Container (Card with overflow-hidden)
  -> Table wrapper div (overflow-auto) -- built into Table component
    -> table (min-w-[1200px]) -- FORCES the table to be at least 1200px wide
       -> columns stay readable, scrollbar appears when viewport < 1200px
```

## No database changes, no new dependencies.
