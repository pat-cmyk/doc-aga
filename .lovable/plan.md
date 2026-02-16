

# Unify OVR Score Display into a Single SSOT Component

## Problem

The OVR score for the same animal is displayed using **three different approaches** across the app:
- **Animal List / Cards**: `OVRIndicator` -- a colored pill with score + trend arrow
- **BioCard**: `OVRBadge` -- a hexagon with score, tier label, trend, and a click-to-expand breakdown dialog
- **BioCardSummary**: Inline text "OVR 65" -- no component at all

These duplicate the `OVRTier` type, `OVRTrend` type, tier color definitions, tier labels, and trend icon logic across two separate files.

## Solution

Create a single **`OVRScore`** component in `src/components/ui/ovr-score.tsx` that serves as the SSOT for all OVR display, supporting multiple display variants through a `variant` prop.

### Variants

| Variant | Visual | Where Used |
|---------|--------|------------|
| `pill` | Compact colored pill (current OVRIndicator look) | Animal list, animal cards |
| `hexagon` | Hexagon badge with tier label (current OVRBadge look) | BioCard |
| `text` | Inline "OVR 65" text | BioCardSummary collapsed state |

### Shared SSOT Constants (defined once)
- `OVRTier` and `OVRTrend` types
- Tier color gradients (unified between pill and hexagon)
- Tier labels (English + Filipino)
- Trend icon mapping (TrendingUp / TrendingDown / Minus)

### Component Interface

```tsx
interface OVRScoreProps {
  score: number;
  tier: OVRTier;
  trend?: OVRTrend;
  variant?: 'pill' | 'hexagon' | 'text';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  // Only needed for hexagon variant's breakdown dialog
  breakdown?: OVRBreakdown;
  className?: string;
}
```

## SSOT Data Flow

```text
animal_ovr_cache (DB table)
       |
       v
useAnimalOVR / useBioCardData (hooks)
       |
       v
OVRScore component (NEW - single SSOT)
  variant="pill"     -> AnimalCard.tsx, AnimalList.tsx
  variant="hexagon"  -> BioCard.tsx
  variant="text"     -> BioCardSummary.tsx
```

## Changes (7 files)

### 1. CREATE: `src/components/ui/ovr-score.tsx`

Single component containing:
- All shared types (`OVRTier`, `OVRTrend`, `OVRBreakdown`) exported from one location
- Unified tier gradients, labels, trend icons
- Three render paths based on `variant` prop
- The hexagon variant includes the breakdown `Dialog` (moved from OVRBadge)

### 2. EDIT: `src/components/animal-list/AnimalCard.tsx`

- Replace `import { OVRIndicator }` with `import { OVRScore }` from `@/components/ui/ovr-score`
- Replace `<OVRIndicator score={} tier={} trend={} size="xs" />` with `<OVRScore score={} tier={} trend={} variant="pill" size="xs" />`
- Same for the desktop variant (size="sm")

### 3. EDIT: `src/components/AnimalList.tsx`

- Replace `import { OVRIndicator }` with `import { OVRScore }`
- Replace `<OVRIndicator ... size="sm" />` with `<OVRScore ... variant="pill" size="sm" />`

### 4. EDIT: `src/components/bio-card/BioCard.tsx`

- Replace `import { OVRBadge }` with `import { OVRScore }`
- Replace `<OVRBadge score={} tier={} trend={} breakdown={} size="md" />` with `<OVRScore score={} tier={} trend={} breakdown={} variant="hexagon" size="md" />`

### 5. EDIT: `src/components/animal-details/BioCardSummary.tsx`

- Import `OVRScore` and replace inline `OVR {bioData.ovr.score}` text with `<OVRScore score={bioData.ovr.score} tier={bioData.ovr.tier} trend={bioData.ovr.trend} variant="text" />`

### 6. DELETE (contents only): Old files become re-exports

- `src/components/animal-list/OVRIndicator.tsx` -- re-export from `@/components/ui/ovr-score` for backward compatibility (any external imports won't break)
- `src/components/bio-card/OVRBadge.tsx` -- re-export from `@/components/ui/ovr-score`

### 7. EDIT: `docs/data-relationships-map.md`

- Add `OVRScore` to the component reuse inventory
- Note that `OVRIndicator` and `OVRBadge` are deprecated re-exports

## What This Does NOT Change

- No database changes
- No hook changes (data fetching stays the same)
- No visual changes -- each variant renders identically to the current component it replaces
- The breakdown dialog behavior stays the same (only on hexagon variant tap)

