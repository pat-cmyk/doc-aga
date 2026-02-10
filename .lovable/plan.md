

# RLS Drift Remediation — Full Phased Plan

## Overview

This plan resolves **all findings** from the RLS drift scan in 4 phases, ordered by risk (security gaps first, then cleanup, then hardening). Each phase is a single DB migration + corresponding DRM update.

---

## Phase 1 — Security Gaps (Critical)

Fix missing policies and overly permissive access that could allow unintended data operations.

### 1A. Replace `milk_inventory` ALL policy with granular policies

The current single `ALL` policy (`can_access_farm(farm_id)`) lets farmhands DELETE inventory -- unintended.

- **Drop**: `"Users can access their farm's inventory"` (ALL)
- **Create**:
  - SELECT: `can_access_farm(farm_id)` -- all farm members can view
  - INSERT: `is_farm_owner() OR is_farm_manager() OR is_farmhand()` -- members can add
  - UPDATE: `is_farm_owner() OR is_farm_manager()` -- only owner/manager can adjust
  - DELETE: `is_farm_owner()` -- only owner can delete

### 1B. Add missing UPDATE policies for health tables

Vets can INSERT but cannot UPDATE their own records -- they should be able to correct entries.

| Table | Change |
|-------|--------|
| `health_records` | Add UPDATE policy: owner, manager, farmhand, **vet** |
| `injection_records` | Add UPDATE policy: owner, manager, farmhand, **vet** |
| `preventive_health_schedules` | Update existing UPDATE policy to include **vet** |

### 1C. Add vet INSERT on `health_symptom_categories`

Currently only owner/manager/farmhand can tag symptoms. Vets diagnosing animals need this too.

- **Drop** existing INSERT policy
- **Recreate** with vet added (via join: `health_record_id -> health_records -> animals.farm_id`)

### 1D. Add government SELECT on `injection_records`

Government users need vaccination data for compliance analytics. Currently missing.

- **Create**: `"government_view_injection_records"` SELECT policy using `has_role(auth.uid(), 'government')`

---

## Phase 2 — Missing Operation Policies (Medium)

Add DELETE and UPDATE policies where tables currently lack them, preventing owners from cleaning up their own data.

### 2A. Add DELETE policies

| Table | Who Can Delete | Enforcement |
|-------|---------------|-------------|
| `ad_campaigns` | Merchant owner | via `merchant_id -> merchants.user_id` |
| `ai_records` | Farm owner | via `animal_id -> animals.farm_id` |
| `animal_events` | Farm owner | via `animal_id -> animals.farm_id` |
| `animal_photos` | Farm owner/manager | via `animal_id -> animals.farm_id` |
| `daily_farm_checklists` | Farm owner | direct `farm_id` |
| `health_records` | Farm owner | via `animal_id -> animals.farm_id` |
| `injection_records` | Farm owner | via `animal_id -> animals.farm_id` |

### 2B. Add missing UPDATE policies

| Table | Who Can Update | Enforcement |
|-------|---------------|-------------|
| `animal_events` | Farm owner/manager | via `animal_id -> animals.farm_id` |
| `animal_photos` | Farm owner/manager | via `animal_id -> animals.farm_id` |

---

## Phase 3 — Duplicate Cleanup (Low Risk)

Drop redundant policies that add no security value but slow down policy evaluation.

| Table | Drop (Redundant) | Keep (Canonical) |
|-------|-------------------|------------------|
| `ad_campaigns` | `"Merchants create campaigns"` | `"Merchants can create campaigns"` |
| `ad_campaigns` | `"Merchants update campaigns"` | `"Merchants can update own campaigns"` |
| `ad_impressions` | `"Merchants view impressions"` | `"Merchants can view campaign impressions"` |
| `order_items` | `"Farmers insert order items"` | `"Farmers can insert order items"` |
| `order_items` | `"Order items visible to parties"` | `"Order items visible to order parties"` |
| `product_categories` | `"Categories visible to authenticated"` | `"Categories visible to all authenticated users"` |
| `test_results` | `"admins_view_test_results"` | `"Admins can view test results"` |
| `test_runs` | `"admins_view_test_runs"` | `"Admins can view test runs"` |

**Total**: 8 duplicate policies to drop.

---

## Phase 4 — Hardening and Consistency (Improvement)

### 4A. Fix `notifications` overlapping SELECT policies

Two SELECT policies exist:
- `"Users can view their own notifications"` -- includes farm_id membership check
- `"users_select_own_notifications"` -- simpler `auth.uid() = user_id`

**Resolution**: Drop the simpler one; keep the farm-aware version which is more restrictive and correct.

### 4B. Fix `stats_job_runs` inline query

Current policy uses a raw subquery against `user_roles` instead of the `has_role()` helper function. Replace with:

```sql
DROP POLICY "Admins can view stats job runs" ON stats_job_runs;
CREATE POLICY "Admins can view stats job runs" ON stats_job_runs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));
```

### 4C. Audit `TO public` vs `TO authenticated`

All current policies use `TO public` (Supabase default). While RLS checks like `auth.uid()` effectively require authentication, explicitly setting `TO authenticated` is a defense-in-depth measure. This is a low-priority improvement that could be done table-by-table over time.

**Recommendation**: Document as future improvement in the DRM but do not change now to avoid a massive migration touching all 150+ policies.

---

## DRM Updates (After Each Phase)

After each migration, update `/docs/data-relationships-map.md`:
- **Section 4** (RLS and Tenancy Rules): Update policy listings for all affected tables
- **Section 8** (Change Log): Add entry per phase with tables affected and policies changed
- **Section 9** (Open Questions): Remove resolved items, add any new findings

---

## Summary

| Phase | Scope | Policies Changed | Risk |
|-------|-------|-----------------|------|
| 1 | Security gaps | ~10 new/modified | Critical -- fix first |
| 2 | Missing DELETE/UPDATE | ~9 new | Medium -- data management gaps |
| 3 | Duplicate cleanup | 8 dropped | Low -- no behavior change |
| 4 | Hardening | 2 replaced + documentation | Low -- consistency |

**Total**: ~29 policy operations across 4 phases.

---

## Testing Points (Per Phase)

- **Phase 1**: Test vet can update health/injection records; test farmhand CANNOT delete milk inventory; test government can view injection records
- **Phase 2**: Test farm owner can delete their own AI records, animal events, health records; test non-owners cannot delete
- **Phase 3**: Verify no regressions on ad campaigns, order items, product categories, test results
- **Phase 4**: Verify notifications still filter correctly; verify stats_job_runs visible to admins only

