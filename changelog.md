# Changelog

## 2026-03-10 — Fix: Pregnancy Status Display Uses fertility_status as SSOT

### Fixed
- **AnimalDetails.tsx** — `hasActiveAI` now derived from `animals.fertility_status` (DB trigger SSOT) instead of `ai_records` timestamps. Expected delivery date guarded on `fertility_status === 'confirmed_pregnant'` with fallback to `breeding_events.metadata`.
- **useAnimalDetails.ts** — Same `hasActiveAI` and `expectedDeliveryDate` SSOT fix for the animal details hook.
- **dataCache.ts** — `buildAnimalWithStageData()` derives `hasActiveAI` from `fertility_status` instead of querying `ai_records`. Removes one Supabase query per animal during cache build.

### Added
- **breedingEventBridge.ts** — `confirmPregnancyWithAISync()` helper syncs both `ai_records` (pregnancy_confirmed, expected_delivery_date) and `breeding_events` when confirming pregnancy via lifecycle button. Data hygiene: clears `ai_records.pregnancy_confirmed` on `pregnancy_failed` and `heat_return` events.
- **BreedingEventActions.tsx** — `ConfirmPregnancyButton` now uses `confirmPregnancyWithAISync()` to match legacy `ConfirmPregnancyDialog` behavior. Accepts `livestockType` for species-specific gestation calculation.

### Architecture
- **SSOT**: `animals.fertility_status` (set by DB trigger `update_animal_fertility_status` on `breeding_events` insert) is now the single source of truth for all pregnancy/breeding display logic across AnimalDetails, AnimalList, and animal cache.
- **Dual-path parity**: Both legacy `ConfirmPregnancyDialog` and new `ConfirmPregnancyButton` produce identical data state in `ai_records` + `breeding_events`.

## 2026-03-10 — Animal Profile: Complete CRUD for All Tabs

### Added
- **Health Delete** — `DeleteHealthRecordDialog.tsx` + Trash2 button in `HealthTimeline.tsx`. Hard delete from `health_records`.
- **Weight Delete** — `DeleteWeightRecordDialog.tsx` + Trash2 button in `WeightRecords.tsx`. Manually updates `animals.current_weight_kg` to next-latest record after delete (DB trigger only fires on INSERT/UPDATE).
- **Feeding Delete** — `DeleteFeedingRecordDialog.tsx` + Trash2 button in `FeedingRecords.tsx`. Reverses `feed_inventory.quantity_kg` when deleting records that consumed from stock.
- **Breeding Delete** — `DeleteBreedingEventDialog.tsx` + Trash2 button in `BreedingTimeline.tsx`. Scoped to `breeding_events` only (legacy `heat_records`/`ai_records` excluded via ID prefix check).
- **Photo Upload** — `UploadPhotoDialog.tsx` using `CameraPhotoInput`, milestone type selector, label, date picker. Compresses via shared `imageUtils.ts`.
- **Photo Edit** — `EditPhotoDialog.tsx` for metadata (label, milestone_type, taken_at).
- **Photo Delete** — `DeletePhotoDialog.tsx` removes from Supabase Storage + DB row.
- **Expense Edit** — `EditAnimalExpenseDialog.tsx` + `useEditAnimalExpense()` hook + Pencil button in `AnimalExpenseTab.tsx`. Mirrors Add dialog with pre-populated form.

### Refactored
- **`compressImage()`** extracted from `RecordSingleHealthDialog.tsx` and `AddHealthRecordDialog.tsx` into shared `src/lib/imageUtils.ts`.
- **`PhotoTimelineTab.tsx`** rewritten to accept `farmId` and `readOnly` props, wire Upload/Edit/Delete dialogs.
- **`BreedingTimeline.tsx`** now accepts `readOnly` prop, passed from `AIRecords.tsx`.

### Architecture
- All delete dialogs follow `DeleteMilkRecordFromProfileDialog` pattern: AlertDialog confirmation → haptic warning → Supabase hard delete → query invalidation.
- All action buttons guarded by `!readOnly` (flows from `AnimalDetails.tsx` permission check).
- Delete buttons disabled when offline (`!isOnline`).

## 2026-03-09 — Fix Timezone: Enforce PH Time (UTC+8) for All Timestamps

### Added
- **`src/lib/dateUtils.ts`** (NEW) — SSOT utility for timestamp handling. `toTimestamptz(date)` wraps `date.toISOString()` for correct UTC storage. `formatPHTime()`, `formatPHDate()`, `formatPHDateAndTime()` use `Intl.DateTimeFormat` with `timeZone: 'Asia/Manila'` for guaranteed PH display regardless of browser timezone.
- **`src/lib/__tests__/dateUtils.test.ts`** (NEW) — Unit tests covering ISO 8601 output, PH timezone formatting, and midnight boundary cases.

### Fixed
- **8-hour timestamp offset in feed recordings.** `RecordSingleFeedDialog`, `RecordBulkFeedDialog`, and `EditFeedingRecordDialog` used `format(date, "yyyy-MM-dd'T'HH:mm:ss")` which strips timezone info. Supabase interpreted the naive string as UTC, causing entries at 7:58 PM PHT to display as "Mar 10, 3:58 AM". Now uses `toTimestamptz()` → `"2026-03-09T11:58:00.000Z"` (correct UTC).

### Architecture
- **SSOT pattern:** `toTimestamptz()` is now the ONLY acceptable way to create timestamps for `timestamptz` columns. All other creation paths (milking, health, weight, heat detection, activity confirmation) already used `.toISOString()` correctly — only the 3 feed recording dialogs had the bug.
- **No display-side mass refactor.** The 40+ `format(new Date(value), pattern)` display calls use browser timezone, which is correct for PH users once creation timestamps are fixed. `formatPH*()` functions exist for future gradual adoption on non-PH devices.

## 2026-03-09 — Barn & Paddock: Add Delete Option

### Added
- **`DeleteBarnDialog.tsx`** (NEW) — Confirmation dialog showing barn name, type, and animal count warning. Uses AlertDialog with destructive styling (same pattern as `DeleteMilkRecordDialog`).
- **`useDeleteBarn()`** hook in `useBarns.ts` — Soft-deletes barn (`is_active = false`), clears active animal assignments first. Supports offline via optimistic cache update + queue.
- **Delete button** in `BarnListView.tsx` → `BarnCard` — Red trash icon next to edit pencil, only visible when `!readOnly`.
- **`'barn_delete'`** offline queue type + `syncBarnDelete()` handler in `syncService.ts`.
- **`'delete'`** action in `updateLocalBarn()` in `dataCache.ts` — Removes barn from cached array for instant UI feedback.

### Architecture
- Soft-delete via `is_active = false` preserves data history. `useBarns` already filters `.eq('is_active', true)`.
- Animal assignments cleared before deactivation. `animals.current_barn_id` SET NULL via FK constraint.

## 2026-03-06 — Milk Sale: Enforce Species-Level Sales

### Changed
- **`MilkStockList.tsx`:** Removed the generic "Record Sale" button that mixed all species in one FIFO queue. Sales are now exclusively triggered from per-species cards ("Sell Cattle", "Sell Goat", etc.), ensuring FIFO operates within a single species and the correct species-specific price is pre-filled.
- **`MilkSpeciesSummary.tsx`:** Species cards now render even while price data is loading (graceful fallback to "No price history"). Previously gated on `pricesBySpecies` being loaded.
- **`RecordMilkSaleDialog.tsx`:** `filterSpecies` is now required (always a string, never null). Dialog title always shows species name (e.g., "Record Cattle Milk Sale"). Removed dead code for mixed-species fallback.

### Fixed
- **UX bug:** Users clicking the prominent "Record Sale" button would sell milk from all species mixed together at a single price. Goat milk (₱45/L) would be sold at cattle price (₱30/L) or ₱0 when no price history existed. Now each species is sold separately at its own price.

### Architecture
- **No new components or hooks.** All species-level infrastructure already existed (`MilkSpeciesSummary`, `filterSpecies` prop, `useLastMilkPriceBySpecies`). Fix was removing the bypass path that let users skip species selection.

## 2026-03-06 — Voice Training: Taglish Essential 17

### Changed
- **`voiceTrainingPhrases.ts`:** Added `tier: 'essential' | 'extended'` field to `TrainingPhrase` interface. 17 curated Taglish phrases marked essential (covering all 11 categories: daily-activities, measurements, health, breeding, sales, financial, questions, emergency, feed, records, polite/conversational). Remaining 54 phrases marked extended. Added `getEssentialPhrases()` and `getExtendedPhrases()` helper functions.
- **`VoiceTrainingSession.tsx`:** Replaced 4-tab language filter (All/English/Tagalog/Taglish) with 2-tab tier filter: "Essential (17)" (default) and "All Phrases (71)". Farmers now see only 17 Taglish phrases by default during onboarding.
- **`VoiceTrainingOnboarding.tsx`:** Fixed stale copy — updated from "16 short phrases in English and Tagalog" to "17 Taglish phrases". Description now in Taglish. Timing updated to "5-8 minutes".

