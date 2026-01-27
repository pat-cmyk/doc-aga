

# Phase 4: Breeding Analytics & Reporting - Implementation Plan

## Overview

This phase adds farm-level breeding analytics to complement the existing Breeding Hub. We will implement four key metrics modules that help farmers track and optimize their herd's reproductive performance.

---

## 1. Services per Conception (SPC) Metric

### Purpose
Track the average number of AI services required to achieve a confirmed pregnancy - a critical indicator of herd fertility efficiency.

### Data Sources
- `ai_records` table: `performed_date`, `pregnancy_confirmed`, `animal_id`
- `animals` table: `services_this_cycle`, `parity`

### Calculation Logic
```
SPC = Total AI Services Performed / Total Pregnancies Confirmed

Per-animal SPC calculated from historical breeding cycles:
- Count AI attempts per conception using breeding_events or ai_records
- Track across multiple calvings for lifetime SPC
```

### Target Benchmarks (industry standard)
| Livestock | Excellent | Good | Needs Improvement |
|-----------|-----------|------|-------------------|
| Cattle | <1.5 | 1.5-2.0 | >2.0 |
| Goat | <1.8 | 1.8-2.5 | >2.5 |

### UI Component: `ServicesPerConceptionCard.tsx`
- Display farm average SPC as primary metric
- Color-coded status indicator (green/yellow/red)
- Trend arrow showing improvement/decline vs previous period
- Breakdown by livestock type
- List of "repeat breeders" (3+ services)

---

## 2. Calving Interval Tracking

### Purpose
Measure the days between successive calvings - affects farm profitability directly.

### Data Sources
- `animals` table: `last_calving_date`, `parity`
- `breeding_events` table: `event_type = 'calving'`
- Historical offspring birth dates

### Calculation Logic
```
Calving Interval = Days between current calving and previous calving

For animals with parity >= 2:
- Query two most recent calving events
- Calculate difference in days
- Average across herd for farm-level metric
```

### Target Benchmarks
| Livestock | Optimal | Acceptable | Too Long |
|-----------|---------|------------|----------|
| Cattle | 365-400 days | 400-450 days | >450 days |
| Goat | 240-270 days | 270-300 days | >300 days |

### UI Component: `CalvingIntervalCard.tsx`
- Farm average calving interval (days)
- Distribution chart (histogram of intervals)
- Animals with longest intervals flagged
- Comparison to optimal target line

---

## 3. Heat Detection Rate (HDR)

### Purpose
Measure how effectively the farm detects heat events - the foundation of successful breeding.

### Data Sources
- `heat_records` table: all detected heat events
- `animals` table: female breeding-eligible count
- `ai_records` table: AI timing relative to heat

### Calculation Formulas
```
Heat Detection Rate = (Detected Heats / Expected Heats) × 100

Expected Heats = Number of open cycling animals × (Days in Period / 21)
Detected Heats = Actual heat records in period
```

### Secondary Metrics
- **Heat-to-AI Interval**: Time from heat detection to AI (target: 12-30 hours)
- **Standing Heat %**: Percentage of detected heats with standing heat confirmed
- **AI Timing Accuracy**: % of AI performed within optimal window

### UI Component: `HeatDetectionRateCard.tsx`
- HDR percentage with gauge visualization
- Detection method breakdown (visual, mounting, behavioral)
- Average cycle length (days) with variance indicator
- "Missed heat" alerts for animals overdue for heat

---

## 4. Breeding Season Support

### Purpose
Enable farms using seasonal breeding to track performance within defined windows.

### Configuration
- Allow farm to set "breeding season" dates (optional)
- Default: year-round breeding (no season restrictions)
- Typical seasons: "Wet season breeding" (Jun-Nov) or "Dry season breeding" (Dec-May)

### Metrics within Season
- AI performed during season window
- Conception rate within season
- Expected calving distribution

### UI Component: `BreedingSeasonCard.tsx`
- Season timeline visualization
- Current season status (active/inactive)
- Season-specific success metrics
- Toggle to enable/disable seasonal view

---

## Technical Implementation

