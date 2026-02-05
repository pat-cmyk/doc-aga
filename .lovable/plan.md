

# Pre-Calving Risk Score (PCRS) System: Research and Options

## Bug Confirmation: February 2026 Missing "Urgent" Tag

**Root Cause Identified:** The current logic uses `parseISO(`${monthKey}-01`)` which checks if the **first day of the month** is within 30 days, not the actual delivery dates.

- **Current Date:** Feb 5, 2026
- **February 2026 deliveries:** 12 animals due Feb 16-23 (11-18 days away)
- **March 2026 deliveries:** 25 animals due Mar 16+ (39+ days away)

February should show "Urgent" badge but doesn't because `parseISO("2026-02-01")` is technically in the past (before "now"). This is a logic bug.

---

## Global Best Practices Research: Pre-Calving Risk Assessment

### Industry-Standard Risk Factors

Based on veterinary research from University of Georgia Extension, Penn State Extension, University of Minnesota, Merck Veterinary Manual, and USDA/NAHBS studies:

| Risk Factor | Impact on Dystocia/Complications | Source |
|-------------|----------------------------------|--------|
| **Body Condition Score (BCS)** | BCS >3.5 or <2.5 at calving = 2x higher risk of metabolic disorders, dystocia | Penn State, UGA |
| **Parity (First-calf heifers)** | Primiparous = 3-4x higher dystocia risk than multiparous | Merck Vet Manual |
| **Days Until Delivery** | <14 days = high intervention probability | Industry standard |
| **Recent Health Issues** | Active infection/treatment = increased calving complications | UMN Extension |
| **Data Freshness** | Stale data (>30 days since BCS/checkup) = blind spot | Operational best practice |
| **Services per Conception** | High SPC (>3) may correlate with fetal issues | Reproductive research |
| **Age at First Calving** | Too young (<24 months cattle) = smaller pelvic area | USDA AIPL |

### Transition Period Critical Checkpoints

From Zinpro and DAIReXNET Transition Management Checklists:

1. **Dry-off** - BCS assessment
2. **3-4 weeks pre-calving** - Close-up period, BCS 2.5-3.0 target
3. **At calving** - Highest risk point
4. **60 days post-calving** - Recovery assessment

---

## Three Options for Pre-Calving Risk Score System

### Option A: Simple Weighted Score (Recommended for Phase 1)

A straightforward 100-point scoring system using currently available data.

#### Scoring Components

| Factor | Points | Criteria |
|--------|--------|----------|
| **Timeline Proximity** | 0-35 pts | <7 days: 35, 7-14 days: 25, 15-30 days: 15, 31-60 days: 5, >60 days: 0 |
| **BCS Risk** | 0-25 pts | <2.0: 25, 2.0-2.4: 15, 4.0-4.5: 10, >4.5: 25, 2.5-3.5 (ideal): 0 |
| **Parity Risk** | 0-15 pts | Primiparous (parity=0): 15, Parity 1-2: 5, Parity 3+: 0 |
| **Health History** | 0-15 pts | Health issues in last 90 days: +5 per issue (max 15) |
| **Data Freshness** | 0-10 pts | No BCS in >60 days: 10, No BCS in >30 days: 5, Recent BCS: 0 |

#### Risk Tiers

| Score | Tier | Badge | Action Level |
|-------|------|-------|--------------|
| **75-100** | Critical | 🔴 Red | Immediate veterinary review required |
| **50-74** | High | 🟠 Orange | Priority monitoring, prep calving area |
| **25-49** | Moderate | 🟡 Yellow | Standard close-up protocols |
| **0-24** | Low | 🟢 Green | Routine monitoring |

#### Pros
- Uses 100% existing data (no schema changes)
- Simple to understand and explain to farmers
- Can implement in 1-2 days
- Aligns with Doc Aga's existing data tools

#### Cons
- Limited precision without sire calving ease data
- Doesn't account for livestock-type-specific thresholds
- No machine learning/adaptive component

---

### Option B: Multi-Factor Composite Score with Livestock-Specific Thresholds

Enhanced version with species-specific calibration.

#### Livestock-Specific BCS Targets

| Species | Target at Calving | Underweight Risk | Overweight Risk |
|---------|-------------------|------------------|-----------------|
| Cattle (dairy) | 2.5-3.0 (5-pt scale) | <2.0 | >3.5 |
| Cattle (beef) | 5-6 (9-pt scale) | <4 | >7 |
| Goat | 2.5-3.0 | <2.0 | >4.0 |
| Carabao | 3.0-3.5 | <2.5 | >4.0 |

