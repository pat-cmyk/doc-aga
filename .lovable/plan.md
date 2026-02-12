

# Cattle Reproductive Lifecycle: Current State Assessment and Gap Analysis

## The Ideal Veterinary Lifecycle (Reference Standard)

```text
Purchase/Entry --> Puberty Assessment --> Estrous Cycling --> Heat Detection
      |                                                          |
      v                                                          v
  Record Animal                                          Record Standing Heat
  (AnimalForm)                                           (12-30h breeding window)
                                                                 |
                                                                 v
                                                          Schedule AI --> Perform AI
                                                                             |
                                                                             v
                                                                   Non-Return Check
                                                                   (Day 18-24: no heat?)
                                                                             |
                                                              +---------+--------+
                                                              |                  |
                                                        Heat Returns       No Return
                                                        (Repeat cycle)         |
                                                                               v
                                                                     Pregnancy Check
                                                                     (Day 28-45, rectal/ultrasound)
                                                                               |
                                                              +---------+--------+
                                                              |                  |
                                                         Not Pregnant      Confirmed Pregnant
                                                         (Back to cycling)       |
                                                                                 v
                                                                          Dry Off (Day ~220-245)
                                                                                 |
                                                                                 v
                                                                          Close-Up / Pre-Calving
                                                                          (Last 21 days)
                                                                                 |
                                                                                 v
                                                                             Calving
                                                                    (Record calf + dam status)
                                                                                 |
                                                                                 v
                                                                          Postpartum / VWP
                                                                          (45-60 days rest)
                                                                                 |
                                                                                 v
                                                                       Back to Estrous Cycling
```

## What Currently EXISTS (Working)

| Stage | Component/Hook | Status |
|-------|---------------|--------|
| Animal Entry (Purchase) | `AnimalForm.tsx` | Working - registers new animals with basic info |
| Heat Detection Recording | `RecordHeatDialog.tsx`, `useHeatRecords.ts` | Working - records heat with breeding window calculation (12-30h) |
| Heat History & Cycle Analysis | `HeatHistoryTab.tsx`, `useHeatRecords.ts` | Working - average cycle length calculation |
| Schedule AI | `ScheduleAIDialog.tsx` | Working - creates `ai_records` with date, technician, semen code |
| Mark AI Performed | `MarkAIPerformedDialog.tsx` | Working - updates `ai_records.performed_date` |
| Confirm Pregnancy | `ConfirmPregnancyDialog.tsx` | Working - sets pregnancy_confirmed, calculates expected delivery (283 days for cattle) |
| Edit AI Records | `EditAIRecordDialog.tsx` | Working - full CRUD on AI records |
| Breeding Hub Dashboard | `BreedingHub.tsx`, `useBreedingHub.ts` | Working - stats, alerts, expected heats/deliveries |
| Breeding Alerts | `useBreedingAlerts.ts` | Working - proestrus, preg check due, VWP ending, repeat breeder |
| Breeding Timeline | `BreedingTimeline.tsx` | Working - visual timeline with legacy fallback |
| Dry Off | `DryOffAnimalButton.tsx` | Working - marks animal as non-lactating |
| Lactation Stages | `animalStages.ts` | Working - Early/Mid/Late Lactation, Dry Period calculation |
| Pre-Calving Risk Score | `usePreCalvingRiskScore.ts` | Working - 100-point weighted risk assessment |
| Fertility Status Display | `FertilityStateBadge.tsx` | Working - visual badge for each fertility state |
| Gestation/Cycle Constants | `fertility.ts` | Working - species-specific gestation, cycle length, VWP, min breeding age |

## Critical GAPS Identified

### GAP 1: Fertility State Machine is DISCONNECTED (Critical)

The database has a trigger (`trigger_update_fertility_status`) on `breeding_events` that automatically transitions `animals.fertility_status`. However, **no UI component ever inserts into `breeding_events`**. All dialogs write to the legacy `ai_records` and `heat_records` tables only.

**Impact**: The fertility status field on every animal is effectively stuck at its initial value (usually `not_eligible`). The Breeding Hub reads these statuses to categorize animals, so all animals likely show as "Not Ready."

**Fix**: Each action dialog must also insert a corresponding `breeding_events` row to trigger the state machine:
- `RecordHeatDialog` --> insert `heat_detected` event
- `ScheduleAIDialog` --> insert `ai_scheduled` event
- `MarkAIPerformedDialog` --> insert `ai_performed` event
- `ConfirmPregnancyDialog` --> insert `pregnancy_confirmed` event

