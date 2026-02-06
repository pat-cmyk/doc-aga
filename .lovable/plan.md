
# Fix Color Alignment in Animal Health Heatmap

## Problem

The "High" and "Moderate" severity badges in the heatmap list items use green (default variant) and gray (secondary variant) colors respectively, while the PriorityLegend shows them as orange and yellow.

## Root Cause

The `getSeverityLevel` function in `AnimalHealthHeatmap.tsx` returns standard Badge variants:
```typescript
if (rate >= 10) return { label: "High", variant: "default" as const };     // Renders GREEN
if (rate >= 5) return { label: "Moderate", variant: "secondary" as const }; // Renders GRAY
```

But PriorityLegend uses custom class overrides:
```typescript
{ key: "high", badgeClass: "bg-orange-500 hover:bg-orange-500/80" }        // ORANGE
{ key: "moderate", badgeClass: "bg-yellow-500 hover:bg-yellow-500/80" }    // YELLOW
```

## Solution

Update the `getSeverityLevel` function to return custom className strings that match the PriorityLegend colors, then apply those classes to the Badge components.

---

## Technical Changes

### File: `src/components/government/AnimalHealthHeatmap.tsx`

**1. Update `getSeverityLevel` function (lines 147-152):**

```typescript
const getSeverityLevel = (rate: number) => {
  if (rate >= 20) return { 
    label: "Critical", 
    variant: "destructive" as const,
    badgeClass: ""
  };
  if (rate >= 10) return { 
    label: "High", 
    variant: "default" as const,
    badgeClass: "bg-orange-500 hover:bg-orange-500/80 text-white border-orange-500"
  };
  if (rate >= 5) return { 
    label: "Moderate", 
    variant: "default" as const,
    badgeClass: "bg-yellow-500 hover:bg-yellow-500/80 text-primary-foreground border-yellow-500"
  };
  return { 
    label: "Low", 
    variant: "default" as const,
    badgeClass: "bg-green-500 hover:bg-green-500/80 text-white border-green-500"
  };
};
```

**2. Update Badge usages to include badgeClass:**

All instances where `<Badge variant={severity.variant}>` is used need to add the className:

```tsx
<Badge 
  variant={severity.variant} 
  className={`w-fit ${severity.badgeClass}`}
>
  {severity.label}
</Badge>
```

Locations to update:
- Line 186-188 (comparison mode - primary section)
- Line 232-234 (comparison mode - comparison section)
- Line 277-279 (main list view)

---

## Color Alignment Summary

| Level | Legend Color | Heatmap Badge (After Fix) |
|-------|--------------|---------------------------|
| Critical | Red (`destructive`) | Red (`destructive`) |
| High | Orange (`bg-orange-500`) | Orange (`bg-orange-500`) |
| Moderate | Yellow (`bg-yellow-500`) | Yellow (`bg-yellow-500`) |
| Low | Green (`bg-green-500`) | Green (`bg-green-500`) |

---

## Summary

| Metric | Value |
|--------|-------|
| Files modified | 1 (`AnimalHealthHeatmap.tsx`) |
| Changes | 4 (1 function update + 3 Badge className updates) |
| Breaking changes | None |
| Visual impact | Badge colors now match legend colors exactly |
