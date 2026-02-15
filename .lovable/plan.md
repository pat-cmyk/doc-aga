

# Fix: Admin Dashboard Tables Not Scrolling on Mobile

## Root Cause

The `Table` UI component already includes its own `overflow-auto` wrapper div internally (in `src/components/ui/table.tsx`, line 7). However, the parent `Card` component has **no overflow constraint** — it simply grows to fit its content. This means:

1. The table expands to its natural width
2. The Card expands with it
3. The Card overflows the viewport, but no scrollbar appears because `overflow-auto` only works when the container has a bounded width

The extra `overflow-x-auto` wrapper divs added in the last edit are redundant because the Table component already has one built-in. The real fix is constraining the Card so the table's built-in scroll wrapper kicks in.

## Solution

Add `overflow-hidden` to each `Card` that contains a data table. This constrains the Card's width to its parent container, which in turn makes the Table's built-in `overflow-auto` wrapper produce a horizontal scrollbar.

Also remove the redundant outer `overflow-x-auto` wrapper divs since the Table component already handles scrolling internally.

## Files to Change

| File | Change |
|------|--------|
| `src/components/admin/FarmOversight.tsx` | Add `overflow-hidden` to Card; remove redundant `overflow-x-auto` div |
| `src/components/admin/UserManagement.tsx` | Add `overflow-hidden` to Card; remove redundant `overflow-x-auto` div |
| `src/components/admin/MerchantOversight.tsx` | Add `overflow-hidden` to Card; remove redundant `overflow-x-auto` div |
| `src/components/admin/SupportTicketsTab.tsx` | Add `overflow-hidden` to Card; remove redundant `overflow-x-auto` div |
| `src/components/admin/UserActivityLogs.tsx` | Add `overflow-hidden` to the border wrapper div |
| `src/components/admin/DocAgaManagement.tsx` | Add `overflow-hidden` to Cards with tables; remove redundant `overflow-x-auto` divs |

## Pattern

Before (not working):
```text
<Card>                          <!-- no width constraint, grows freely -->
  <CardContent>
    <div className="overflow-x-auto">   <!-- redundant -->
      <Table>                           <!-- has built-in overflow-auto wrapper -->
```

After (working):
```text
<Card className="overflow-hidden">    <!-- constrains width to parent -->
  <CardContent>
    <Table>                            <!-- built-in overflow-auto now activates -->
```

## No database changes, no new dependencies.