### Fixed
- **DB bug:** `voice_training_samples.language` CHECK constraint only allowed `'english' | 'tagalog'` but code stores `'taglish'` — all Taglish sample INSERTs were failing. Migration adds `'taglish'` to constraint.

### Architecture
- **SSOT:** `voiceTrainingPhrases.ts` remains single source of truth for all phrases. New `tier` field is the discriminator — no separate arrays, no duplication.
- **Backward compatible:** Extended phrases remain available. Existing voice training samples unaffected.

## 2026-03-06 — Farm Category Selector (Ruminant / Swine / Poultry)

### Added
- **`src/lib/farmCategories.ts`** (NEW SSOT utility) — `FarmCategory` type, `FARM_CATEGORIES` array with emoji/bilingual labels/enabled flags, `getFarmCategoryLabel()` for display, `getDefaultAnimalType()` for breed dropdown fallback.
- **Farm category card selector** in FarmSetup.tsx — Replaces species-level dropdown with 3 visual cards: Ruminant (active, with checkmark), Swine (disabled, "Coming Soon" badge), Poultry (disabled, "Coming Soon" badge). Each card shows emoji, English + Filipino labels, and species subtitle. Follows GenderSelector visual pattern.
- **SQL migration** (`20260306120000_farm_category_ruminant.sql`) — Adds `'ruminant'` to `farms.livestock_type` CHECK constraint. Updates `create_default_farm` RPC default from `'cattle'` to `'ruminant'`.
- **Taglish labels** in `filipinoLabels.ts` — Added `farmCategory`, `ruminant`, `swine`, `poultry` labels and livestock emojis.

### Changed
- **FarmSetup.tsx:** Default `livestock_type` changed from `"cattle"` to `"ruminant"`. Removed `livestockDescriptions` constant. Label changed from "Livestock Type" to "Farm Category / Uri ng Farm".
- **EditFarmDialog.tsx:** Added `<SelectItem value="ruminant">Ruminant</SelectItem>` to admin farm edit dropdown.
- **AdminAnimalDialog.tsx:** Breed dropdown fallback now uses `getDefaultAnimalType(farm?.livestock_type)` — maps `'ruminant'` → `'cattle'` for breed list.
- **FarmDetailPanel.tsx, UserDetailPanel.tsx, SeedDemoDataButton.tsx, Profile.tsx:** Replaced `capitalize` CSS with `getFarmCategoryLabel()` for proper display of both new category values and legacy species values.

### Architecture
- **Backward compatible:** Existing farms with `'cattle'`/`'goat'`/`'sheep'`/`'carabao'` continue to display correctly. `getFarmCategoryLabel()` handles both new and legacy values.
- **Animal-level unaffected:** `animals.livestock_type` (60+ files) remains `'cattle'|'goat'|'sheep'|'carabao'`. Only `farms.livestock_type` gains the `'ruminant'` category.
- **SSOT:** Single `farmCategories.ts` utility consumed by all 6 display points + FarmSetup.

## 2026-03-06 — Admin View Farm Audit (6 gaps)

### Fixed
- **Gap 1 (Critical):** BreedingHub completely missing from Operations tab — admin could not see any breeding data (statuses, actions, heat predictions, delivery forecasts, analytics).
- **Gap 2 (Medium):** BarnListView missing from Animals tab — admin could not see barn/paddock organization of animals.
- **Gap 3 (Medium):** More tab had flat layout instead of organized sub-tabs (Approvals, Government).
- **Gap 4 (Required):** BreedingHub lacked `readOnly` prop — Record Heat and Schedule AI write buttons would have been visible to admin. Added `readOnly` prop to hide write actions/dialogs and `onViewAnimal` callback for cross-tab navigation.
- **Gap 5 (Required):** BarnListView and BarnAnimalManager lacked `readOnly` prop — Add Barn, Edit Barn, Add Animal, and Remove Animal buttons would have been visible to admin.
- **Gap 6 (Low):** FarmDashboard and FinanceTab cross-tab navigation callbacks were not wired — animal links in FarmDashboard and finance data completeness links now navigate within admin view instead of breaking out.

### Changed
- **AdminViewFarm.tsx:** Restructured to match farmer Dashboard.tsx — Operations now has 3 sub-tabs (Milk Inventory, Feed Stock, Breeding), Animals tab includes BarnListView above AnimalList in Card wrapper, More tab has 2 sub-tabs (Approvals, Government).
- **BreedingHub.tsx:** Added `readOnly` and `onViewAnimal` props. When readOnly: hides Record Heat/Schedule AI buttons, skips rendering write dialogs, passes undefined for write callbacks to BreedingActionCard.
- **BarnListView.tsx:** Added `readOnly` prop. When readOnly: hides Add button, hides Edit (Pencil) button on BarnCard, skips rendering BarnFormDialog, passes readOnly through to BarnAnimalManager.
- **BarnAnimalManager.tsx:** Added `readOnly` prop. When readOnly: hides add-animal dropdown row and remove (X) buttons.

### Architecture
- **SSOT compliance:** Zero new hooks, components, or utilities created. All changes reuse existing farmer dashboard components (`BreedingHub`, `BarnListView`, `BarnAnimalManager`) with readOnly props. All hooks (`useBreedingHub`, `useBarns`, `useBarnAnimals`, `useFarmAnimals`) accept farmId and work across both views.

## 2026-03-05 — Government Dashboard Chart Upgrades & Manual

### Changed
- **SentimentTrendChart:** Converted from stacked bar chart to stacked area chart with SVG gradient fills — smoother, more polished look matching farmer dashboard style.
- **GovTrendCharts:** Converted Farm Growth and Health Events from line charts to area charts with gradient fills. Added SVG gradients to Livestock Composition stacked areas.
- **MilkProductionBySpeciesChart:** Added SVG gradient definitions for Cattle, Goat, Carabao area fills.
- **BreedingSuccessChart:** Added horizontal gradient fills to bar chart cells.
- **MortalityAnalyticsCard:** Converted flat pie to donut chart with softer cell styling and background stroke separation.
- **BCSDistributionChart:** Refined donut chart with increased padding angle and cell opacity.

### Added
- **Government Dashboard User Manual** (`docs/government-dashboard-manual.md`) — Comprehensive guide for government employees covering all 3 tabs, metric definitions, computation methods, filter usage, glossary, and FAQ.
- **Download Manual button** — Added to the government dashboard welcome banner and RICO FAB. Generates and downloads the full user manual as a formatted PDF via jsPDF.

## 2026-03-05 — Government Dashboard Audit (8 gaps)

### Fixed
- **Gap 1 (P0):** `useDashboardStats` animal count missing `exit_date IS NULL` filter — farm dashboard showed exited animals, inflating count vs government dashboard.
- **Gap 2 (P0):** `useGovernmentHealthStats` mapped `vaccination_count` to both `scheduled_vaccinations` AND `completed_vaccinations`. Now correctly maps all 22 RETURNS TABLE columns from `get_government_health_stats` RPC including exit breakdown, BCS detail, and deworming stats.
- **Gap 3 (P0):** `useGrantEffectiveness` missing `exit_date IS NULL` filter — Grant Effectiveness panel showed 92 animals instead of 97, inconsistent with Grant Distribution on the same tab.
- **Gap 5 (P1):** `get_government_milk_analytics` and `get_farm_compliance_metrics` RPCs referenced non-existent `mr.milking_date` column — fixed to `mr.record_date`.
- **Gap 6 (P1):** Mortality rate denominator used `active_animals_only`, excluding animals that died during the period and inflating the rate. Fixed to `active + deaths_in_period`.
- **Gap 7 (P1):** `get_government_stats` health_stats CTE counted health events for soft-deleted animals. Added `a.is_deleted = false` filter.
- **Gap 8 (P2):** `useGovernmentHealthStats` exit breakdown (sold/died/culled/transferred/slaughtered) was hardcoded to 0. Now maps from RPC which already computes them.

### Added
- **Gap 4 (P2):** `GrantDistributionCard` now shows "Total Active Animals" count above the grant/purchased headline boxes, plus color-coded legend dots matching the bar chart segments.

### SQL Migration
- `supabase/migrations/20260305100000_gov_dashboard_audit_fixes.sql` — Must be applied via Supabase dashboard. Restores comprehensive `get_government_health_stats` RPC (was overwritten by simplified version in earlier migration), fixes `milking_date` → `record_date`, adds `is_deleted` filter to health stats, corrects mortality denominator.

