# CLAUDE.md — Doc Aga Project Instructions

> Auto-loaded into every Claude session. These rules are mandatory and non-negotiable.

## Project Overview

Doc Aga is an offline-first livestock farm management PWA for Filipino farmers. Built with React 18 + TypeScript + Vite + Tailwind/shadcn + Supabase + Capacitor (Android/iOS).

## Core Operating Protocol

**PRIMARY DIRECTIVE:** Optimism is forbidden. Operate with "Zero Trust" in your own code execution. You have permission to consume extra steps/credits to verify your work.

**DETAILED REFERENCE:** Before any non-trivial implementation, read `docs/enhanced-governance-protocol.md` and follow the Pre-Coding Review Framework (Section 2). That document is the canonical reference for review stages, test standards, performance targets, security checklists, and issue presentation format.

### Verification Loop (Always Active)

A task is ONLY complete when proven via **Baseline → Execute → Verify**:
- **Baseline:** SELECT query (data) or screenshot at target viewport (UI) BEFORE changes.
- **Execute:** Apply fix. If multi-step fix fails midway → STOP and report partial state.
- **Verify:**
  - Data: Run verification SELECT. Unexpected results → report "FIX FAILED".
  - UI (MANDATORY for visual/layout/CSS): Navigate to affected viewport → screenshot → confirm fix. If issue persists → "FIX FAILED", diagnose, iterate.
- **Governance (FINAL step):** Update `docs/data-relationships-map.md`, `changelog.md`, or `docs/ssot-architecture.md` as applicable. Skipping = incomplete.

---

## SSOT Architecture (Always Active)

Before modifying ANY field, function, or component: trace `Table → RPC → Hook → Component`. Synchronize ALL downstream consumers in the SAME change.

### Key Data Flows

| Domain | Flow |
|--------|------|
| Milk Revenue | `milking_records` (sale) → DB trigger → `revenue_ledger` |
| Animal Weight | `weight_records` (latest) → DB trigger → `animals.current_weight_kg` |
| OVR Scores | records → `calculate_animal_ovr` trigger → `animal_ovr_cache` (server-side only) |
| Feed Inventory | `feeding_records` → `feed_inventory_id` + `cost_per_kg_at_time` (locked at consumption) |
| Milk Feeding | `milk_inventory` → FIFO → `feeding_records` (market price for good, ₱0 for rejected) |
| Herd Investment | `animals.purchase_cost` + `farm_expenses` + `feeding_records` (auto-calculated) |
| Feed Stock Days | Roughage inventory → `useFeedInventory` → survival buffer |
| Parent Eligibility | `animals` → gender + (birth_date null OR age ≥ 16 months) → dropdowns |
| AI Father Detection | `ai_records` → `useEditAnimalForm` → pre-populate father fields |
| Cooperative | `cooperative_memberships` → SECURITY DEFINER RPCs → hooks → dashboard |

### Read Paths

| Category | Pattern | Cache? |
|----------|---------|--------|
| **A — Farm-level** | IndexedDB cache first → Supabase if online → update cache | Yes (7-day grace) |
| **B — Government/Regional** | Online-only, no local cache (RLS boundary) | No |
| **C — Cooperative** | Online-only via SECURITY DEFINER RPCs | No |

### Cache Rules

- All mutations go through `CacheManager.invalidateForMutation()` (`src/lib/cacheManager.ts`)
- All cache getters use `isCacheUsable(lastUpdated)` helper (`src/lib/dataCache.ts`) — never gate on connectivity directly
- New farm-level read hooks must follow the cache-first pattern: add `getCached*` / `update*Cache` in `dataCache.ts` and register in `CacheManager.CACHE_DEPENDENCIES`
- **NEVER use `navigator.onLine` directly** — unreliable on Android WebView. Use `getIsOnline()` (non-React) or `useOnlineStatus()` (React hook), which use active connectivity probing via `connectivitycheck.gstatic.com`

---

## Reuse Rules (Always Active)

Search the codebase before creating ANY new component, hook, or utility. Reuse is mandatory.

### Shared Components (must reuse, never duplicate)

| Component | Location |
|-----------|----------|
| `BilingualLabel` | `src/components/animal-form/BilingualLabel.tsx` |
| `GenderSelector` | `src/components/animal-form/GenderSelector.tsx` |
| `LactatingToggle` | `src/components/animal-form/LactatingToggle.tsx` |
| `WeightHintBadge` | `src/components/animal-form/WeightHintBadge.tsx` |
| `AnimalAvatar` | `src/components/ui/animal-avatar.tsx` |
| 70+ shadcn/ui components | `src/components/ui/` |