### GAP 2: No "Record Calving" UI (Critical)

There is no `RecordCalvingDialog` or any UI to record when a pregnant animal gives birth. This is the most important lifecycle transition because it:
- Transitions fertility status to `fresh_postpartum`
- Increments parity
- Sets `last_calving_date`
- Resets `services_this_cycle` to 0
- Sets `voluntary_waiting_end_date`
- Should allow registering the newborn calf (linked to dam/sire)
- Restarts the lactation cycle

Currently, calving is only inferred from offspring `birth_date` in `useAnimalDetails.ts`, not explicitly recorded.

### GAP 3: No Non-Return / Suspected Pregnancy Detection (High)

After AI is performed, there's no mechanism to:
- Check at Day 18-24 whether the animal returned to heat (non-return check)
- Automatically or manually transition from `bred_waiting` to `suspected_pregnant`
- Record a `non_return` breeding event

The system jumps directly from "AI Performed" to "Confirm Pregnancy" with no intermediate step.

### GAP 4: No "Pregnancy Failed" / Heat Return Flow (High)

If a bred animal returns to heat (pregnancy failed), there is no UI to:
- Record the heat return event
- Reset fertility status back to `open_cycling` or `in_heat`
- Insert a `pregnancy_failed` or `heat_return` breeding event

### GAP 5: No VWP End Transition (Medium)

After calving, the system alerts when VWP is ending (via `useBreedingAlerts`) but there is no action to:
- Mark VWP as complete
- Transition from `fresh_postpartum` to `open_cycling`
- Insert a `vwp_ended` breeding event

This transition appears to be expected to happen automatically but has no automation or manual trigger.

### GAP 6: No Automatic Dry-Off Reminder (Medium)

The `DryOffAnimalButton` exists but:
- It does not calculate the optimal dry-off date (typically 60 days before expected delivery)
- There is no alert when a confirmed pregnant animal should be dried off (~Day 220-245 of gestation)
- Dry-off does not update `fertility_status` (it only changes `milking_stage`)

### GAP 7: Initial Fertility Status Assignment on Entry (Low)

When a new animal is registered via `AnimalForm`, their `fertility_status` defaults to `not_eligible`. There is no logic to automatically assess eligibility based on:
- Age (>15 months for cattle)
- Gender (female only)
- Weight/BCS thresholds

The `initialize_animal_fertility_status` RPC exists in the database but is never called from the frontend.

### GAP 8: Gestation Period Hardcoded for Cattle Only (Low)

`ConfirmPregnancyDialog` hardcodes 283 days (cattle). The system has species-specific constants in `fertility.ts` (cattle: 283, carabao: 310, goat: 150) but the dialog does not use them. This would produce wrong expected delivery dates for carabao and goats.

## Recommended Fix Priority

| Priority | Gap | Effort | Impact |
|----------|-----|--------|--------|
| 1 | GAP 1: Connect state machine (bridge dialogs to breeding_events) | Medium | Unlocks the entire fertility tracking system |
| 2 | GAP 2: Record Calving dialog + calf registration | Medium | Completes the lifecycle loop |
| 3 | GAP 3: Non-return check mechanism | Low | Enables suspected pregnancy workflow |
| 4 | GAP 4: Heat return / pregnancy failed flow | Low | Handles breeding failures properly |
| 5 | GAP 5: VWP end transition | Low | Automates postpartum-to-cycling transition |
| 6 | GAP 6: Dry-off reminder based on expected delivery | Low | Prevents late dry-off |
| 7 | GAP 7: Auto-initialize fertility on animal entry | Low | Better initial categorization |
| 8 | GAP 8: Species-specific gestation in pregnancy confirmation | Low | Correct dates for non-cattle |

## Suggested Implementation Approach

The most impactful first step would be to tackle **GAPs 1 + 2 + 3 + 4 + 5** together as a single "Complete the Fertility Lifecycle" effort, since they are all interconnected. This would involve:

1. Modifying existing dialogs to also insert `breeding_events` rows (bridging legacy tables to the state machine)
2. Creating a `RecordCalvingDialog` with calf registration
3. Adding non-return check and heat-return recording capabilities
4. Adding a VWP completion action

This would make the entire fertility state machine operational end-to-end.

