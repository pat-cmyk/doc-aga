# Enhanced Governance Protocol
# Combines project-specific SSOT rules with structured review framework

> **Purpose:** Single reference for AI agents and developers working on this codebase.
> Supersedes ad-hoc custom-knowledge blocks when adopted.

Last updated: 2026-02-23

---

## 0. Engineering Principles

| Principle | Meaning |
|-----------|---------|
| **Explicit over clever** | Readable code wins over terse/magic patterns. |
| **Engineered enough** | Not fragile/hacky, not prematurely abstracted. If in doubt, lean toward handling more edge cases. |
| **DRY aggressively** | Flag repetition before it spreads. Shared components & constants are mandatory (see §3). |
| **Well-tested is non-negotiable** | Too many tests > too few. Every mutation path needs coverage. |
| **Zero Trust in own output** | Never assume code works—prove it (see §1). |

---

## 1. Strict Verification Protocol (Definition of Done)

A task is ONLY complete when proven via the **Baseline → Execute → Verify** loop.

### A. Pre-Execution (Baseline)
- **Data fixes:** `SELECT` query showing the "bad data" rows *before* touching them.
- **UI fixes:** Identify the specific component/DOM hierarchy. Screenshot at the target viewport BEFORE changes.

### B. Execution
- Apply the fix.
- **CRITICAL:** If a multi-step fix fails midway → STOP and report partial state. Never silence errors.

### C. Post-Execution (Proof)
- **Data:** Run verification `SELECT`. If unexpected results → report "FIX FAILED", do not mark done.
- **UI (MANDATORY for all visual/layout/CSS changes):**
  1. `browser--navigate_to_sandbox` at the affected viewport (e.g., 390×844 for mobile).
  2. `browser--screenshot` the AFTER state.
  3. If the issue persists → report "FIX FAILED", diagnose with `browser--observe` / `browser--extract`, iterate.
- **Governance:** Update DRM / changelog / SSOT docs (see §6). This is the FINAL step — skipping it = incomplete.

### D. Completion Checklist (mandatory output for complex tasks)

```
## ✅ Completion Checklist
- [ ] **Baseline:** "Before" state identified and shown.
- [ ] **Execution:** Fix applied.
- [ ] **Verification:** "After" proof provided (screenshot / query results).
- [ ] **Governance:** DRM / Changelog / SSOT updated (if applicable).
- [ ] **Status:** Fully Complete (or Report Failure).
```

### E. Failure Handling
1. **STOP.** Do not mark as done.
2. **REPORT:** "Verification failed. Expected X, but screenshot/database shows Y."
3. **DIAGNOSE:** Use browser tools or SQL to identify root cause.
4. **ASK:** "Shall I attempt a different method?"

---

## 2. Pre-Coding Review Framework

Before implementing non-trivial changes, run a structured review. Scope depends on change size:

| Mode | When to use | Issues per section |
|------|-------------|--------------------|
| **BIG CHANGE** | New features, refactors, schema changes | Up to 4 |
| **SMALL CHANGE** | Bug fixes, minor enhancements | 1 per section |

### Review Stages (sequential, with user feedback between each)

#### Stage 1 — Architecture Review
- System design & component boundaries
- Dependency graph & coupling
- Data flow patterns & bottlenecks (trace Table → RPC → Hook → Component)
- Scaling characteristics & single points of failure
- Security architecture (auth, RLS, API boundaries)

#### Stage 2 — Code Quality Review
- Code organization & module structure
- DRY violations (flag aggressively)
- Error handling patterns & missing edge cases (call out explicitly)
- Technical debt hotspots
- Under-engineered vs. over-engineered areas

#### Stage 3 — Test Review
- Coverage gaps (unit, integration, e2e)
- Test quality & assertion strength
- Missing edge-case coverage
- Untested failure modes & error paths
- Coverage threshold compliance (≥70%)

#### Stage 4 — Performance Review
- N+1 queries & database access patterns (especially `animals`, `milking_records`, `feeding_records`)
- Memory usage concerns (large lists, unbounded queries)
- Caching opportunities (IndexedDB + React Query coordination via `CacheManager`)
- Slow / high-complexity code paths
- Bundle size impact

### Issue Presentation Format

For every identified issue:
1. **Describe** concretely with file/line references.
2. **Present 2–3 options** (always include "do nothing" where reasonable).
3. **For each option:** implementation effort, risk, impact on other code, maintenance burden.
4. **Recommend** one option with rationale mapped to §0 principles.
5. **Ask** for user input before proceeding.

Use **numbered issues** with **lettered options** (e.g., "Issue 1 — Option A"). Recommended option always listed first.

---

## 3. SSOT Architecture

### A. Dataset Dependency & Continuity

Before modifying ANY field, function, or component:

1. **Impact Analysis:** Trace `Table → RPC → Hook → Component`. Identify ALL consumers.
2. **Connection Continuity:** If you rename a column or change RPC return shape, synchronize ALL downstream consumers in the SAME change.
3. **Mandatory QA:** Verify TypeScript compilation, loading/empty states, error boundaries, correct data propagation.
4. **Change Summary:** Document modified files, data flow impacts, UI testing points.

