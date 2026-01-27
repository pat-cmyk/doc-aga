
# Ruminant Livestock Fertility Management: Gap Analysis & UX Redesign

## Part 1: The Ideal Ruminant Fertility Journey (Research Summary)

Based on veterinary science and industry best practices, the complete fertility management cycle for ruminants (cattle, carabao, goats, sheep) follows these distinct phases:

### The Complete Fertility Lifecycle

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        RUMINANT FERTILITY LIFECYCLE                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  1. PUBERTY & MATURITY                                                              │
│     ├── Age: 12-15 months (cattle/carabao), 6-8 months (goats)                     │
│     ├── Weight target: 60-65% of mature body weight                                │
│     └── BCS requirement: 2.5-3.5 for breeding readiness                            │
│                                                                                     │
│  2. ESTROUS CYCLE (21-day cycle for cattle/carabao, 17-21 for goats)               │
│     ├── Proestrus: 2-3 days - follicle development, pre-heat signs                 │
│     ├── Estrus (Heat): 12-18 hours - standing heat, optimal breeding              │
│     ├── Metestrus: 3-4 days - ovulation occurs, corpus luteum forms               │
│     └── Diestrus: 12-14 days - if not pregnant, cycle repeats                      │
│                                                                                     │
│  3. BREEDING DECISION POINT                                                         │
│     ├── Heat detection (visual, behavioral, technology-aided)                      │
│     ├── AM/PM rule: Heat AM → breed PM, Heat PM → breed next AM                   │
│     ├── Standing heat: Breed 12-30 hours after onset                              │
│     └── AI scheduling with technician                                               │
│                                                                                     │
│  4. POST-BREEDING PERIOD                                                            │
│     ├── Days 0-21: Wait for return to estrus (failed conception)                   │
│     ├── Days 21-30: If no return, possible pregnancy                               │
│     ├── Days 28-35: Blood pregnancy test possible                                  │
│     ├── Days 30-45: Ultrasound confirmation possible                              │
│     └── Days 60-90: Rectal palpation confirmation                                  │
│                                                                                     │
│  5. GESTATION (if confirmed pregnant)                                               │
│     ├── Cattle/Carabao: ~283 days (9+ months)                                      │
│     ├── Goats/Sheep: ~150 days (5 months)                                          │
│     ├── Trimester monitoring: BCS, nutrition, health checks                        │
│     └── Pre-calving preparation: Last 60 days critical                             │
│                                                                                     │
│  6. CALVING/KIDDING                                                                 │
│     ├── Signs monitoring: Udder fill, relaxed ligaments, restlessness             │
│     ├── Intervention readiness                                                      │
│     └── Post-birth monitoring: Colostrum, bonding, complications                   │
│                                                                                     │
│  7. POSTPARTUM RECOVERY                                                             │
│     ├── Uterine involution: 30-45 days                                             │
│     ├── Voluntary Waiting Period (VWP): 50-80 days                                │
│     ├── Return to cyclicity monitoring                                              │
│     └── Ready for next breeding cycle                                               │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Critical Success Factors from Research

| Factor | Best Practice | Impact |
|--------|---------------|--------|
| Heat Detection Rate | 70%+ detection accuracy | Directly affects conception rate |
| AI Timing | 12-30 hours post standing heat | Peak fertility window |
| Pregnancy Check | 28-60 days post-AI | Early non-pregnant detection |
| BCS at Breeding | 2.5-3.5 optimal | Conception rates drop outside range |
| Calving Interval | 365-400 days target | Economic efficiency |
| Voluntary Waiting Period | 50-80 days postpartum | Uterine recovery before re-breeding |

---

## Part 2: Current Doc Aga Implementation Audit

### What Exists Today

