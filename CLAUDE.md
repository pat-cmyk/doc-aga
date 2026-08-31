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
- **Commit & Push (ALWAYS):** After every completed edit, commit and push immediately. Do not batch changes across tasks — each logical change gets its own commit + push. Never leave uncommitted work.

---

## SSOT Architecture (Always Active)

Before modifying ANY field, function, or component: trace `Table → RPC → Hook → Component`. Synchronize ALL downstream consumers in the SAME change.

### Key Data Flows

| Domain | Flow |
|--------|------|
| Milk Revenue | `milking_records` (sale) → `RecordMilkSaleDialog` / DB trigger `sync_milk_sale_to_revenue` → `farm_revenues` (source: `REVENUE_SOURCE_KEYS.MILK_SALE`) |
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
| `BilingualLabel` | `src/components/ui/bilingual-label.tsx` |
| `GenderSelector` | `src/components/animal-form/GenderSelector.tsx` |
| `LactatingToggle` | `src/components/animal-form/LactatingToggle.tsx` |
| `WeightHintBadge` | `src/components/ui/weight-hint-badge.tsx` |
| `AnimalAvatar` | `src/components/ui/animal-avatar.tsx` |
| App shell (header/nav/back/bootstrap) | `src/components/shell/` — new farmer screens go INSIDE the `FarmShell` layout route; nav items are SSOT in `shell/routes.ts` (see `docs/ssot-architecture.md` §3.7) |
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
| `toTimestamptz()` | SSOT timestamp for Supabase `timestamptz` columns (NEVER use naive `format()`) | `src/lib/dateUtils.ts` |
| `formatPHTime()` / `formatPHDate()` / `formatPHDateAndTime()` | Timezone-safe PH display (Intl-based) | `src/lib/dateUtils.ts` |

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
- Semantic design tokens only (no raw `text-white`/`bg-black`, no raw palette like `bg-green-500`). Status colors: `success`/`warning`/`info`/`heat`/`breeding` (+`-soft` variants); stage badges via `getLifeStageBadgeColor()`. CI enforces a ratchet (`npm run check:colors`) — raw-color count may only go DOWN, and `src/components/shell/` must stay at zero
- All colors in HSL
- Touch targets: Button default is 48px (`lg` 56px). `compact`/`icon-sm` are ONLY for dense desktop/admin contexts — never on farmer-facing mobile screens
- Bilingual labels: **English primary, Tagalog secondary** (decision 2026-08-31; matches farmers' FB/GCash literacy). Prefer `<BilingualLabel k="fieldKey" />` reading `src/lib/filipinoLabels.ts`; inline slash strings are "English / Tagalog". Conversational content (Doc Aga chat, briefs, voice hints) may be natural Taglish. `TAGLISH_LANGUAGE_GUIDE.md` covers VOICE/STT only, not UI copy

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

## Supabase Backend (Lovable Cloud)

The backend runs on **Supabase hosted via Lovable Cloud**. Claude Code does NOT have direct CLI access to deploy Edge Functions or run migrations. All backend operations must go through one of these paths:

### Deployment Paths

| Operation | How to Do It |
|-----------|-------------|
| **SQL migrations** | Copy the SQL from `supabase/migrations/` and run it in the **Supabase Dashboard → SQL Editor** (https://supabase.com/dashboard/project/sxorybjlxyquxteptdyk/sql) |
| **Edge Function deploys** | Ask the user to relay to **Lovable** — Lovable auto-deploys Edge Functions from `supabase/functions/<name>/index.ts` |
| **Schema changes** (tables, columns, RLS) | Write migration SQL file, then instruct user to run in SQL Editor or relay to Lovable |
| **Database queries** (debugging) | Use the preview server's authenticated session via Supabase REST API, or instruct user to run in SQL Editor |
| **Secrets / env vars** | Ask user to relay to Lovable — secrets are managed in Lovable Cloud |

### What Claude Code CANNOT Do Directly

- `supabase functions deploy` — CLI token lacks project access (Lovable-managed)
- `supabase db push` — Same restriction
- `supabase link` — Config has `[auth.password]` section incompatible with CLI v2.78+
- Direct database connections (no psql access)

### What Claude Code CAN Do

- Write migration SQL files in `supabase/migrations/`
- Write/edit Edge Function code in `supabase/functions/<name>/index.ts`
- Write SQL backfill scripts and instruct user to run them in SQL Editor
- Query data via the Supabase REST API using the anon key through the preview server
- Run `npm run build` / `npm run test` to verify frontend changes

### Supabase Credentials

| Variable | Value |
|----------|-------|
| Project ID | `sxorybjlxyquxteptdyk` |
| Supabase URL | `https://sxorybjlxyquxteptdyk.supabase.co` |
| Anon Key | In `.env` as `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable, safe for frontend) |
| Service Role Key | Stored as Lovable Cloud secret (NOT accessible to Claude Code) |

### Edge Functions (32 deployed)

All in `supabase/functions/<name>/index.ts`. Most use `verify_jwt = false` in `config.toml` (JWT validated in code instead). Key functions:

| Function | Purpose |
|----------|---------|
| `doc-aga` | AI veterinary chatbot |
| `calculate-daily-stats` | Daily farm statistics aggregation (nightly cron) |
| `seed-demo-data` | Demo data generation (daily cron) |
| `recalculate-animal` | Per-animal stage recalculation |
| `process-farmer-feedback` | AI-powered feedback categorization |
| `rico` | General AI assistant |

### Key Architectural Rules (Supabase-specific)

- **Never edit** `src/integrations/supabase/client.ts` or `types.ts` — auto-generated by Lovable
- **Never edit** `.env` — auto-managed by Lovable
- **Never modify** `project_id` or `[auth.*]` sections in `supabase/config.toml` — Lovable-managed. Function-level config (e.g. `verify_jwt = false`) is fine to add.
- **RLS is mandatory** on every new table unless the table is explicitly public-facing. Super-admin/service-role escape hatches go through `SECURITY DEFINER` RPCs, not open policies.
- **Never use `as any`** casts on Supabase types. If the auto-generated `types.ts` is stale after a new migration, work around it narrowly (e.g. a typed interface at the call site) and document why in a comment — do not silence the whole call site.
- Roles use `has_role(user_id, role)` SECURITY DEFINER function
- Farm access uses `can_access_farm(farm_id)` function
- Government access uses `has_government_access()` function
- Edge functions use Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) — no external API keys needed

### Standard Workflow for Backend Changes

1. **Write the code** — migration SQL + Edge Function TypeScript
2. **Commit & push** — so changes are in the repo
3. **Instruct user** — provide the exact SQL to run in SQL Editor, or tell them to ask Lovable to deploy the Edge Function
4. **Verify** — use the preview server to confirm data flows correctly

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

---

## Available Custom Skills

- `/write-report <type> [audience] [topic]` — Drafts formal documents, briefs, and
  pitch materials using Golden Forage conventions and audience-appropriate tone.
- `/review-pr [file-or-branch] [focus?]` — Reviews code changes against Doc Aga
  architecture rules (offline-first, SSOT, data accuracy, component reuse).
- `/simplify` — Built-in: reviews and auto-fixes recent code changes for quality and
  efficiency using parallel review agents.
