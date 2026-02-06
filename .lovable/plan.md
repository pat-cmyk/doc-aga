
# Add Definition Tooltips to Expected Deliveries Timeline

## Problem

The Expected Deliveries Timeline shows risk tier badges (Critical, High, Moderate) next to months, but these badges don't show definition pop-outs on hover like the other dashboard components. Users need to understand what these risk levels mean.

## Current State

Looking at `ExpectedDeliveriesTimeline.tsx` lines 213-220:
```tsx
{riskTier && riskTier.tier !== 'low' && (
  <Badge
    variant={riskTier.badgeVariant}
    className={`text-xs ${riskTier.textClass}`}
  >
    {riskTier.label}
  </Badge>
)}
```

The badge is rendered without any tooltip wrapper.

## Solution

Replace the plain `Badge` with `DefinitionBadge` (which includes tooltip functionality) using the PCRS tier definitions from `urgencyGlossary.ts`.

---

## Technical Changes

### File: `src/components/government/ExpectedDeliveriesTimeline.tsx`

**1. Update imports (line 5):**
Add import for `PCRS_TIERS`:
```tsx
import { getPCRSTier, PCRS_TIERS, type PCRSTier } from "@/lib/urgencyGlossary";
```

Add import for `DefinitionBadge`:
```tsx
import { DefinitionBadge } from "@/components/ui/definition-badge";
```

**2. Replace Badge with DefinitionBadge (lines 213-220):**

Before:
```tsx
{riskTier && riskTier.tier !== 'low' && (
  <Badge
    variant={riskTier.badgeVariant}
    className={`text-xs ${riskTier.textClass}`}
  >
    {riskTier.label}
  </Badge>
)}
```

After:
```tsx
{riskTier && riskTier.tier !== 'low' && (
  <DefinitionBadge
    label={riskTier.label}
    description={`${riskTier.description}. Score range: ${riskTier.minScore}-${riskTier.maxScore} points.`}
    variant={riskTier.badgeVariant}
    className={`text-xs ${riskTier.textClass}`}
  />
)}
```

---

## Tooltip Content

The PCRS tier definitions from `urgencyGlossary.ts` will be displayed:

| Tier | Description | Score Range |
|------|-------------|-------------|
| Critical | Immediate veterinary review required | 75-100 points |
| High | Priority monitoring, prep calving area | 50-74 points |
| Moderate | Standard close-up protocols | 25-49 points |
| Low | Routine monitoring | 0-24 points |

---

## Expected Result

Hovering over the "High" or "Critical" badges next to months (e.g., "February 2026") will display a tooltip explaining:
- What the risk level means
- The PCRS score range that triggers this tier

---

## Summary

| Metric | Value |
|--------|-------|
| Files modified | 1 (`ExpectedDeliveriesTimeline.tsx`) |
| Changes | 2 (imports + badge replacement) |
| Breaking changes | None |
| Testing | Hover over risk badges in Expected Deliveries Timeline |