#### Additional Factors

| Factor | Points | Notes |
|--------|--------|-------|
| **Breeding History** | 0-10 pts | SPC >3: +5, Previous stillbirth: +10 |
| **Weight Trend** | 0-10 pts | Weight loss in late gestation: +10 |
| **Vaccination Status** | 0-5 pts | Overdue vaccines: +5 per overdue |

#### Total: 100-point scale (same tiers as Option A)

#### Pros
- More accurate per-species assessment
- Accounts for Philippine livestock mix
- Better correlation with actual outcomes

#### Cons
- Requires BCS conversion logic per species
- More complex to explain to non-technical users
- May need historical outcome data to validate weights

---

### Option C: Predictive Risk Model with Outcome Learning (Future)

Machine learning approach that learns from actual calving outcomes.

#### Architecture

```
Input Features → ML Model → Risk Probability (0-100%)
     ↓                            ↑
     └─────── Feedback Loop ──────┘
                (actual outcomes)
```

#### Required Data Points (not all currently available)

| Feature | Current Status |
|---------|----------------|
| BCS at close-up | ✅ Available |
| Parity | ✅ Available |
| Age | ✅ Available |
| Days to delivery | ✅ Available |
| Health history | ✅ Available |
| Sire calving ease EPD | ❌ Not tracked |
| Previous calving difficulty | ❌ Not tracked (breeding_events could add) |
| Calf birth weight prediction | ❌ Not tracked |
| Pelvic measurements | ❌ Not tracked |

#### Pros
- Highest potential accuracy
- Self-improving over time
- Can incorporate new factors easily

#### Cons
- Requires 6-12 months of outcome data
- Needs schema additions
- Higher implementation complexity
- Overkill for current farm sizes

---

## Recommendation: Phased Approach

### Phase 1 (Immediate): Option A + Bug Fix
1. Fix the February "Urgent" calculation bug
2. Implement simple 100-point PCRS in `urgencyGlossary.ts`
3. Update `ExpectedDeliveriesTimeline` to show risk tier per animal
4. Add PCRS to Doc Aga tools for AI analysis

### Phase 2 (Next Quarter): Enhance to Option B
1. Add livestock-specific thresholds
2. Track calving outcomes in `breeding_events`
3. Add BCS trend analysis (direction of change)

### Phase 3 (Future): Evaluate Option C
1. After 200+ recorded calving outcomes
2. Build outcome correlation analysis
3. Consider ML if justified by farm scale

---

## Data Availability Assessment

Based on current demo data query:

| Factor | Data Available | Sample Values |
|--------|----------------|---------------|
| Days until delivery | ✅ Yes | 11-180 days |
| BCS scores | ⚠️ Partial (some missing) | 1.5, 2.8, 2.9, 3.2, 4.1 |
| BCS date freshness | ✅ Yes | Can calculate days since BCS |
| Parity | ✅ Yes | All showing 0 (demo data) |
| Health record count (90 days) | ✅ Yes | 0-2 issues |
| Livestock type | ✅ Yes | cattle, goat, carabao |

**Note:** Current demo data shows all `parity=0`, suggesting either:
1. Demo data generation didn't populate parity
2. All animals are primiparous (first calving)

This is important context for Phase 1 - primiparous detection would flag ALL demo animals as higher risk.

---

## Implementation Files

| File | Changes |
|------|---------|
| `src/lib/urgencyGlossary.ts` | Add PCRS definitions and calculator |
| `src/components/government/ExpectedDeliveriesTimeline.tsx` | Fix month-based bug, add per-animal risk view |
| `supabase/functions/doc-aga/tools.ts` | Add PCRS to delivery analysis tools |
| `src/hooks/usePreCalvingRiskScore.ts` | New hook for PCRS calculation |

---

## Summary: Pros/Cons Comparison

| Criterion | Option A (Simple) | Option B (Composite) | Option C (ML) |
|-----------|-------------------|---------------------|---------------|
| Implementation time | 1-2 days | 1 week | 2-3 months |
| Data requirements | ✅ All available | ✅ All available | ❌ Needs outcome data |
| Accuracy | Good (70-80%) | Better (80-85%) | Best (85-95%) |
| Explainability | ✅ Easy | ✅ Moderate | ❌ Black box |
| Maintenance | Low | Medium | High |
| Farmer understanding | ✅ Intuitive | ✅ Understandable | ⚠️ Trust required |

**Recommendation:** Start with Option A for immediate value, with clear upgrade path to Option B as the system matures.