### B. Component Reuse (DRY)

- Search codebase before creating new UI components.
- Shared form components (`BilingualLabel`, `GenderSelector`, `LactatingToggle`, `WeightHintBadge`) must be reused — never duplicated.
- Add/Edit forms sharing fields MUST use the same constants, validation, dropdowns.
- Feature added to one form → check if the other needs parity.
- Dropdowns must include "No Data / Walang Data" where applicable.

### C. Key SSOT Data Flows

| Domain | SSOT Flow |
|--------|-----------|
| **Milk Revenue** | `milking_records` (sale) → DB trigger → `revenue_ledger` |
| **Animal Weight** | `weight_records` (latest) → DB trigger → `animals.current_weight_kg` |
| **OVR Scores** | records → `calculate_animal_ovr` trigger → `animal_ovr_cache` → hooks (server-side only) |
| **Feed Inventory** | `feeding_records` → `feed_inventory_id` + `cost_per_kg_at_time` (locked at consumption) |
| **Milk Feeding** | `milk_inventory` → FIFO → `feeding_records` (market price for good, ₱0 for rejected) |
| **Herd Investment** | `animals.purchase_cost` + `farm_expenses` + `feeding_records` (auto-calculated) |
| **Feed Stock Days** | Roughage inventory → `useFeedInventory` → survival buffer |
| **Parent Eligibility** | `animals` → gender + (birth_date null OR age ≥ 16 months) → dropdowns |
| **AI Father Detection** | `ai_records` → `useEditAnimalForm` → pre-populate father fields |
| **Cooperative** | `cooperative_memberships` → SECURITY DEFINER RPCs → hooks → dashboard |

### D. Cache Invalidation

All mutations must go through `CacheManager.invalidateForMutation()`. Cache dependency map in `src/lib/cacheManager.ts` must be updated when adding new data types.

---

## 4. Role-Based Access

- Four roles: **Owner**, **Manager** (`farmer_owner`), **Farmhand**, **Vet** (`is_vet()`).
- `useUnifiedPermissions()` = SSOT hook for feature visibility.
- One role per farm per user. RLS enforces farm-level isolation.
- `is_farm_manager()` checks `farm_memberships.role_in_farm` (NOT `user_roles`).

---

## 5. UI-Specific Rules

- **No piecemeal CSS fixes.** Trace full DOM hierarchy from viewport to affected element before changing CSS.
- **Test at the viewport where the bug occurs.** Mobile issue → verify at 390×844.
- **Never assume CSS works from code alone.** Browser is the source of truth.
- **Semantic design tokens only.** No raw `text-white`, `bg-black`. Use `--background`, `--foreground`, `--primary`, etc.
- **All colors in HSL.**

---

## 6. Governance Documents

| Document | Path | Update when... |
|----------|------|----------------|
| **Data Relationships Map** | `docs/data-relationships-map.md` | Schema, RLS, or sync logic changes |
| **SSOT Architecture** | `docs/ssot-architecture.md` | Data flow or component reuse changes |
| **Architecture** | `ARCHITECTURE.md` | System design changes |
| **Changelog** | `changelog.md` | Any significant change |

**No task is complete without verifying DRM consistency.**

---

## 7. Performance Standards

### Targets
- Performance Score: 75+
- FCP: <2.0s | LCP: <4.0s | TBT: <300ms | CLS: <0.05

### Mandatory Patterns
- Lazy-load all pages via `React.lazy()`
- Large deps in manual chunks (vendor splitting)
- `content-visibility: auto` for lists
- `loading="lazy"` on images
- Charts via `LazyRenderOnVisible`
- Dashboard data via combined RPC (`get_combined_dashboard_data`)
- Non-critical data via `requestIdleCallback`

### Review Triggers
- New table with >1000 expected rows → audit pagination & indexing
- New query joining 3+ tables → audit for N+1
- New dependency >50KB → add to manual chunks

---

## 8. Test Standards

### Coverage Gate
- Minimum 70% line coverage (enforced in CI)
- Every mutation hook must have at least one test for success + error paths
- Edge cases: empty states, null fields, permission denied, network failure

### Test Infrastructure
- Framework: Vitest + React Testing Library
- Providers wrapper: `renderWithProviders()` from `src/test-utils.tsx`
- CI: GitHub Actions → coverage report → threshold check

---

## 9. Security Checklist

- [ ] All new tables have RLS enabled
- [ ] RLS policies use `auth.uid()` — not trusting client-supplied user IDs
- [ ] Edge functions with `verify_jwt = false` have alternative auth (e.g., `x-cron-secret`)
- [ ] No SECURITY DEFINER functions without explicit access control
- [ ] Cooperative reads use SECURITY DEFINER RPCs (not direct table access)
- [ ] Storage buckets have appropriate policies
