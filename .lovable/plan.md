
# Tooltip Definitions for Government Dashboard Legends

## Overview

Add mouse-over tooltip definitions to all priority/severity legend badges across the government dashboard. When users hover over terms like "Critical", "High", "Medium", or "Low", they will see a popout explaining what each term means based on the context.

---

## Implementation Approach

### 1. Add Missing Definitions to Urgency Glossary

The `src/lib/urgencyGlossary.ts` already contains definitions for health severity but is missing explicit **Feedback Priority** definitions. These need to be added:

**New constant: `FEEDBACK_PRIORITY_URGENCY`**

| Priority | Description | Criteria |
|----------|-------------|----------|
| **Critical** | Requires immediate escalation | Disease outbreak, animal death, or system-wide issue affecting multiple farms |
| **High** | Needs attention within 24 hours | Feed shortage, veterinary emergency, or time-sensitive concern |
| **Medium** | Standard response time | General inquiry, program feedback, or non-urgent request |
| **Low** | Informational only | Positive feedback, suggestions, or general observations |

---

### 2. Create Reusable `DefinitionBadge` Component

Create a new component `src/components/ui/definition-badge.tsx` that wraps a Badge with a Tooltip:

```text
DefinitionBadge Component
├── Props:
│   ├── label: string (e.g., "Critical")
│   ├── description: string (e.g., "Requires immediate escalation...")
│   ├── variant: BadgeVariant
│   └── className?: string
├── Behavior:
│   └── On hover → Shows tooltip with description
└── Uses:
    └── TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Badge
```

---

### 3. Create Context-Aware Legend Components

Create a reusable `PriorityLegend` component that automatically includes the correct definitions based on context type:

```text
src/components/government/PriorityLegend.tsx

Props:
├── type: 'feedback' | 'health' | 'feed' | 'breeding' | 'veterinary_cost'
└── showLabel?: boolean (default: true)

Behavior:
├── Looks up definitions from urgencyGlossary.ts based on type
└── Renders DefinitionBadge for each priority level
```

---

### 4. Update Components with Tooltip Legends

| Component | Legend Type | Definitions Source |
|-----------|-------------|-------------------|
| `FeedbackGeoHeatmap.tsx` | Feedback Priority | `FEEDBACK_PRIORITY_URGENCY` |
| `AnimalHealthHeatmap.tsx` | Health Severity | `HEALTH_STATUS_SEVERITY` |
| `VeterinaryExpenseHeatmap.tsx` | Cost Level | Custom (low/moderate/high/critical) |
| `FeedbackPriorityQueue.tsx` | Feedback Priority | `FEEDBACK_PRIORITY_URGENCY` |
| `FeedbackClusterView.tsx` | Feedback Priority | `FEEDBACK_PRIORITY_URGENCY` |

---

## File Changes

| File | Action |
|------|--------|
| `src/lib/urgencyGlossary.ts` | Add `FEEDBACK_PRIORITY_URGENCY` constant |
| `src/components/ui/definition-badge.tsx` | **Create** - Reusable Badge with tooltip |
| `src/components/government/PriorityLegend.tsx` | **Create** - Context-aware legend component |
| `src/components/government/FeedbackGeoHeatmap.tsx` | Replace static badges with `PriorityLegend` |
| `src/components/government/AnimalHealthHeatmap.tsx` | Add severity legend with tooltips |
| `src/components/government/VeterinaryExpenseHeatmap.tsx` | Add tooltips to existing legend |
| `src/components/government/FeedbackPriorityQueue.tsx` | Add legend if not present |

---

## Technical Details

### `DefinitionBadge` Component Structure

```typescript
interface DefinitionBadgeProps {
  label: string;
  description: string;
  variant?: "default" | "destructive" | "outline" | "secondary";
  className?: string;
}

export const DefinitionBadge = ({ 
  label, 
  description, 
  variant = "default", 
  className 
}: DefinitionBadgeProps) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className={cn("cursor-help", className)}>
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
```

### `FEEDBACK_PRIORITY_URGENCY` Definition

```typescript
export const FEEDBACK_PRIORITY_URGENCY: Record<string, UrgencyDefinition> = {
  critical: {
    level: 'critical',
    label: 'Critical',
    labelTagalog: 'Kritikal',
    description: 'Disease outbreak, animal death, or system-wide issue affecting multiple farms. Requires immediate escalation.',
    descriptionTagalog: 'Outbreak ng sakit, pagkamatay ng hayop, o malawakang problema. Kailangan ng agarang aksyon.',
    threshold: 'priority = critical',
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  high: {
    level: 'high',
    label: 'High',
    labelTagalog: 'Mataas',
    description: 'Feed shortage, veterinary emergency, or time-sensitive concern. Needs attention within 24 hours.',
    descriptionTagalog: 'Kakulangan ng feeds, emergency sa beterinaryo, o madaliang alalahanin. Kailangan ng atensiyon sa loob ng 24 oras.',
    threshold: 'priority = high',
    textClass: 'text-orange-600',
    bgClass: 'bg-orange-50',
  },
  medium: {
    level: 'medium',
    label: 'Medium',
    labelTagalog: 'Katamtaman',
    description: 'General inquiry, program feedback, or non-urgent request. Standard response time.',
    descriptionTagalog: 'General na tanong, feedback sa programa, o hindi madaliang kahilingan.',
    threshold: 'priority = medium',
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
  },
  low: {
    level: 'low',
    label: 'Low',
    labelTagalog: 'Mababa',
    description: 'Positive feedback, suggestions, or general observations. Informational only.',
    descriptionTagalog: 'Positibong feedback, suhestiyon, o pangkalahatang obserbasyon.',
    threshold: 'priority = low',
    textClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
  },
};
```

---

## User Experience

**Before:**
- User sees "Critical" badge with no context
- Must guess what "Critical" means in this dashboard

**After:**
- User hovers over "Critical" badge
- Sees: *"Disease outbreak, animal death, or system-wide issue affecting multiple farms. Requires immediate escalation."*
- Intuitive understanding without leaving the page

---

## SSOT Compliance

- All definitions come from `urgencyGlossary.ts` (Single Source of Truth)
- Same definitions are available for RICO AI to use via `getUrgencyGlossaryForPrompt()`
- Bilingual support (English + Tagalog) maintained
- Components import definitions rather than hardcoding strings

---

## Summary

| Metric | Value |
|--------|-------|
| New components | 2 (`DefinitionBadge`, `PriorityLegend`) |
| Modified components | 5-6 government dashboard components |
| New glossary entries | `FEEDBACK_PRIORITY_URGENCY` |
| Breaking changes | None |
