# SSOT Architecture Reference

> **Living document** — Reflects Section 5 of the Core Operating Protocol.
> Must be kept in sync with `ARCHITECTURE.md`, `changelog.md`, and `/docs/data-relationships-map.md`.

Last updated: 2026-02-15

---

## 1. Dataset Dependency & Continuity Standards

Before modifying ANY field, function, or component, you MUST:

1. **Impact Analysis:** Trace the full data flow: `Table → RPC → Hook → Component`. Identify ALL consumers of the data you are changing.
2. **Connection Continuity:** Ensure backward compatibility. If you rename a column or change an RPC return shape, synchronize ALL downstream consumers (hooks, components, caches) in the SAME change.
3. **Mandatory QA:** Every change must verify: TypeScript compilation, loading/empty states, error boundaries, and correct data propagation through the chain.
4. **Change Summary:** Document modified files, data flow impacts, and specific UI testing points.

---

## 2. Component Reuse (DRY Principle)

- Before creating new UI components, **search the codebase** for existing components that serve the same purpose.
- Shared form components (e.g., `BilingualLabel`, breed selectors, `GenderSelector`, `LactatingToggle`, `WeightHintBadge`) must be reused — never duplicated.
- If the Add form and Edit form share fields, they MUST use the same constants, validation logic, and dropdown options (e.g., `availableBreeds`, `LIVESTOCK_BREEDS`, `getBreedsByLivestockType`).
- When adding a feature to one form (Add or Edit), check if the other form needs the same update for parity.
- All dropdowns must include a "No Data / Walang Data" option where applicable (per `ui/form-dropdown-standard` memory).

### Shared Components Inventory (Animal Forms)

| Component / Constant | Location | Used By |
|----------------------|----------|---------|
| `BilingualLabel` | `src/components/animal-form/BilingualLabel.tsx` | AnimalForm, EditAnimalDialog |
| `GenderSelector` | `src/components/animal-form/GenderSelector.tsx` | AnimalForm, EditAnimalDialog |
| `LactatingToggle` | `src/components/animal-form/LactatingToggle.tsx` | AnimalForm, EditAnimalDialog |
| `WeightHintBadge` | `src/components/animal-form/WeightHintBadge.tsx` | AnimalForm, EditAnimalDialog |
| `LIVESTOCK_BREEDS` / `getBreedsByLivestockType` | `src/components/animal-form/breedConstants.ts` | AnimalForm, EditAnimalDialog |
| `calculateMilkingStageFromDays` | `src/lib/animalStages.ts` | LactatingToggle, AnimalForm, useAnimalForm, useEditAnimalForm, RecordBulkMilkDialog |
| `AnimalAvatar` | `src/components/ui/animal-avatar.tsx` | AnimalDetails, AnimalList, AnimalCard, BioCard, AnimalProfile, ActivityDetailsDialog |

---

## 3. Key SSOT Data Flows

These are critical synchronized data paths. Breaking any link is a blocking bug:

| Domain | SSOT Flow |
|--------|-----------|
| **Milk Revenue** | `milking_records` (sale) → DB trigger → `revenue_ledger` |
| **Animal Weight** | `weight_records` (latest) → DB trigger → `animals.current_weight_kg` |
| **OVR Scores** | `milking/weight/bcs/health/ai records` → `calculate_animal_ovr` trigger → `animal_ovr_cache` |
| **Feed Inventory** | `feeding_records` → `feed_inventory_id` + `cost_per_kg_at_time` (cost locked at consumption) |
| **Herd Investment** | `animals.purchase_cost` + `farm_expenses` (manual) + `feeding_records` (auto-calculated) |
| **Feed Stock Days** | Roughage inventory only → `useFeedInventory` hook → survival buffer |
| **Parent Eligibility** | `animals` → filter by gender + (`birth_date` is null OR age >= 16 months) → mother/father dropdowns |
| **AI Father Detection** | `ai_records` (animal_id) → `useEditAnimalForm` → pre-populate `is_father_ai`, brand, reference, breed |

---

## 4. Governance Documents

| Document | Path | Purpose |
|----------|------|---------|
| **Data Relationships Map (DRM)** | `/docs/data-relationships-map.md` | Absolute source of truth for schema, RLS, and data flow. Must be updated on ANY schema, security, or sync logic change. |
| **Architecture** | `ARCHITECTURE.md` | Data hierarchies and system design. |
| **Changelog** | `changelog.md` | All significant changes logged. |
| **SSOT Architecture** | `/docs/ssot-architecture.md` | This file. Component reuse, data flow dependencies, governance rules. |

No task is complete without verifying DRM consistency with the implementation.

---

## 5. Role-Based Access (SSOT for Permissions)

- Four roles: **Owner**, **Manager** (`farmer_owner`), **Farmhand**, **Vet** (`is_vet()` helper).
- `useUnifiedPermissions()` is the SSOT hook for all feature visibility decisions in the UI.
- One role per farm per user. RLS policies enforce farm-level isolation.
- The `is_farm_manager()` SQL function checks `farm_memberships.role_in_farm` (NOT the global `user_roles` table).