### Files Modified
- `src/components/farm-dashboard/hooks/useDashboardStats.ts` — Gap 1
- `src/hooks/useGovernmentHealthStats.ts` — Gaps 2, 8
- `src/hooks/useGrantEffectiveness.ts` — Gap 3
- `src/components/government/GrantDistributionCard.tsx` — Gap 4
- `supabase/migrations/20260305100000_gov_dashboard_audit_fixes.sql` — Gaps 5, 6, 7, 8

## 2026-03-05 — Finance Audit Gaps 4, 6, 7, 9, 10

### Added
- **RevenueList component (Gap 4)** — Full CRUD for revenues mirroring ExpenseList. Columns: Date, Source (with icon), Notes, Amount. System-generated revenues (milk/animal sales) show "Auto" badge and are edit/delete protected.
- **`useUpdateRevenue()` and `useDeleteRevenue()` hooks** — Soft delete (`is_deleted = true`), cache invalidation via CacheManager.
- **Edit mode in AddRevenueDialog** — Pre-populates form, conditionally calls update vs add, source field disabled for system-generated revenues.
- **Offline finance support (Gap 9)** — IndexedDB `expensesCache` + `revenuesCache` stores (DB version 7→8). Cache-first hooks: offline serves from IndexedDB with client-side date filtering; online fetches from Supabase and updates cache.
- **Offline indicator** — "Offline — showing saved data" banner with WifiOff icon in both ExpenseList and RevenueList when offline.
- **Date-range pagination (Gap 10)** — `useExpenses` and `useRevenues` accept optional `dateRange` for server-side `.gte()/.lte()` filtering. FinanceTab threads its date range to both lists.

### Changed
- **Currency formatting SSOT (Gap 6)** — Eliminated 11 local `formatCurrency` functions and 3 local `formatCompact` functions across 14+ files. All now import from `src/lib/currency.ts` (`formatPHP`, `formatPHPCompact`). Philippine Peso is the single currency for the entire app.
- **DateRange consolidation (Gap 7)** — Removed 10 duplicate `interface DateRange` declarations across components and hooks. All now import from `FinanceDateRangePicker.tsx`.
- **ExpenseList** now uses `formatPHP()` instead of inline `₱` + `toLocaleString()`.

### Files Modified
- `src/lib/dataCache.ts` — DB version 8, new `expensesCache`/`revenuesCache` stores, 6 new cache functions
- `src/lib/cacheManager.ts` — Registered `clearExpensesCache`/`clearRevenuesCache` in switch
- `src/hooks/useExpenses.ts` — Cache-first pattern, dateRange param
- `src/hooks/useRevenues.ts` — Cache-first pattern, dateRange param, `useUpdateRevenue`, `useDeleteRevenue`
- `src/components/finance/RevenueList.tsx` — NEW: Full CRUD list with offline indicator
- `src/components/finance/ExpenseList.tsx` — dateRange prop, offline indicator, formatPHP
- `src/components/finance/AddRevenueDialog.tsx` — Edit mode support
- `src/components/FinanceTab.tsx` — RevenueList integration, dateRange threading
- 14 files — Currency formatting consolidated to `formatPHP`/`formatPHPCompact`
- 10 files — DateRange import consolidated to FinanceDateRangePicker

## 2026-03-05 — Gap 5: Accrual-Basis Financial Report with Inventory

### Changed
- **Downloadable report now uses accrual-basis for feed costs** — "Feed & Supplements" (cash-basis, when purchased) replaced with "Feed Consumed (Accrual)" (when actually fed, from `feeding_records.cost_per_kg_at_time × kilograms`). Falls back to cash-basis with a note if no feeding records exist.
- **Financial ratios (ROI, breakeven price) now use accrual costs** — more accurate for bank assessment. Cash flow section stays cash-basis (standard accounting).
- **Report sections renumbered** from 7 to 8 sections to accommodate the new inventory section.
- **Data completeness score expanded** from 8 to 11 criteria (adds feeding records, feed inventory, milk inventory checks). Existing scores may decrease — intentional signal to improve data quality.

### Added
- **New Section 3: Current Assets & Inventory** in both PDF and CSV reports:
  - **Feed Inventory**: grouped by category (concentrates, roughage, minerals, supplements) with quantity and value from `feed_inventory` table
  - **Milk Inventory (Good Quality)**: valued at species-specific market prices (cattle ₱30/L, goat ₱45/L, carabao ₱35/L, sheep ₱50/L or last sale price)
  - **Rejected Milk**: shown separately at ₱0 value (feed-only)
  - **Total Current Assets** summary line
- **Accrual cost metadata** in Cost Structure section: shows both accrual (consumed) and cash (purchased) feed amounts for transparency
- **Dialog preview**: Current Assets summary card showing feed + milk inventory values
- **3 new data completeness checks**: Feeding Records, Feed Inventory, Milk Inventory

### Files Modified
- `src/lib/financialReportGenerator.ts` — New interfaces (`CurrentAssets`, `AccrualCostStructure`, `FeedInventoryAsset`, `MilkInventoryAsset`), 4 new fetch functions, `processAccrualCostStructure` (replaces `processCostStructure`), `processCurrentAssets`, updated `assessDataCompleteness` (11 criteria), accrual ratios
- `src/lib/financialReportExport.ts` — New Section 3 (Current Assets) in PDF + CSV, accrual notes, renumbered sections 3→8, 3 new checklist items
- `src/components/finance/FinancialCapacityReport.tsx` — Current Assets summary card, 3 new checklist items in dialog preview

### Architecture Notes
- Dashboards remain cash-basis (no changes to `useFinancialHealth`, `useProfitability`, `useRevenueExpenseComparison`)
- Report generator uses plain async functions for data fetching (not React hooks) to match existing pattern
- Milk pricing replicates `useLastMilkPriceBySpecies()` logic as `fetchMilkPrices()` async function

## 2026-03-04 — Finance P0: Revenue Source SSOT + Milk Revenue Misclassification Fix

### Fixed
- **CRITICAL: Milk revenue classified as "Other Revenue" in Breakeven Dashboard** — `RecordMilkSaleDialog` and `syncService` wrote `source: "Milk Sales"` (plural) but `useProfitability` checked for `"Milk Sale"` (singular). 100% of milk sales fell into `otherRevenue`. Now all paths use `REVENUE_SOURCE_KEYS.MILK_SALE`.
- **Expense filter inconsistency** between `useFinancialHealth` (`.neq("Personal")`) and `useProfitability` (client-side filter for `"Operational"` only). The hero card and Breakeven Dashboard showed different expense totals. Both now use `.neq("allocation_type", "Personal")` at the DB level.

### Added
- **`src/lib/revenueCategories.ts`** — SSOT constants file for revenue source names (like `expenseCategories.ts` for expenses). Exports `REVENUE_SOURCES`, `REVENUE_SOURCE_KEYS`, `getRevenueSourceIcon()`.
- **SQL migration** (`20260304130000_standardize_revenue_sources.sql`): Updates existing `"Milk Sales"` → `"Milk Sale"`, `"Livestock Sales"` → `"Animal Sale"`, adds CHECK constraint matching SSOT, updates `fix_missing_milk_revenues` RPC and `sync_milk_sale_to_revenue` trigger.

### Files Modified
- `src/lib/revenueCategories.ts` — NEW: SSOT for revenue sources
- `src/hooks/useProfitability.ts` — Use `REVENUE_SOURCE_KEYS`, align expense filter with `useFinancialHealth`
- `src/components/finance/AddRevenueDialog.tsx` — Import from SSOT, remove local `REVENUE_SOURCES` and `getSourceIcon`
- `src/components/finance/QuickActionsBar.tsx` — Use `REVENUE_SOURCE_KEYS` for default sources
- `src/components/milk-inventory/RecordMilkSaleDialog.tsx` — Use `REVENUE_SOURCE_KEYS.MILK_SALE`
- `src/lib/syncService.ts` — Use `REVENUE_SOURCE_KEYS.MILK_SALE`
- `src/components/dashboard/OnboardingChecklist.tsx` — Use `REVENUE_SOURCE_KEYS.MILK_SALE`
- `supabase/migrations/20260304130000_standardize_revenue_sources.sql` — Data migration + RPC + trigger fix

## 2026-03-04 — Breeding Hub: "Not Ready" Catch-All (Include Males in Total)