### SSOT Hooks (use these, don't create alternatives)

| Hook | Purpose | Location |
|------|---------|----------|
| `useUnifiedPermissions()` | Feature visibility (SSOT for all roles) | `src/contexts/PermissionsContext.tsx` |
| `useOnlineStatus()` | Connectivity state (React) | `src/hooks/useOnlineStatus.ts` |
| `getIsOnline()` | Connectivity state (non-React) | `src/hooks/useOnlineStatus.ts` |
| `useOptimisticMutation()` | Mutations with conflict detection | `src/hooks/useOptimisticMutation.ts` |
| `useSendCooldown()` | Chat input debounce | `src/lib/chatUtils.ts` |

### Key Utilities (use these, don't recreate)

| Utility | Purpose | Location |
|---------|---------|----------|
| `CacheManager.invalidateForMutation()` | Cache invalidation for ALL mutations | `src/lib/cacheManager.ts` |
| `isCacheUsable()` | SSOT cache validity check | `src/lib/dataCache.ts` |
| `calculateLifeStage()` / `calculateMilkingStage()` | Animal lifecycle | `src/lib/animalStages.ts` |
| `showErrorToastLegacy()` | Error toast display | `src/lib/errorHandling.ts` |
| `truncateMessages()` | Chat message windowing | `src/lib/chatUtils.ts` |
| `renderWithProviders()` | Test wrapper | `src/test-utils.tsx` |
| `findOfflineFaqMatch()` | Offline FAQ matching | `src/lib/faqCache.ts` |

### Form Parity Rule

Add/Edit forms sharing fields MUST use the same constants, validation, and dropdowns. Feature added to one form → check the other for parity.

---

## Permissions (Always Active)

- Four roles: **Owner**, **Manager** (`farmer_owner`), **Farmhand**, **Vet** (`is_vet()`)
- `useUnifiedPermissions()` is the SSOT hook for all feature visibility
- One role per farm per user. RLS enforces farm-level isolation
- `is_farm_manager()` checks `farm_memberships.role_in_farm` (NOT global `user_roles`)

---

## UI Rules (Always Active)

- No piecemeal CSS. Trace full DOM hierarchy first
- Test at the viewport where the bug occurs (mobile = 390×844)
- Browser is source of truth — never assume CSS works from code alone
- Semantic design tokens only (no raw `text-white`/`bg-black`). Use `--background`, `--foreground`, `--primary`, etc.
- All colors in HSL
- Taglish (Tagalog + English) for farmer-facing UI. See `TAGLISH_LANGUAGE_GUIDE.md`

---

## Build & Test Commands

```bash
npm run dev          # Dev server (port 8080)
npm run build        # Production build
npm run test         # Run tests once
npm run test:watch   # Tests in watch mode
npm run test:coverage # Tests with coverage report
npm run lint         # ESLint
npx cap sync android # Sync with Android
npx cap open android # Open in Android Studio
```

### CI Pipeline (`.github/workflows/test.yml`)

- Node 20, `npm ci`, lint (non-blocking), test with coverage, 10% threshold gate

---

## Mobile (Capacitor)

- App ID: `com.goldenforage.docaga`
- Web dir: `dist`
- Android scheme: HTTPS
- `navigator.onLine` is unreliable on Android WebView — **NEVER use directly**. Use `getIsOnline()` or `useOnlineStatus()` hook, which use active connectivity probing (singleton fetch to `connectivitycheck.gstatic.com/generate_204` with `no-cors` mode)
- `capacitor-native-settings@8.0.0` — Required for "Open Settings" button in permission dialogs (opens system app settings so users can grant denied permissions)

---

## Governance Documents

| Document | Path | Update when... |
|----------|------|----------------|
| Data Relationships Map | `docs/data-relationships-map.md` | Schema, RLS, or sync logic changes |
| SSOT Architecture | `docs/ssot-architecture.md` | Data flow or component reuse changes |
| Enhanced Governance Protocol | `docs/enhanced-governance-protocol.md` | Review framework or standards changes |
| Architecture | `ARCHITECTURE.md` | System design changes |
| Changelog | `changelog.md` | Any significant change |

**No task is complete without verifying governance doc consistency.**