### New Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useBreedingAnalytics.ts` | Main data hook for all breeding analytics |
| `src/components/breeding/analytics/ServicesPerConceptionCard.tsx` | SPC metric display |
| `src/components/breeding/analytics/CalvingIntervalCard.tsx` | CI metric with histogram |
| `src/components/breeding/analytics/HeatDetectionRateCard.tsx` | HDR metric with gauge |
| `src/components/breeding/analytics/BreedingSeasonCard.tsx` | Seasonal breeding view |
| `src/components/breeding/analytics/BreedingAnalyticsSection.tsx` | Container for all analytics cards |
| `src/components/breeding/analytics/index.ts` | Barrel exports |

### Hook: `useBreedingAnalytics.ts`

```typescript
interface BreedingAnalytics {
  // Services per Conception
  avgServicesPerConception: number;
  spcByLivestockType: Record<string, number>;
  repeatBreeders: Animal[]; // 3+ services
  
  // Calving Interval
  avgCalvingIntervalDays: number;
  calvingIntervalDistribution: { range: string; count: number }[];
  longestIntervalAnimals: Animal[];
  
  // Heat Detection Rate
  heatDetectionRate: number;
  expectedHeats: number;
  detectedHeats: number;
  avgCycleLengthDays: number;
  cycleLengthVariance: number;
  detectionMethodBreakdown: Record<string, number>;
  
  // Time period
  periodStart: Date;
  periodEnd: Date;
  
  isLoading: boolean;
}
```

### Database Query Strategy

1. **SPC Calculation**: 
   - Group `ai_records` by animal where `pregnancy_confirmed = true`
   - Count services between confirmed pregnancies
   - Use `services_this_cycle` for current cycle

2. **Calving Interval**:
   - Query `breeding_events` where `event_type = 'calving'`
   - Also use offspring birth dates for historical data
   - Calculate intervals for animals with 2+ calvings

3. **Heat Detection Rate**:
   - Count `heat_records` in period
   - Estimate expected heats from female count and cycle length
   - Calculate detection efficiency

### Integration with Breeding Hub

Add a new "Analytics" tab or section to the BreedingHub component:

```typescript
// In BreedingHub.tsx
<Tabs>
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
  </TabsList>
  <TabsContent value="analytics">
    <BreedingAnalyticsSection farmId={farmId} />
  </TabsContent>
</Tabs>
```

---

## UI Design Patterns

### Card Layout
Following existing chart patterns (`useResponsiveChart`):
- Mobile-first responsive design
- Skeleton loading states
- Bilingual labels (English primary, Tagalog secondary)
- Color-coded status indicators using existing design tokens

### Visual Components
1. **Gauge Chart**: For percentage metrics (HDR)
2. **Bar/Histogram Chart**: For calving interval distribution
3. **Metric Cards**: Large number + context + trend
4. **Animal Lists**: Clickable links to animal profiles

### Color Coding (consistent with fertility status)
- Green: Excellent/On target
- Yellow/Orange: Needs attention
- Red: Critical/Below benchmark

---

## Implementation Order

1. **Create `useBreedingAnalytics.ts` hook**
   - Implement all data fetching and calculations
   - Use existing query patterns with farm_id isolation

2. **Create individual metric cards**
   - `ServicesPerConceptionCard.tsx`
   - `CalvingIntervalCard.tsx`
   - `HeatDetectionRateCard.tsx`
   - `BreedingSeasonCard.tsx` (optional/configurable)

3. **Create container component**
   - `BreedingAnalyticsSection.tsx`
   - Responsive grid layout for cards

4. **Integrate with BreedingHub**
   - Add Analytics tab/section
   - Update exports

5. **Update Breeding Hub exports**
   - Export new components from `index.ts`

---

## Performance Considerations

- Use `staleTime: 5 * 60 * 1000` (5 min) for analytics queries
- Analytics are not real-time critical
- Consider lazy loading the analytics section (not visible on initial load)
- Use Promise.all for parallel data fetching

---

## Future Enhancements (Not in Scope)

- PDF report generation for breeding analytics
- Government-level aggregated analytics (already exists in `useBreedingStats`)
- Push notifications for breeding alerts
- Integration with external AI prediction models