| Component | Location | Current Capabilities |
|-----------|----------|---------------------|
| **Heat Detection** | `useHeatRecords.ts`, `RecordHeatDialog.tsx`, `HeatHistoryTab.tsx` | Record heat events, detection method, intensity, standing heat flag, auto-calculate breeding window (12-30 hrs) |
| **Daily Heat Monitoring** | `useDailyHeatMonitoring.ts`, `DailyActivityCompliance.tsx` | Predict next heat based on 21-day cycle, flag animals needing observation, show overdue animals |
| **AI Scheduling** | `ScheduleAIDialog.tsx`, `AIRecords.tsx` | Schedule AI date, record technician, semen code |
| **AI Performed** | `MarkAIPerformedDialog.tsx` | Mark scheduled AI as performed |
| **Pregnancy Confirmation** | `ConfirmPregnancyDialog.tsx` | Confirm pregnancy, auto-calculate 283-day delivery date |
| **ReproClock Visual** | `ReproClock.tsx` | 21-day cycle visualization, breeding window highlight, pregnancy mode |
| **Bio Card Repro Status** | `useBioCardData.ts` | Aggregate reproductive status for animal profile |
| **Predictive Insights** | `usePredictiveInsights.ts`, `BreedingPredictionCard.tsx` | AI-predicted heat dates, delivery alerts, success rate forecasting |
| **Government Analytics** | `BreedingSuccessChart.tsx`, `HeatDetectionMetrics.tsx` | Regional breeding success rates, heat detection analytics |

### Current Data Flow

```text
Heat Detection → (Optional) Schedule AI → Mark AI Performed → Confirm Pregnancy → Track Delivery
     ↓                    ↓                      ↓                   ↓
 heat_records        ai_records           ai_records          ai_records
                    (scheduled)          (performed)       (pregnancy_confirmed,
                                                          expected_delivery_date)
```

---

## Part 3: Gap Analysis - Ideal vs. Current

### Critical Gaps Identified

| # | Gap | Ideal Practice | Current State | Farmer Impact |
|---|-----|----------------|---------------|---------------|
| 1 | **Breeding Readiness Assessment** | Check age, weight, BCS before breeding | No systematic check - breeding available for any female | Risk of breeding immature or unhealthy animals |
| 2 | **Puberty/Maturity Tracking** | First heat is milestone; heifer vs cow distinction | No puberty tracking; no maiden/parous distinction | Cannot track breeding program efficiency |
| 3 | **Non-Return Tracking** | If no heat at 21 days post-AI = possible pregnancy | Only manual pregnancy confirmation | Missed early pregnancy indicators |
| 4 | **Pregnancy Diagnosis Scheduling** | Schedule preg check at 28-35 days post-AI | No reminder system for preg checks | Delayed detection of open animals |
| 5 | **Failed AI / Repeat Breeder Tracking** | Track animals requiring 3+ services | No concept of "services per conception" | Cannot identify fertility problems |
| 6 | **Postpartum Tracking** | VWP (50-80 days), uterine health monitoring | No postpartum state; no VWP concept | Animals may be bred too early |
| 7 | **Trimester Monitoring** | Health/nutrition checks at key gestation points | Only tracks expected delivery | No gestation health milestones |
| 8 | **Calving Recording** | Record actual calving date, complications, calf info | No calving event recording | Incomplete reproductive history |
| 9 | **Heat Synchronization Protocols** | Pre-defined sync programs (OvSynch, 7&7 Synch) | Only individual heat detection | Cannot manage synchronized breeding programs |
| 10 | **Seasonal Breeding Windows** | Some farmers use defined breeding seasons | No breeding season concept | Cannot track seasonal breeding programs |
| 11 | **Proestrus/Pre-Heat Alerts** | Alert 1-2 days before expected heat | Current alert is "day of" heat | Less preparation time for breeding |
| 12 | **Breeding Outcome Recording** | Record if AI was successful/failed at next cycle | Only pregnancy confirmed/not | Cannot analyze conception rates per service |

### Strengths of Current Implementation

- ✅ 21-day cycle awareness and prediction
- ✅ Optimal breeding window calculation (12-30 hrs post standing heat)
- ✅ Visual ReproClock for cycle position
- ✅ Daily monitoring dashboard with actionable alerts
- ✅ Heat observation checks (mark as "no heat seen")
- ✅ Government-level analytics for program effectiveness
- ✅ Voice-enabled recording for farmers

