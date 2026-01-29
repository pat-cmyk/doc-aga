
# Plan: Add Date Range Filter and Fix Missing Action Buttons in Finance Tab

## Problem Analysis

### Issue 1: Missing Action Buttons
Looking at the current implementation:
- **Desktop**: `QuickActionsBar` is wrapped in `hidden md:block` (line 40 of FinanceTab.tsx)
- **Mobile**: `MobileQuickActions` is wrapped in a conditional `{canManage && ...}` (line 93)

The screenshot shows the Finance tab on what appears to be a desktop/tablet view without the action buttons visible. This suggests:
- The `canManage` prop might be `false` for the current user
- Or there's a breakpoint issue where the screen width falls between mobile and desktop states

The `canManage` value comes from `useUnifiedPermissions().canManageFarm` which checks if the user has farm management permissions.

### Issue 2: Missing Date Range Filter
All financial components currently hardcode date ranges:
- `FinancialHealthSummary`: Shows "This Month" only
- `RevenueExpenseComparison`: Hardcoded to current month/year
- `ProfitabilityThermometer`: Hardcoded to current month
- `ContextualInsights`: Derives from current month data

## Solution Overview

### Part 1: Fix Missing Action Buttons
1. Show QuickActionsBar on all screen sizes (not just desktop)
2. Ensure the Report button is always visible even when `canManage` is false
3. Add fallback visibility for essential actions

### Part 2: Add Date Range Filter
Create a unified date range picker at the top of the Finance tab that filters all child components.

## Implementation Details

### New File: `src/components/finance/FinanceDateRangePicker.tsx`
A reusable date range picker component with presets:
- "This Month" (default)
- "Last Month"
- "Last 3 Months"
- "Last 6 Months"
- "This Year"
- "Custom Range" (with calendar picker)

Uses the existing shadcn DatePicker pattern with:
- Two date inputs (start/end)
- Quick preset buttons
- Mobile-friendly design

### Modify: `src/components/FinanceTab.tsx`
1. Add state for `dateRange: { start: Date, end: Date }`
2. Add `FinanceDateRangePicker` component in the header
3. Pass `dateRange` to all child components
4. Fix QuickActionsBar visibility:
   - Always show Report button
   - Show Add Expense/Revenue only when `canManage` is true

### Modify: `src/components/finance/FinancialHealthSummary.tsx`
- Accept optional `dateRange` prop
- Update header from "Your Farm This Month" to show actual date range
- Pass date range to `useFinancialHealth` hook

### Modify: `src/hooks/useFinancialHealth.ts`
- Accept optional `startDate` and `endDate` parameters
- Use these instead of hardcoded `startOfMonth(now)` / `endOfMonth(now)`
- Recalculate comparison period based on the selected range length

### Modify: `src/components/finance/RevenueExpenseComparison.tsx`
- Accept optional `dateRange` prop
- Update "This Month" label to show actual date range

### Modify: `src/hooks/useRevenueExpenseComparison.ts`
- Accept optional date range parameters
- Filter data based on the provided range

### Modify: `src/components/finance/QuickActionsBar.tsx`
- Separate the Report button from the `canManage` conditional
- Report should always be visible
- Add/Edit actions still require `canManage`

### Modify: `src/components/finance/MobileQuickActions.tsx`
- Similar separation of Report button
- Ensure it's visible even without `canManage`

## Visual Layout

```text
+------------------------------------------+
|  Finance                    [Date Range v]|
|  Track your farm income...               |
|           +-- [Add Expense] [Add Revenue] [Report] -- (visible when canManage)
|           +-- [Report] -------------------- (always visible)
+------------------------------------------+
|  [This Month] [Last Month] [3M] [6M] [YTD] [Custom]  <- Quick presets
+------------------------------------------+
|  Your Farm: Jan 1 - Jan 31, 2026         |
|  +------+ +------+ +------+              |
|  |Earned| | Spent| | Net  |              |
|  +------+ +------+ +------+              |
+------------------------------------------+
```

## Technical Considerations

### Date Range State Management
- Store as `{ start: Date, end: Date }`
- Default to current month
- Persist selection in URL query params (optional, for bookmarking)

### Performance
- Use `useMemo` to prevent unnecessary recalculations
- Include date range in query keys for proper cache invalidation
- Format dates consistently as `yyyy-MM-dd` for database queries

### Mobile UX
- Collapsible preset bar on mobile
- Bottom sheet picker for custom date range
- Touch-friendly date inputs

## Files to Create
1. `src/components/finance/FinanceDateRangePicker.tsx`

## Files to Modify
1. `src/components/FinanceTab.tsx` - Add date state, date picker, pass props
2. `src/components/finance/FinancialHealthSummary.tsx` - Accept date range prop
3. `src/hooks/useFinancialHealth.ts` - Accept date range params
4. `src/components/finance/RevenueExpenseComparison.tsx` - Accept date range prop
5. `src/hooks/useRevenueExpenseComparison.ts` - Accept date range params
6. `src/components/finance/QuickActionsBar.tsx` - Fix Report visibility
7. `src/components/finance/MobileQuickActions.tsx` - Ensure visibility
8. `src/components/finance/ProfitabilityThermometer.tsx` - Accept date range
9. `src/hooks/useProfitability.ts` - Accept date range params
10. `src/components/finance/ContextualInsights.tsx` - Accept date range
11. `src/hooks/useContextualInsights.ts` - Accept date range params

## Testing Checklist
- [ ] Desktop: All action buttons visible for farm owners
- [ ] Desktop: Report button visible for read-only users
- [ ] Mobile: Bottom action bar appears correctly
- [ ] Date presets work correctly (This Month, Last Month, etc.)
- [ ] Custom date range selection works
- [ ] All charts update when date range changes
- [ ] Financial summary updates with correct period data
- [ ] Comparison percentages recalculate based on period length