### Changed
- **Breeding Hub now shows ALL animals** (`useBreedingHub.ts`): Removed `.ilike('gender', 'female')` filter. Males land in "Not Ready" stat — hub total now matches Animals tab total (no more 9-vs-10 confusion for farmers).
- **Subtitle updated** (`BreedingHub.tsx`): Changed from `X babae / females` to `X hayop / animals (Y breeding eligible)`.
- **"Not Ready" description** updated to "Males, too young, or not yet ready / Lalaki, masyadong bata, o hindi pa handa" — reflects catch-all scope.
- **"Not Ready" badge** shows male count (e.g., "1 lalaki / male") for transparency.
- **Male indicator in drill-down dialog** (`BreedingStatusAnimalList.tsx`): Males show ♂ symbol + blue "♂ Lalaki" badge instead of fertility status badge.
- **Optimized record queries**: AI/heat record fetches use `femaleAnimalIds` only — males have no breeding records, so no wasted queries.

### Files Modified
- `src/hooks/useBreedingHub.ts` — Remove female filter, add `gender` + `maleCount`, male early-return in stats loop
- `src/components/breeding/BreedingHub.tsx` — Subtitle, "Not Ready" badge + description
- `src/components/breeding/BreedingStatusAnimalList.tsx` — Male ♂ indicator in drill-down list

## 2026-03-04 — Breeding Journey Audit: 11 Gaps Fixed (Data Integrity, Offline, UX)

### Fixed
- **"Bred" box double-counting bug** (`BreedingHub.tsx`): `pregCheckDue` is a SUBSET of `bredWaiting` — adding both inflated the count. Now shows `bredWaiting + suspectedPregnant` with a badge for preg-check-due count.
- **Hub subtitle misleading** (`BreedingHub.tsx`): Changed from generic count to `X babae / females (Y breeding eligible)` — immediately clarifies why count differs from total animals.
- **"Not Ready" description said "or male"** in females-only hub context: Overridden to "Not yet ready to breed / Hindi pa handa mag-breed".
- **Edit form parent dropdown ignored age rule** (`useEditAnimalForm.ts`): Replaced inline query with SSOT `animalCache.ts` — same 16-month minimum as Add form.
- **Non-return button had no timing guard** (`BreedingEventActions.tsx`): Added 18-day minimum post-AI guard with bilingual warning. Disabled confirm button when too early.
- **Post-calving heat prediction gap** (`useBreedingHub.ts`): Animals `open_cycling` with no heat history now get VWP fallback prediction from `last_calving_date + VWP_DAYS[livestock_type]`.

### Added
- **Breeding events offline cache** (`dataCache.ts`, `BreedingTimeline.tsx`): `breeding_events` added to `RecordCache` in IndexedDB. Timeline renders from cache when offline.
- **Breeding event offline queue** (`offlineQueue.ts`, `syncService.ts`): `breeding_event` type in offline queue. `syncBreedingEvent()` calls `insertBreedingEvent()` on reconnect.
- **Audio/haptic feedback** on all breeding dialogs: `RecordHeatDialog`, `RecordCalvingDialog`, `ScheduleAIDialog`, `BreedingEventActionDialog` now play success chime + haptic notification.
- **Pre-select animal for AI scheduling** (`BreedingHub.tsx`, `FarmScheduleAIDialog.tsx`): Clicking "Schedule AI" from an in-heat action card pre-selects that animal and skips to the form step.
- **Structured bull breed field** (`ScheduleAIDialog.tsx`): New `Bull Breed` input auto-formats into notes as `Brand: X | Breed: Y` for reliable AI father detection.
- **Species-specific VWP migration** (`20260304120000_species_specific_vwp.sql`): DB trigger now uses `CASE livestock_type WHEN goat/sheep THEN 45 ELSE 60 END` instead of hardcoded 60 days.

### Files Modified
- `src/components/breeding/BreedingHub.tsx` — Fixed "Bred" count, subtitle, "Not Ready" desc, pre-select AI
- `src/components/breeding/BreedingHubStatCard.tsx` — Added `badge` prop
- `src/components/animal-details/hooks/useEditAnimalForm.ts` — SSOT parent cache
- `src/components/breeding/BreedingEventActions.tsx` — Non-return guard, offline queue, audio/haptic
- `src/components/AIRecords.tsx` — Pass `lastAIDate` to non-return button
- `src/lib/dataCache.ts` — `breeding` in RecordCache, parallel fetch, batch delta
- `src/lib/cacheManager.ts` — `breeding-event` cache dependencies
- `src/components/breeding/BreedingTimeline.tsx` — Offline cache fallback
- `src/lib/offlineQueue.ts` — `breeding_event` queue type
- `src/lib/syncService.ts` — `syncBreedingEvent()` handler
- `src/hooks/useBreedingHub.ts` — VWP fallback for heat prediction
- `src/components/heat-detection/RecordHeatDialog.tsx` — Audio/haptic
- `src/components/breeding/RecordCalvingDialog.tsx` — Audio/haptic
- `src/components/ScheduleAIDialog.tsx` — Audio/haptic, bull breed field
- `src/components/breeding/FarmScheduleAIDialog.tsx` — `preselectedAnimalId` prop
- `supabase/migrations/20260304120000_species_specific_vwp.sql` — New migration

## 2026-03-04 — Farmer Journey Audit: Sign-up to First Sale

### Added
- **Offline milk sales**: `RecordMilkSaleDialog` now works fully offline. FIFO cache deductions happen instantly, sale is queued for server sync on reconnect. `syncMilkSale()` in syncService handles inventory updates, milking_record sale flags, and revenue record creation with idempotent `linked_milk_log_id` check. Cache rollback on permanent failure restores inventory.
- **Progressive onboarding checklist**: New `OnboardingChecklist` component on FarmDashboard guides new farmers through 5 steps: add animal, record milking, check inventory, record sale, view earnings. Steps auto-complete based on data presence and localStorage visit flags. Dismissible with persistent state.
- **Post-milking success sheet**: After recording milk (bulk or single), a bottom sheet shows contextual next actions: "View Inventory", "Record Sale", "Record Another", or "Done". Follows the `AddAnimalSuccessScreen` pattern with Taglish labels.
- **Audio confirmation on record save**: `playSound('success')` chime added to milk recording (bulk/single) and milk sale dialogs on successful submit, complementing existing haptic feedback.

### Changed
- **Animal success screen actions wired**: "Record First Milk", "Record Weight", "Schedule AI", "Add Photo" buttons in `AddAnimalSuccessScreen` now navigate to the animal's profile page (via `/?animalId=<id>`) instead of silently returning to herd.

### Files Modified
- `src/lib/offlineQueue.ts` — Added `milk_sale` queue type with FIFO deduction + revenue payload
- `src/lib/syncService.ts` — Added `syncMilkSale()`, dispatch, and rollback for permanent failures
- `src/components/milk-inventory/RecordMilkSaleDialog.tsx` — Added offline branch, cache invalidation, audio feedback
- `src/components/dashboard/OnboardingChecklist.tsx` — New progressive onboarding component
- `src/components/FarmDashboard.tsx` — Integrated OnboardingChecklist after DashboardStats
- `src/components/milk-recording/MilkRecordSuccessScreen.tsx` — New post-milking success sheet
- `src/components/milk-recording/RecordBulkMilkDialog.tsx` — Added success screen, audio feedback
- `src/components/milk-recording/RecordSingleMilkDialog.tsx` — Added success screen, audio feedback
- `src/components/AnimalForm.tsx` — Wired success screen action callbacks to navigate to animal profile

## 2026-03-03 — Unified Health Timeline (Merge Records + Preventive)

### Changed
- **Replaced tabbed Health UI with unified timeline**: The animal profile Health tab no longer has sub-tabs (Records / Preventive). Instead, a single chronological timeline merges health visits and preventive care events, following the same pattern as the Breeding Timeline.
- **Health Timeline component**: New `HealthTimeline.tsx` displays all health events (visits, vaccinations, dewormings) grouped by month with icon-coded entries (stethoscope for visits, syringe for vaccinations, bug for deworming), date badges, and relative time labels.
- **Urgent alerts at top**: Overdue, due-today, and due-tomorrow preventive schedules appear as alert banners at the top with inline Complete/Skip action buttons.
- **Add dropdown**: Single "+ Add" button with dropdown for Health Record, Vaccination Schedule, or Deworming Schedule.
- **Controlled dialog mode**: `AddPreventiveHealthDialog` now supports controlled `open`/`onOpenChange` props for programmatic opening from the timeline dropdown.

### Files Modified
- `src/components/health-timeline/HealthTimeline.tsx` — New unified timeline component
- `src/components/HealthRecords.tsx` — Simplified to delegate to HealthTimeline when farmId + livestockType available
- `src/components/preventive-health/AddPreventiveHealthDialog.tsx` — Added controlled mode props

## 2026-03-03 — True Offline Milk Feeding (Good + Rejected) with Offline Pricing