---

## Part 4: Proposed User Journey & UX/UI Design

### Design Principles for Farmers

1. **Progressive Disclosure**: Show simple status first, details on tap
2. **Action-Oriented**: Each screen should have a clear next action
3. **Visual Language**: Use icons, colors, and progress indicators over text
4. **Tagalog-First**: Primary labels in Tagalog with English support
5. **Offline-Ready**: Critical actions work without connectivity
6. **Voice-Compatible**: All inputs should support voice entry

### Proposed Fertility Journey States

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        ANIMAL FERTILITY STATE MACHINE                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  🔵 NOT_BREEDING_ELIGIBLE                                                           │
│     └── (too young, too light, wrong BCS, or male)                                 │
│           │                                                                         │
│           ▼ [Reaches maturity criteria]                                             │
│                                                                                     │
│  🟢 OPEN_CYCLING ───────────────────────────────────────────────┐                   │
│     └── (eligible, not pregnant, awaiting heat)                 │                   │
│           │                                                      │                   │
│           ▼ [Heat detected]                                      │                   │
│                                                                  │                   │
│  🔥 IN_HEAT ────────────────────────────────────┐               │                   │
│     └── (optimal breeding window active)         │               │                   │
│           │                                      │               │                   │
│           ▼ [AI performed]                       ▼ [Window ends] │                   │
│                                                  │               │                   │
│  🎯 BRED_WAITING                                 └───────────────┘                   │
│     └── (AI done, waiting for return/non-return)                                    │
│           │                     │                                                    │
│           │ [Heat returns       ▼ [No heat at day 21+]                              │
│           │  at day 18-24]                                                           │
│           │                                                                          │
│           │              🔍 SUSPECTED_PREGNANT                                       │
│           │                  └── (non-return, needs confirmation)                    │
│           │                        │                                                 │
│           │                        ▼ [Preg check done]                               │
│           │                                                                          │
│           │              🤰 CONFIRMED_PREGNANT                                       │
│           │                  └── (pregnancy verified)                                │
│           │                        │                                                 │
│           │                        ▼ [Delivery occurs]                               │
│           │                                                                          │
│           │              👶 FRESH (POSTPARTUM)                                       │
│           │                  └── (just calved, in VWP)                               │
│           │                        │                                                 │
│           │                        ▼ [VWP complete, cycling resumes]                 │
│           │                        │                                                 │
│           └────────────────────────┴─────────────────────────────────────────────▶  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Proposed UI: Unified Breeding Hub

Replace scattered breeding-related components with a unified "Breeding Hub" accessible from:
- Dashboard "Today At A Glance" breeding box
- Animal profile AI/Breeding tab
- Main navigation under Operations

#### A. Breeding Hub Dashboard View (Farm-Level)

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  🐄 Breeding Hub                                        [+ Record Heat] [+ Schedule AI]
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │     12      │  │      3      │  │      5      │  │      2      │               │
│  │   Open &    │  │  In Heat    │  │   Waiting   │  │  Preg Check │               │
│  │  Cycling    │  │   Today     │  │ (Post-AI)   │  │    Due      │               │
│  │  🟢         │  │  🔥         │  │  🎯         │  │  🔍         │               │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                                     │
│  ━━━━ Action Required Today ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                                     │
│  🔥 IN HEAT NOW - Breed within 12-30 hrs                                           │
│  ┌────────────────────────────────────────────────────────────────────────────────┐│
│  │ 🐄 Bessie (A001)    Standing heat detected 6 hrs ago    [Schedule AI] [Viewed] ││
│  │    Optimal window: 6 more hours remaining                                      ││
│  └────────────────────────────────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────────────────────────────────┐│
│  │ 🐄 Luna (A007)      Weak heat signs at 8am              [Record Heat] [Check]  ││
│  │    Observe for standing heat                                                    ││
│  └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                     │
│  🔍 PREGNANCY CHECK DUE - Schedule with technician                                 │
│  ┌────────────────────────────────────────────────────────────────────────────────┐│
│  │ 🐄 Ginger (A003)    AI performed 35 days ago           [Confirm Preg] [Open]   ││
│  │    No return to heat - likely pregnant                                          ││
│  └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                     │
│  ━━━━ Coming Up (Next 7 Days) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                                     │
│  📅 Expected Heat                          📅 Expected Delivery                    │
│  • Daisy (A005) - ~Jan 29 (2 days)        • Star (A012) - Feb 15 (19 days)        │
│  • Mocha (A008) - ~Jan 31 (4 days)        • Cookie (A018) - Feb 22 (26 days)      │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### B. Individual Animal Breeding Timeline

