

# Trimmed Custom Knowledge — Ready to Paste

Below is the optimized text. It keeps only the "always-on" safety rules and delegates detailed review/testing/performance standards to the code file.

---

## What Was Removed (and Why)

| Removed from Custom Knowledge | Now Lives In |
|-------------------------------|--------------|
| Detailed completion checklist format | `docs/enhanced-governance-protocol.md` SS1.D |
| Full UI-specific CSS rules | SS5 of the doc |
| Component reuse inventory (BilingualLabel, etc.) | SS3.B of the doc |
| Detailed failure handling steps | SS1.E of the doc |
| Performance targets and patterns | SS7 of the doc |
| Test coverage gates | SS8 of the doc |
| Security checklist | SS9 of the doc |
| Pre-coding review framework (4 stages) | SS2 of the doc |

---

## The Trimmed Text

Copy everything between the `---START---` and `---END---` markers below:

```text
---START---

# CORE OPERATING PROTOCOL

**PRIMARY DIRECTIVE:**
Optimism is forbidden. Operate with "Zero Trust" in your own code execution. You have permission to consume extra steps/credits to verify your work.

**DETAILED REFERENCE:** Before any non-trivial implementation, read `docs/enhanced-governance-protocol.md` and follow the Pre-Coding Review Framework (Section 2). That document is the canonical reference for review stages, test standards, performance targets, security checklists, and issue presentation format.

## 1. VERIFICATION LOOP (Always Active)

A task is ONLY complete when proven via **Baseline -> Execute -> Verify**:

- **Baseline:** SELECT query (data) or screenshot at target viewport (UI) BEFORE changes.
- **Execute:** Apply fix. If multi-step fix fails midway -> STOP and report partial state.
- **Verify:**
  - Data: Run verification SELECT. Unexpected results -> report "FIX FAILED".
  - UI (MANDATORY for visual/layout/CSS): `browser--navigate_to_sandbox` at affected viewport (e.g., 390x844) -> `browser--screenshot` -> confirm fix. If issue persists -> "FIX FAILED", diagnose with `browser--observe`/`browser--extract`, iterate.
- **Governance (FINAL step):** Update `docs/data-relationships-map.md`, `changelog.md`, or `docs/ssot-architecture.md` as applicable. Skipping = incomplete.

## 2. SSOT DATA FLOWS (Always Active)

Breaking any of these synchronized paths is a blocking bug:

| Domain | Flow |
|--------|------|
| Milk Revenue | `milking_records` (sale) -> DB trigger -> `revenue_ledger` |
| Animal Weight | `weight_records` (latest) -> DB trigger -> `animals.current_weight_kg` |
| OVR Scores | records -> `calculate_animal_ovr` trigger -> `animal_ovr_cache` (server-side only) |
| Feed Inventory | `feeding_records` -> `feed_inventory_id` + `cost_per_kg_at_time` (locked at consumption) |
| Milk Feeding | `milk_inventory` -> FIFO -> `feeding_records` (market price for good, P0 for rejected) |
| Herd Investment | `animals.purchase_cost` + `farm_expenses` + `feeding_records` (auto-calculated) |
| Feed Stock Days | Roughage inventory -> `useFeedInventory` -> survival buffer |
| Parent Eligibility | `animals` -> gender + (birth_date null OR age >= 16 months) -> dropdowns |
| AI Father Detection | `ai_records` -> `useEditAnimalForm` -> pre-populate father fields |
| Cooperative | `cooperative_memberships` -> SECURITY DEFINER RPCs -> hooks -> dashboard |

Cache: All mutations go through `CacheManager.invalidateForMutation()`.

## 3. PERMISSIONS (Always Active)

- Four roles: **Owner**, **Manager** (`farmer_owner`), **Farmhand**, **Vet** (`is_vet()`).
- `useUnifiedPermissions()` is the SSOT hook for all feature visibility.
- One role per farm per user. RLS enforces farm-level isolation.
- `is_farm_manager()` checks `farm_memberships.role_in_farm` (NOT global `user_roles`).

## 4. SSOT RULES (Always Active)

- Before modifying ANY field/function/component: trace `Table -> RPC -> Hook -> Component`. Synchronize ALL downstream consumers in the SAME change.
- Search codebase before creating new UI components. Reuse shared components (BilingualLabel, GenderSelector, LactatingToggle, WeightHintBadge). Add/Edit form parity is mandatory.
- UI: No piecemeal CSS. Trace full DOM hierarchy first. Test at the viewport where the bug occurs. Browser is source of truth. Semantic design tokens only (no raw text-white/bg-black). All colors in HSL.

---END---
```

---

## Summary of Changes

- **Before:** ~130 lines of custom knowledge, heavy overlap with `docs/enhanced-governance-protocol.md`.
- **After:** ~45 lines. Core safety net (verification, SSOT flows, permissions, DRY rules) stays always-on. Everything else is accessed via the bridge instruction pointing to the doc file.
- **Net effect:** ~60% token savings per message while preserving all governance guardrails.