### Added
- **Offline milk feeding for good and rejected stock**: `FeedMilkToAnimalDialog` now works fully offline. When offline, FIFO cache deductions happen instantly, an optimistic feeding record is persisted to IndexedDB, and the operation is queued for server sync on reconnect.
- **Milk price offline cache**: `useLastMilkPriceBySpecies` caches per-species milk prices to localStorage after each successful fetch. Offline milk feedings use cached prices for accurate opportunity cost calculation.
- **Rejected milk offline cache**: `useMilkInventory` caches rejected milk items to IndexedDB after fetch. Offline fallback loads cached rejected stock so farmers can feed rejected milk without connectivity.
- **Sync function for milk feeding**: `syncMilkFeeding()` in syncService inserts `feeding_records` with `client_generated_id` for idempotency, updates `milk_inventory` rows per FIFO deduction, and rolls back cache on permanent failure.
- **Cache rollback on sync failure**: `rollbackMilkInventoryDeduction()` restores `liters_remaining` and `is_available` for each deducted item if sync permanently fails.
- **Offline animal list fallback**: Dialog loads cached animals from IndexedDB when the online animal query returns empty.

### Files Modified
- `src/lib/offlineQueue.ts` — Added `milk_feeding` queue type with FIFO deduction payload
- `src/lib/dataCache.ts` — Added `rollbackMilkInventoryDeduction()`, `updateMilkPriceCache()`/`getCachedMilkPrices()`, `updateRejectedMilkCache()`/`getCachedRejectedMilk()`
- `src/lib/cacheManager.ts` — Added `milk-feeding` cache dependency entry
- `src/hooks/useRevenues.ts` — Cache milk prices to localStorage after successful query
- `src/hooks/useMilkInventory.ts` — Cache rejected milk after fetch, offline fallback for rejected stock
- `src/lib/syncService.ts` — Added `syncMilkFeeding()` dispatch and rollback on failure
- `src/components/milk-inventory/FeedMilkToAnimalDialog.tsx` — Offline branch with optimistic records, queue, cached animal/price fallbacks

## 2026-03-03 — Data Sync Optimization for 2G/3G Bandwidth

### Changed
- **Delta sync for animals**: `updateAnimalCache()` checks a local sync checkpoint. On subsequent syncs, only animals with `updated_at > lastSync` are fetched (including soft-deleted/exited for cache removal). First sync is still a full fetch. Estimated 80-95% bandwidth reduction on reconnect.
- **Delta sync for records**: `updateRecordsCacheBatch()` accepts optional `farmId` parameter. When a records checkpoint exists, fetches only records with `updated_at > lastSync` across all 6 record types, then merges into existing cache via `mergeRecordsById()` instead of replacing.
- **Delta sync for feed inventory**: `updateFeedInventoryCache()` checks a feed_inventory checkpoint. On delta, fetches only items with `last_updated > lastSync`, merges by ID, and preserves `dailyConsumption` from last full sync (avoids extra animals query).
- **Batch record queries**: Replaced per-animal record caching loop (N×6 HTTP requests) with `updateRecordsCacheBatch()` that makes just 6 farm-level queries using `.in('animal_id', allIds)`. For a 50-animal farm, this reduces 300 round trips to 6.
- **Explicit column selection**: Replaced all `select('*')` in cache update functions with explicit column lists (`ANIMAL_SELECT_COLUMNS`, `MILKING_RECORD_COLUMNS`, etc.). Drops unused columns for ~20-30% payload reduction per query.
- **Record date windowing**: Milking records limited to 6 months, feeding to 3 months, weight/health to 12 months. AI and heat records fetched in full (small datasets, critical for breeding predictions).
- **Adaptive sync for 2G connections**: Probe RTT classified as `fast` (<300ms), `slow` (300-1500ms), `2g` (>1500ms), or `offline`. On 2G, `preloadAllData()` and `refreshAllCaches()` skip feed inventory and farm data (deferred to next fast connection). Animals + records always sync (essential for offline use).
- **Connection quality estimation**: `probeConnectivity()` measures RTT via `performance.now()`. New exports: `getConnectionQuality()` and `getLastProbeRTT()`.
- **Animal interface updated**: Added breeding/fertility fields, barn/lactation fields, and sync metadata to the `Animal` type.

### Technical Details
- Column constants defined as joined strings for efficient PostgREST query building
- `computeAnimalStages()` extracted as shared function for full and delta sync paths
- `computeFeedSummary()` extracted for reuse across full and delta feed paths
- `mergeRecordsById()` helper: merges server changes into existing cache by ID (update existing + append new)
- Delta sync uses `offlineFirstCache.ts` checkpoint system (`getCheckpoint`/`updateCheckpoint`) with IndexedDB-backed storage
- Batch function uses IndexedDB transaction for atomic per-animal writes
- Gzip/Brotli verified active on Supabase Cloud (Cloudflare CDN, `vary: Accept-Encoding`)
- RTT thresholds based on typical latencies: Wi-Fi/4G <300ms, 3G 300-1500ms, 2G >1500ms

### Files Modified
- `src/lib/dataCache.ts` — Column constants, delta sync for animals/records/feed, batch queries, date windowing, adaptive sync in `preloadAllData()` and `refreshAllCaches()`, `mergeRecordsById()`, `computeFeedSummary()`
- `src/hooks/useOnlineStatus.ts` — `ConnectionQuality` type, RTT measurement in `probeConnectivity()`, `getConnectionQuality()` and `getLastProbeRTT()` exports

## 2026-03-03 — Fix Permission Retry, Offline Breeding Hub, Offline FAB Actions

### Fixed
- **Camera/Notification permission retry failure (P1)**: After granting camera or notification permission in system settings, tapping "Retry" still showed denied. Capacitor's `requestPermissions()` returns a cached denial after the OS dialog is dismissed. Fixed by calling `checkPermissions()` first to detect real-time system state.
- **Breeding Hub shows all zeros offline (P1)**: All stats displayed "0" when offline because the hook only used direct Supabase queries with no cache fallback. Added cache-first pattern: derives breeding stats from already-cached animals (with fertility fields) and per-animal AI/heat records in IndexedDB.
- **FAB recording actions disappear offline (P1)**: All recording actions (milk, feed, health, BCS, add animal) hidden offline because the permission fetch failed and cleared all roles to empty arrays. Added localStorage cache for user permissions — restores cached permissions instead of clearing on fetch failure.

### Changed
- `src/hooks/useDevicePermissions.ts` — `checkPermissions()` before `requestPermissions()` for camera and notifications.
- `src/hooks/useBreedingHub.ts` — Cache-first pattern with `getCachedAnimals()` + `getCachedRecords()` offline fallback.
- `src/lib/dataCache.ts` — Added `heat: any[]` to RecordCache, fetches `heat_records` in `updateRecordsCache()`.
- `src/lib/cacheManager.ts` — Added `'breeding-hub'` to animal, ai-record, heat-record, pregnancy-confirm dependency lists.
- `src/contexts/PermissionsContext.tsx` — Caches permissions in localStorage after successful fetch; restores from cache on offline failure; initializes state from cache to prevent flash of empty permissions.

## 2026-03-03 — Fix White Screen on Android