A new timeline visualization showing the animal's complete reproductive history and current status:

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Bessie (A001) - Breeding Timeline                                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Current Status: 🔥 IN HEAT (Standing heat detected 6 hrs ago)                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │         OPTIMAL BREEDING WINDOW                                              │   │
│  │  ├──────────────█████████████░░░░░░░░░────────────┤                         │   │
│  │  Start (12h)          NOW (6h left)        End (30h)                         │   │
│  │                                                                              │   │
│  │  💡 Recommendation: Schedule AI within next 6 hours for best results        │   │
│  │  [Schedule AI Now]                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ━━━━ Reproductive History ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                                     │
│  2026 ─────────────────────────────────────────────────────────────────────────    │
│       │                                                                             │
│  Jan  ●──🔥 Heat detected (today)                                                  │
│       │    Standing heat, strong intensity                                          │
│       │                                                                             │
│  Jan  ●──🔥 Heat detected (Jan 6)                                                  │
│       │    → AI scheduled & performed                                               │
│       │    → Return to heat at day 20 (conception failed)                          │
│       │                                                                             │
│  Dec  ●──🔥 Heat detected (Dec 16)                                                 │
│       │    → AI not performed (technician unavailable)                              │
│       │                                                                             │
│  2025 ─────────────────────────────────────────────────────────────────────────    │
│       │                                                                             │
│  Sep  ●──👶 Calved (Sep 15, 2025)                                                  │
│       │    → Calf: Male, healthy, 32kg                                              │
│       │    → VWP ended: Nov 15, 2025                                                │
│       │                                                                             │
│  Jan  ●──🤰 Pregnancy confirmed (Jan 20, 2025)                                     │
│       │    → AI date: Dec 5, 2024                                                   │
│       │    → Services to conception: 2                                              │
│       │                                                                             │
│  ━━━━ Fertility Metrics ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                                     │
│  Avg Cycle Length: 20 days    |    Services/Conception: 1.8    |    Calvings: 3   │
│  Last Calving Interval: 380 days                                                   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### C. Enhanced ReproClock with State Awareness

Upgrade the existing ReproClock to show the full fertility state:

```text
┌───────────────────────────────────────────────────┐
│            ReproClock 2.0 States                  │
├───────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ CYCLING │  │ IN HEAT │  │ WAITING │          │
│  │   🔵    │  │   🔥    │  │   🎯    │          │
│  │  Day 8  │  │ Day 0   │  │ Day 15  │          │
│  │  /21    │  │ 6h left │  │ Post-AI │          │
│  └─────────┘  └─────────┘  └─────────┘          │
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │SUSPECTED│  │CONFIRMED│  │  FRESH  │          │
│  │   🔍    │  │   🤰    │  │   👶    │          │
│  │ Day 28  │  │ Day 180 │  │ Day 45  │          │
│  │Non-return│ │Trimester2│  │   VWP   │          │
│  └─────────┘  └─────────┘  └─────────┘          │
│                                                   │
└───────────────────────────────────────────────────┘
```

#### D. Voice-First Breeding Recording (Farmhand Flow)

```text
Farmer: "Nakita ko si Bessie na may init, tumatayo siya"

Doc Aga Response:
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  🔥 Heat Detection Recorded                                                         │
│                                                                                     │
│  Animal: Bessie (A001)                                                              │
│  Detection: Standing Heat ✓                                                         │
│  Intensity: Strong                                                                  │
│  Time: Just now                                                                     │
│                                                                                     │
│  ━━━━ Breeding Window ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                                     │
│  Pinakamainam na oras para i-AI: 12:00pm - 6:00am bukas                            │
│  (12-30 oras mula ngayon)                                                           │
│                                                                                     │
│  [Schedule AI] [Remind Me Later] [Done]                                             │
│                                                                                     │
│  💡 Tip: Kung walang available na technician, i-notify ang manager                 │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Technical Implementation Roadmap

### Phase 1: Data Model Enhancements (Foundation)

1. **Add `fertility_status` enum** to animals table:
   - `not_eligible`, `open_cycling`, `in_heat`, `bred_waiting`, `suspected_pregnant`, `confirmed_pregnant`, `fresh_postpartum`

2. **New `breeding_events` table** to unify lifecycle:
   - `event_type`: `heat_detected`, `ai_scheduled`, `ai_performed`, `non_return`, `pregnancy_check`, `pregnancy_confirmed`, `pregnancy_failed`, `calving`, `vwp_ended`
   - Links heat_records and ai_records into single timeline

3. **Add to animals table**:
   - `last_calving_date`
   - `parity` (number of calvings)
   - `services_this_cycle` (AI attempts for current breeding)
   - `voluntary_waiting_end_date`

4. **Database triggers**:
   - Auto-update `fertility_status` based on events
   - Auto-calculate `suspected_pregnant` at 21 days post-AI if no heat return
   - Auto-flag preg check due at 28-35 days post-AI

### Phase 2: UI Components

1. **BreedingHub.tsx**: New unified dashboard view
2. **BreedingTimeline.tsx**: Individual animal history timeline
3. **FertilityStateBadge.tsx**: Visual status indicator
4. **ReproClockV2.tsx**: Enhanced with all states
5. **CalvingRecordDialog.tsx**: Record calving events
6. **BreedingReadinessCheck.tsx**: Pre-breeding eligibility check

### Phase 3: Smart Alerts & Automation

1. **Proestrus alerts**: 2 days before expected heat
2. **Pregnancy check reminders**: 28-35 days post-AI
3. **VWP completion alerts**: When postpartum animal ready for breeding
4. **Repeat breeder flags**: After 3 failed services

### Phase 4: Analytics & Reporting

1. **Services per Conception** metric
2. **Calving Interval** tracking
3. **Heat Detection Rate** measurement
4. **Breeding Season** support

---

## Part 6: Farmer-Friendly UX Principles Applied

| Principle | Application |
|-----------|-------------|
| **Show, Don't Tell** | Use icons (🔥🎯🤰👶) and colors instead of text labels |
| **One Action Per Screen** | Breeding Hub shows THE action needed right now |
| **Progressive Complexity** | Summary view → tap for details → tap for full timeline |
| **Uncertainty Tolerance** | "Expected heat: ~Jan 29" acknowledges biological variance |
| **Voice-First Input** | All data entry supports Taglish voice |
| **Offline Resilience** | Critical status visible even when offline |
| **Bilingual Labels** | Primary Tagalog, secondary English |

---

## Summary: From Current to Ideal

| Current Limitation | Proposed Solution |
|--------------------|-------------------|
| Fragmented heat + AI + pregnancy tracking | Unified Breeding Hub with timeline view |
| No breeding readiness check | Pre-breeding eligibility gate |
| Missing non-return tracking | Automatic "suspected pregnant" state at day 21+ |
| No pregnancy check reminders | Smart alerts at 28-35 days post-AI |
| No calving recording | CalvingRecordDialog with calf info |
| No postpartum/VWP tracking | "Fresh" state with VWP countdown |
| No services per conception | Breeding metrics in animal profile |
| No proestrus alerts | Alert 2 days before expected heat |

This phased approach allows incremental improvement while maintaining compatibility with existing data and farmer workflows.