### Fixed
- **White screen on Android launch (P0)**: `vite.config.ts` marked `capacitor-native-settings` as `external` (Rollup won't bundle it). After commit `fb8f87e` changed `openAppSettings.ts` to a static import, the production build left a bare `import ... from "capacitor-native-settings"` in the main JS chunk. Android WebView has no runtime module resolver for bare specifiers → import fails → JS execution stops → React never mounts → white screen. Fixed by removing `capacitor-native-settings` from the `external` array so Rollup bundles its JS code (just `registerPlugin()` + enum definitions).

### Changed
- `vite.config.ts` — Removed `'capacitor-native-settings'` from `build.rollupOptions.external`.

## 2026-03-03 — Doc Aga Offline FAQ Mode + Fix Permissions

### Fixed
- **"Open Settings" button does nothing (P0)**: `openAppSettings.ts` used `import(/* @vite-ignore */ 'capacitor-native-settings')` which Vite does NOT bundle — the dynamic import silently failed at runtime in the WebView (no module resolver). Changed to static import so the JS side is bundled correctly. All 4 permission dialogs (Camera, Mic, Location, Notifications) now open system settings when tapped.
- **Notification permission never prompts on Android 13+ (P0)**: `POST_NOTIFICATIONS` permission was missing from `AndroidManifest.xml`. Required for Android 13 (API 33+) to show the notification permission dialog.
- **Doc Aga completely disabled offline (P1)**: All inputs (text, voice, image) were disabled when offline, even though a complete offline FAQ matching system (`findOfflineFaqMatch()`) already existed. Enabled text input offline — users can now type questions and get FAQ answers. Voice and image remain disabled (need internet for transcription/upload).

### Changed
- `src/lib/openAppSettings.ts` — Static import of `NativeSettings`, `AndroidSettings`, `IOSSettings` from `capacitor-native-settings` (replaces broken dynamic import).
- `android/app/src/main/AndroidManifest.xml` — Added `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`.
- `src/components/DocAga.tsx` — Text input and send button enabled offline. Banner changed from "requires internet" to "FAQ mode offline". No-match fallback updated with bilingual message.
- `src/components/farmhand/DocAgaConsultation.tsx` — Added offline FAQ fallback (was completely online-only). Same banner, input, and placeholder updates. Added `refreshFaqCache()` on online.

## 2026-03-02 — True Offline-First Mutations for All Record Types

### Fixed
- **Offline records only queued, not persisted (P0)**: Recording milking/feeding/health/weight/BCS/pregnancy while offline only updated in-memory React Query cache (lost on reload) and queued for sync. Now all record types persist to IndexedDB immediately via `addOptimisticRecords()`, ensuring data survives app restarts. Dashboards and computations work entirely from local data.
- **"Queued for Sync" messaging felt provisional (P1)**: All 10 recording dialogs showed "Queued for Sync" toast title and "Queue for Sync" button text, making offline recording feel like a degraded experience. Changed to positive confirmations ("✅ Feed Recorded", "✅ Health Recorded", etc.) with subtitle "Syncs automatically when online". Buttons now show the same label online and offline (e.g. "Record Feed").
- **Dashboard feed chart ignored local feed data (P1)**: `useCombinedDashboardData` only merged local pending milk data with server data. Feed chart showed 0 after offline recording until sync. Added same `Math.max()` merge logic for feed data.

### Added
- `addLocalFeedRecord()` in `dataCache.ts` — Persists feed totals to IndexedDB dashboard cache (daily feed kg + animal count).
- `deductLocalFeedInventory()` in `dataCache.ts` — Deducts feed from local inventory cache for instant stock updates.
- `addLocalHealthEvent()` in `dataCache.ts` — Increments dashboard health event counter in IndexedDB.
- `updateLocalAnimalWeight()` in `dataCache.ts` — Updates animal's `current_weight_kg` in local animals cache.
- `incrementLocalPregnantCount()` in `dataCache.ts` — Increments pregnant count and decrements pending confirmation in dashboard cache.

### Changed
- `RecordBulkFeedDialog.tsx` / `RecordSingleFeedDialog.tsx` — Now call `addOptimisticRecords()` + `addLocalFeedRecord()` + `deductLocalFeedInventory()` before queuing.
- `RecordBulkHealthDialog.tsx` / `RecordSingleHealthDialog.tsx` / `AddHealthRecordDialog.tsx` — Now call `addOptimisticRecords()` + `addLocalHealthEvent()` before queuing.
- `RecordSingleWeightDialog.tsx` — Now calls `addOptimisticRecords()` + `updateLocalAnimalWeight()` before queuing.
- `RecordBulkBCSDialog.tsx` — Now calls `addOptimisticRecords()` before queuing. Added `'bcs'` to type union.
- `ConfirmPregnancyDialog.tsx` — Now calls `incrementLocalPregnantCount()` before queuing.
- `useCombinedDashboardData.ts` — Merges local pending feed data with server feed data using `Math.max()`.
- `dataCache.ts` — Extended `addOptimisticRecords()` type union to include `'bcs'`. Added `bcs: any[]` to `RecordCache` interface.
- All 10 dialog files — Removed "Queue for Sync" / "Queuing..." button variants; buttons now show consistent labels regardless of online state.

## 2026-03-02 — Fix Permissions, Reliable Connectivity Probing, SW Cache Staleness

### Fixed
- **Android permissions not grantable (P0)**: `capacitor-native-settings` package was NOT installed despite `openAppSettings.ts` importing it. The "Open Settings" button in all 4 permission dialogs (Camera, Mic, Location, Notifications) silently failed, preventing users from granting permissions via system settings. Installed `capacitor-native-settings@8.0.0` — plugin now registered in Android Gradle build.
- **Unreliable offline detection on Android WebView (P0)**: Re-implemented active connectivity probing using a fundamentally different approach than the previous attempt (which probed Supabase REST API and hit CORS/API-key issues). New approach uses Google's `connectivitycheck.gstatic.com/generate_204` with `mode: 'no-cors'` — immune to CORS issues, zero body bytes, same endpoint Android itself uses for captive portal detection.
- **Stale Service Worker serving old code after APK update (P1)**: New SW activation handler now explicitly deletes all non-workbox runtime caches (animals-cache, records-cache, feed-cache) to prevent stale API data surviving across APK updates. Added forced `registration.update()` on every app launch and periodic re-check (60s interval) in `main.tsx` to ensure new SW is detected immediately.

### Changed
- `src/hooks/useOnlineStatus.ts` — Singleton active probe using `no-cors` fetch to Google's connectivity endpoint. Probes every 30s while online, 10s while offline. Pauses when app hidden (saves battery). Both `useOnlineStatus()` hook and `getIsOnline()` accessor share the same singleton state.
- `src/main.tsx` — Added `registration.update()` on SW registration + 60s periodic interval to force SW version checks.
- `src/sw.ts` — Activate handler now clears all non-workbox runtime caches before calling `clients.claim()`.
- `package.json` — Added `capacitor-native-settings@8.0.0` dependency + `postinstall` script for AGP 9 compatibility patch.
- `scripts/patch-capacitor-native-settings.js` — Postinstall patch replaces deprecated `proguard-android.txt` with `proguard-android-optimize.txt` in the plugin's `build.gradle` (required for AGP 9.0.1+).
- `android/build.gradle` — Comment noting the postinstall patch for capacitor-native-settings ProGuard compatibility.

## 2026-03-02 — Revert Connectivity to navigator.onLine + Fix Offline Barn Creation

### Fixed
- **Reverted active connectivity probing**: Active `HEAD` probing unreliable on Android WebView. Reverted `useOnlineStatus.ts` to passive `navigator.onLine` + browser events. `getIsOnline()` SSOT accessor preserved — 50+ consumers unchanged.
- **Offline barn creation broken (P1)**: Mutation hooks (`useCreateBarn`, `useUpdateBarn`, `useAssignAnimalToBarn`, `useRemoveAnimalFromBarn`) captured `isOnline` at render time via closure. Going offline after form render sent mutations down the online path, failing silently. Fixed by calling `getIsOnline()` at execution time inside each `mutationFn`.

### Changed
- `src/hooks/useOnlineStatus.ts` — Removed active probing singleton; reverted to `navigator.onLine` with passive events.
- `src/hooks/useBarns.ts` — All 4 mutation hooks now call `getIsOnline()` inside `mutationFn` instead of using stale hook value.

## 2026-03-02 — Fix: Connectivity Probe Missing API Key + Sync Sheet Navigation

### Fixed
- **App stuck permanently offline (P0)**: The active connectivity probe (`HEAD /rest/v1/`) was missing the `apikey` header, causing 401 responses without CORS headers. The browser treated these as network errors, permanently setting `getIsOnline() = false`. Added `apikey` header to `checkConnectivity()` — all 50+ SSOT consumers automatically restored.
- **No back button on Sync Status sheet**: Added explicit `ArrowLeft` close button in `SheetHeader` for mobile navigation.

### Changed
- `src/hooks/useOnlineStatus.ts` — Added `apikey` header to connectivity probe fetch call.
- `src/components/sync/SyncStatusSheet.tsx` — Added `SheetClose` with `ArrowLeft` icon in header.

## 2026-03-02 — Active Connectivity Probing (Android Offline Fix)

### Fixed
- **WiFi indicator stays green offline (P0)**: Replaced passive `navigator.onLine` with active HEAD request probing to the backend every 10s. Android WebView's unreliable `online`/`offline` events no longer cause false "online" state.
- **Cache grace periods now work on Android**: All 10+ `navigator.onLine` checks in `dataCache.ts` replaced with `getIsOnline()` from the active probing module. Stale cache is correctly served when truly offline.

### Changed
- `useOnlineStatus` hook now uses singleton active ping (HEAD to backend, 5s timeout, 10s interval). Pauses when tab/app is hidden to save battery.
- Exported `getIsOnline()` function for non-React code (dataCache, syncService, offlineQueue, etc.).
- Replaced `navigator.onLine` in 10 files: `dataCache.ts`, `offlineQueue.ts`, `offlineAudioSyncProcessor.ts`, `UserEmailDropdown.tsx`, `BarnFormDialog.tsx`, `BarnAnimalManager.tsx`, `voice-input-button.tsx`, `useVoiceRecording.ts`.

## 2026-03-02 — Offline-First: Barn Management, Animal List, Profile

### Fixed
- **Animal List Offline (P0)**: `getCachedAnimals()` and `getCachedRecords()` now include `OFFLINE_GRACE_PERIOD` (7-day stale-cache fallback when offline). Animals no longer disappear when cache TTL expires while disconnected.
- **Profile Button Offline (P0)**: `UserEmailDropdown` now caches user email and name in `localStorage` via `getCachedUserProfile()` / `setCachedUserProfile()`. Shows cached data instead of infinite "Loading..." when offline.

### Added
- **Offline Barn Creation**: `useCreateBarn` generates optimistic local barn with temp UUID and queues `barn_create` for sync.
- **Offline Barn Editing**: `useUpdateBarn` applies optimistic updates to local cache and queues `barn_update` with conflict detection on sync.
- **Offline Barn Animal Assignment**: `useAssignAnimalToBarn` adds assignment to local cache, increments barn count, updates `current_barn_id` in animals cache, queues `barn_assign`.
- **Offline Barn Animal Removal**: `useRemoveAnimalFromBarn` marks assignment removed locally, decrements count, clears `current_barn_id`, queues `barn_remove`.
- **Barn Assignments Cache**: New `barnAssignmentsCache` store in IndexedDB v7 with `getCachedBarnAssignments()`, `updateBarnAssignmentsCache()`, `updateLocalBarnAssignment()`.
- **Cache-First `useBarnAnimals`**: Now checks IndexedDB first, resolves animal details from `getCachedAnimals()`, falls back to database when online.
- **Barn Sync Processors**: Four new processors in `syncService.ts`: `syncBarnCreate`, `syncBarnUpdate` (with `checkAndHandleConflict`), `syncBarnAssign` (with dedup), `syncBarnRemove`.
- **Offline Queue Types**: `barn_create`, `barn_update`, `barn_assign`, `barn_remove` added to `QueueItem.type` union.
- **UI Feedback**: Barn components show "Saved locally, will sync when online" toast when operating offline.

### Changed
- `src/lib/dataCache.ts`: IndexedDB bumped to v7 (new `barnAssignmentsCache` store). Added helper functions `updateLocalBarn()`, `updateLocalAnimalBarn()`.
- `src/lib/cacheManager.ts`: `barn` dependency now includes `barn-assignments` with `clearBarnAssignmentsCache` handler.
- `src/lib/localStorage.ts`: Added `getCachedUserProfile()` / `setCachedUserProfile()`.

### SSOT Compliance
- **Group Feeding**: Works offline automatically — `barn:` prefix selection resolves animals via `current_barn_id` from animals cache. No changes needed to feeding logic.
- All mutations route through `CacheManager.invalidateForMutation('barn', farmId)`.
- Server-side triggers (`trg_barn_assignment_insert`, `trg_barn_assignment_removal`) reconcile `current_barn_id` on sync.
- Conflict detection framework (`checkAndHandleConflict`) applied to barn UPDATE operations.

## 2026-03-02 — P0/P1: Doc Aga & RICO Enterprise Hardening

### Added
- **Conversation Persistence (P0)**: `conversationId` now persists in `localStorage` with TTL (24h for DocAga/RICO, 1h for Consultation). Page refresh no longer loses chat context. New "New Chat" button in DocAga and RICO headers.
- **Sliding Window Context (P0)**: `truncateMessages()` in `src/lib/chatUtils.ts` caps messages sent to AI at 20 (first user message + last 19) to prevent token overflow. Applied to all 3 chat components.
- **Client-Side Send Cooldown (P1)**: `useSendCooldown()` hook enforces 2-second debounce between sends across all chat components. Complements existing server-side rate limiting (15 req/60s).
- **Prompt Injection Guard (P1)**: `sanitizeUserMessage()` in `supabase/functions/_shared/sanitizeMessage.ts` strips injection patterns (`[SYSTEM]`, `<|system|>`, `Ignore previous instructions`, etc.) from user messages before AI processing. Applied to both `doc-aga` and `rico` edge functions.

### Changed
- `src/lib/localStorage.ts`: Extended with `getConversationId()`, `resetConversationId()`, `CONVERSATION_KEYS`, `CONVERSATION_TTLS`
- `src/components/DocAga.tsx`: Uses persistent conversation ID, truncation, cooldown, "New Chat" button
- `src/components/farmhand/DocAgaConsultation.tsx`: Same utilities applied
- `src/components/government/RicoChat.tsx`: Same utilities applied
- `supabase/functions/doc-aga/index.ts`: Imports and applies `sanitizeUserMessage()` to `transformedMessages`
- `supabase/functions/rico/index.ts`: Same sanitization applied

### SSOT Compliance
- No new RPCs, hooks, or database changes
- All new utilities are shared (DRY): `chatUtils.ts` consumed by 3 components, `sanitizeMessage.ts` by 2 edge functions
- Existing server-side rate limiting and Zod validation unchanged (defense-in-depth preserved)



### Removed (Duplications Eliminated)
- **GovDashboardOverview**: Removed "Grant Recipients" and "Avg Purchase Price" cards (data fully covered in Programs tab). Removed `useGrantAnalytics` dependency. Grid reduced from 6 to 4 columns.
- **GovTrendCharts**: Removed "Total Milk Production" chart (duplicate of `MilkProductionBySpeciesChart` in Programs). Removed Doc Aga queries line from Health Events chart. Grid changed to 3-column layout.
- **RegionalPCRSCard**: Removed from Programs tab; PCRS risk data merged into `ExpectedDeliveriesTimeline` in Livestock tab.

### Changed
- **ExpectedDeliveriesTimeline**: Now receives merged PCRS risk overlay data via `useRegionalPCRS` hook, showing risk tier badges alongside species counts.
- **Farmer Voice tab**: Flattened from 6 sub-tabs to single scrollable view. Templates and Export moved to popover dropdown. All sub-components (`FeedbackPriorityQueue`, `SmartInsightsPanel`, `FeedbackClusterView`, `FeedbackGeoHeatmap`, `SentimentTrendChart`) now accept and propagate global `dateFrom`, `dateTo`, `region` filters via existing `useGovernmentFeedback` filter interface.
- **FarmerVoiceDashboard**: Now accepts optional `dateFrom`, `dateTo`, `region` props.
- **Programs tab**: Reorganized into 3 clear sections: Grant Program Analytics, Production Economics, Platform Adoption. "Farmer Queries Analysis" moved from standalone card into Platform Adoption section.

### SSOT Compliance
- Zero new RPCs, hooks, or database changes
- All changes are layout/composition moves and prop additions
- Existing `useGovernmentFeedback` filter interface now fully utilized by all Farmer Voice sub-components


## 2026-02-26 — Phase 6: Conflict Detection & Resolution — Wire Up the Gap

### Added
- **Conflict detection framework** — `checkAndHandleConflict()` in `syncService.ts` calls `detectConflict()` before UPDATE operations, records conflicts via `recordConflict()`, and marks queue items as `'conflict'` status.
- **Orphan protection** — `validateAnimalsExist()` batch-checks all referenced `animal_id`s before sync. Items referencing deleted animals are marked `'failed'` with `PARENT_DELETED` message.
- **Stale queue warning** — `checkForStaleQueueOnOtherDevices()` + `check_stale_sync_items` RPC detect unsynced items on other devices. Toast warning shown once on first online in `App.tsx`.
- **Queue item status** — Added `'conflict'` to `QueueItem.status` union; added optional `clientTimestamp` field.

### Changed
- **`syncService.ts`** — Sync loop now skips `'conflict'` items, runs batch orphan check before processing, imports `conflictDetection` utilities.
- **`offlineQueue.ts`** — `QueueItem` interface extended with `'conflict'` status and `clientTimestamp`.
- **`App.tsx`** — Added one-time stale device check on first online after mount.

### Documentation
- **`ssot-architecture.md`** — Added Section 6: Conflict Resolution Flow (pipeline, components, statuses, stale warning).

## 2026-02-26 — Phase 5: Low-Priority Cache-First + Final Documentation (SSOT Read-Path Audit COMPLETE)

### Added
- **IndexedDB v6** — Three new cache stores: `animalCostCache` (15 min TTL), `barnsCache` (30 min TTL), `farmSettingsCache` (60 min TTL).
- **Cache helpers** — `getCached*`, `update*Cache`, `clear*Cache` functions for each new store in `dataCache.ts`.
- **CacheManager IndexedDB clear** — `animal-cost-aggregates`, `barns`, `farm-settings` keys now clear their IndexedDB stores.

### Changed
- **`useAnimalCostAggregates`** — Refactored to cache-first pattern (IndexedDB → Supabase → update cache).
- **`useBarns`** — `useBarns` query refactored to cache-first; mutation hooks unchanged (Phase 4).
- **`useFarmSettings`** — `useFarmSettings` query refactored to cache-first; mutation hook unchanged (Phase 4).

### Documentation
- **Group B hooks** — Added `@cache-status` headers: `useAnimalExpenses` (ANIMAL-SCOPED read note), `useProfitability` (PARAMETERIZED), `useFinancialHealth` (PARAMETERIZED), `useProducts` (MANUAL), `useOrders` (MANUAL).
- **`ssot-architecture.md`** — Hook Inventory fully updated with all Phase 5 entries. SSOT Read-Path Audit marked complete.

## 2026-02-26 — Phase 4: Route Farm-Level Mutations Through CacheManager

### Added
- **5 new CacheManager mutation types** — `farm-settings`, `barn`, `checklist`, `pending-activity`, `farmer-feedback` registered in `CACHE_DEPENDENCIES`.

### Changed
- **`useAnimalExpenses`** — `add`/`delete` mutations routed through CacheManager `expense` type + animal-scoped manual invalidation. `useDeleteAnimalExpense` now requires `farmId` in variables.
- **`useFarmSettings`** — Update mutation routed through `farm-settings` type.
- **`useBarns`** — All 4 mutations (`create`, `update`, `assign`, `remove`) routed through `barn` type.
- **`useDailyChecklist`** — Toggle mutation routed through `checklist` type.
- **`usePendingActivities`** — All 4 mutations routed through `pending-activity` type when `farmId` available; manual fallback otherwise.
- **`useFarmerFeedback`** — Submit mutation routed through `farmer-feedback` type.

### Documentation
- **Group B hooks** — Added `@cache-status MANUAL` headers to `useMerchantOrders`, `useMerchantProducts`, `useInvoices`, `usePlatformSettings`, `useGovernmentFeedback`.
- **`ssot-architecture.md`** — Hook Inventory updated with all Phase 4 entries.

## 2026-02-26 — Phase 3: Cache-First for Medium-Priority Hooks

### Added
- **IndexedDB v5** — Three new cache stores: `marketPriceCache`, `herdValuationCache`, `breedingAnalyticsCache` with TTLs of 30m, 10m, 15m respectively.
- **Cache helpers** — `getCached*`, `update*Cache`, `clear*Cache` functions for each new store in `dataCache.ts`.
- **`CacheManager` dependencies** — `herd-valuation-unified` and `breeding-analytics` registered for `animal`, `ai-record`, `weight-record`, `heat-record`, `pregnancy-confirm`, and `market-price` mutation types.

### Changed
- **`useCurrentMarketPrice`** — Refactored to cache-first pattern (IndexedDB → Supabase → update cache). Uses `useOnlineStatus`.
- **`useHerdValuationUnified`** — Refactored to cache-first. Extracted `fetchAndComputeValuation` helper for clarity.
- **`useBreedingAnalytics`** — Consolidated from 4 separate `useQuery` calls into a single `useQuery` with internal parallel fetches + cache-first pattern.
- **`useBioCardData`** — Added `@cache-status COMPOSITION` documentation header; full cache-first deferred to Phase 5.

### Documentation
- **`ssot-architecture.md`** — Updated Hook Inventory with `useCurrentMarketPrice`, `useHerdValuationUnified`, `useBreedingAnalytics` as Category A compliant, and `useBioCardData` as deferred.


## 2026-02-23 — Barn / Paddock Grouping System

### Added
- **`barns` + `barn_assignments` tables** — Farm-scoped housing locations with move history, triggers syncing `animals.current_barn_id`.
- **`src/hooks/useBarns.ts`** — CRUD hooks for barns and assignments.
- **`src/components/barns/`** — `BarnListView`, `BarnFormDialog`, `BarnAnimalManager` components.
- **Barn quick-select in dropdowns** — `getAnimalDropdownOptions` now accepts optional `barns` param adding `barn:{id}` options. `getSelectedAnimals` handles `barn:` prefix.

### Changed
- `useFarmAnimals` / `useLactatingAnimals` — Added `current_barn_id` to queries and interfaces.
- `Dashboard.tsx` — Added `BarnListView` above animal list in Animals tab.


## 2026-02-23 — Health Voice Extractor Enhancement & Offline Capture

### Changed
- **Health extractor category IDs** (`voiceFormExtractors.ts`) — Remapped from `illness/preventive/reproductive` to match UI categories: `treatment`, `vaccination`, `deworming`, `checkup`, `injury`, `other`. Added Taglish diagnosis patterns (`may/meron`, `nilagnat`, `nagtatae`, `binigyan ng`) and expanded treatment keywords to match `QUICK_DIAGNOSES`/`QUICK_TREATMENTS`.
- **VoiceInputButton offline support** (`voice-input-button.tsx`) — Now queues audio via `offlineAudioQueue` when offline instead of failing. Shows "Na-queue ang audio" toast. Accepts `source` and `extractorType` props for queue metadata.
- **Health dialogs offline voice** — Removed `disabled={!isOnline}` from all VoiceInputButton instances across `RecordSingleHealthDialog` (5), `RecordBulkHealthDialog` (5), `AddHealthRecordDialog` (3), `AddPreventiveHealthDialog` (1).


## 2026-02-23 — Farmer-Facing Voice & Workflow Gaps

### Added
- **Weight voice extractor** (`voiceFormExtractors.ts`) — New `weight` ExtractorType supporting "245 kilos scale" and Taglish variants. Integrated into `RecordSingleWeightDialog`.
- **Health voice extractor** (`voiceFormExtractors.ts`) — New `health` ExtractorType parsing condition, category, and treatment from voice. Integrated into `RecordSingleHealthDialog`.
- **Farmhand quick-action buttons** (`FarmhandDashboard.tsx`) — Record Milk, Record Feed, Record Health shortcuts below voice recorder.
- **Bilingual offline onboarding** (`OfflineOnboarding.tsx`) — Added Tagalog translations for title and description.

### Changed
- **Feed voice enabled offline** (`RecordBulkFeedDialog.tsx`, `RecordSingleFeedDialog.tsx`) — Removed `isOnline` guard so voice input works offline via existing audio queue.

## 2026-02-23 — FAQ Usage Analytics Dashboard

### Added
- **`get_faq_usage_stats` RPC** — Single aggregation query replacing N+1 match-count pattern.
- **`get_faq_match_timeline` RPC** — Daily FAQ match volume over configurable day range.
- **`FaqUsageAnalyticsTab.tsx`** — New "FAQ Usage" tab with summary cards, top-10 bar chart, daily timeline, and unused FAQs action table.

### Changed
- `DocAgaManagement.tsx` — Added "FAQ Usage" tab between "FAQ Candidates" and "Recent Queries".

## 2026-02-23 — Offline Photo Queue & AI Record Support

### Added
- **`src/lib/offlinePhotoQueue.ts`** — New dedicated IndexedDB store for photo blobs (avatars, health record photos) with max 20 photos, 10MB limit, 7-day retention, and auto-cleanup.
- **Offline avatar uploads** — `AnimalProfile.tsx` now queues avatar photos in `offlinePhotoQueue` when offline, with a pending indicator badge.
- **Offline health record photos** — `RecordSingleHealthDialog.tsx` and `AddHealthRecordDialog.tsx` now queue photos offline via `pendingPhotoIds` field, synced after parent record succeeds.
- **Offline pregnancy confirmation** — `ConfirmPregnancyDialog.tsx` now queues pregnancy confirmations when offline, syncing `ai_records` update + `breeding_events` insert on reconnect.
- **New queue types** — `ai_record` and `pregnancy_confirm` added to `offlineQueue.ts` type union.
- **New sync handlers** — `syncAIRecord()`, `syncPregnancyConfirm()`, `syncPendingPhotos()` in `syncService.ts`.
- **Cache dependencies** — `pregnancy-confirm` added to `cacheManager.ts`.

### Changed
- `AddHealthRecordDialog` now works fully offline (was previously disabled when offline).
- `RecordSingleHealthDialog` photo section now allows adding photos when offline instead of showing "Photos available when online".
- `AnimalProfile` camera button no longer disabled when offline.

### Files Modified
| File | Change |
|------|--------|
| `src/lib/offlinePhotoQueue.ts` | NEW |
| `src/lib/offlineQueue.ts` | Added types + payload fields |
| `src/lib/syncService.ts` | Added 3 sync handlers |
| `src/lib/cacheManager.ts` | Added cache deps |
| `src/components/ConfirmPregnancyDialog.tsx` | Offline queuing |
| `src/components/animal-details/AnimalProfile.tsx` | Offline avatar |
| `src/components/health-recording/RecordSingleHealthDialog.tsx` | Offline photos |
| `src/components/health-records/AddHealthRecordDialog.tsx` | Offline photos + submission |
| `docs/data-relationships-map.md` | Documented offline photo flow |
