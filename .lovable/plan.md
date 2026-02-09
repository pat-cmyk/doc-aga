

# Initialize `/docs/data-relationships-map.md` — Living DRM

## Overview

This task creates the foundational Data Relationships Map (DRM) document at `/docs/data-relationships-map.md`, populated from the **actual current database schema** (not guesses). It covers all 70+ public tables, 8 public enums, 30+ edge functions, and the offline sync architecture.

## What Will Be Created

A single file: `/docs/data-relationships-map.md` with all 9 required sections.

---

## Section-by-Section Content Plan

### 1) Entities Index

Compact table listing all 70+ tables grouped by domain:

| Domain | Tables |
|--------|--------|
| **Core** | farms, animals, profiles, farm_memberships, user_roles |
| **Production** | milking_records, milk_inventory, feeding_records, feed_inventory, feed_stock_transactions, weight_records, body_condition_scores |
| **Health** | health_records, health_symptom_categories, injection_records, preventive_health_protocols, preventive_health_schedules |
| **Breeding** | ai_records, heat_records, heat_observation_checks, breeding_events, animal_events |
| **Finance** | farm_expenses, farm_revenues, biological_asset_valuations |
| **Marketplace** | merchants, products, product_categories, orders, order_items, invoices, distributors, market_prices |
| **Ads** | ad_campaigns, ad_impressions |
| **Government** | farmer_feedback, coverage_reports, gov_analytics_access_audit_log, gov_farm_analytics |
| **Support** | support_tickets, ticket_comments, ticket_attachments |
| **AI/Voice** | doc_aga_queries, doc_aga_faqs, faq_candidates, stt_analytics, transcription_corrections, voice_training_samples |
| **Sync** | sync_queue, sync_conflicts, farm_sync_checkpoints, pending_activities, farm_approval_settings |
| **Admin/System** | admin_actions, admin_animal_edits, admin_farm_edits, admin_profile_edits, user_roles_audit, user_activity_logs, platform_settings, notifications, messages, stats_job_runs, daily_farm_stats, monthly_farm_stats, integrity_fix_log, test_runs, test_results, daily_farm_checklists, animal_ovr_cache, animal_photos |

Each entry will include: purpose, tenant key (farm_id / global / user-scoped), role access summary, and primary screens/functions.

### 2) Entity Specs

Full column-level documentation for every table, sourced from `information_schema.columns`. Includes:
- Column name, type, nullable, default, constraints
- Primary keys and unique constraints
- Foreign key relationships with cardinality and ON DELETE rules
- Required tenancy fields verification (farm_id, created_by, created_at)
- Soft delete flags (e.g., `animals.is_deleted`)

### 3) Relationship Matrix

Compact cross-reference table format:

```text
Table A             | Table B          | Card. | FK Column     | Delete Rule | Tenant
--------------------|------------------|-------|---------------|-------------|--------
animals             | farms            | M:1   | farm_id       | (none)      | farm_id
milking_records     | animals          | M:1   | animal_id     | (none)      | via animal
health_records      | animals          | M:1   | animal_id     | (none)      | via animal
ai_records          | animals          | M:1   | animal_id     | (none)      | via animal
farm_memberships    | farms            | M:1   | farm_id       | (none)      | farm_id
...
```

### 4) RLS and Tenancy Rules

**Key finding from drift scan**: All 70+ tables have RLS **enabled**. Document per-table:
- Policy names and operations (SELECT/INSERT/UPDATE/DELETE)
- Tenant enforcement method (direct `farm_id` check vs. `can_access_farm()` via animal join)
- Admin/government exception policies (e.g., `government_view_*` policies)
- Helper functions: `can_access_farm()`, `is_farm_owner()`, `is_farm_manager()`, `has_role()`, `is_super_admin()`

### 5) Role Model

Document from actual schema:

**`user_role` enum values**: `farmer_owner`, `farmhand`, `merchant`, `vet`, `admin`, `distributor`, `government`

**`farm_memberships.role_in_farm`**: Uses same `user_role` enum for farm-level subroles.

**Enforcement layers**:
- DB: RLS policies using `has_role()`, `is_farm_owner()`, `is_farm_manager()`, `can_access_farm()`
- Edge Functions: Service-role bypass with manual role checks
- Client: `useUnifiedPermissions()` hook (UI guard only, not security boundary)

### 6) Offline + Sync Model

Document from actual `sync_queue` table columns:
- `id`, `farm_id`, `user_id`, `entity_type`, `entity_id`, `action`, `payload`, `client_timestamp`, `sync_status` (enum: pending/syncing/synced/conflict/error), `processed_at`, `server_entity_id`, `error_message`, `retry_count`, `created_at`

Plus:
- `sync_conflicts` table for conflict records
- `farm_sync_checkpoints` for per-farm sync state
- IndexedDB caches (offlineQueue.ts, offlineAudioQueue, dataCache)
- Workbox service worker routes and background sync config
- CacheManager invalidation dependencies

### 7) Edge Functions Data Contracts

Document all 31 edge functions with inputs/outputs/tables/role checks:
- `doc-aga` (AI chat), `rico` (analytics AI), `process-animal-voice`, `voice-to-text`, `text-to-speech`
- `process-farmhand-activity`, `review-pending-activity`, `process-auto-approvals`
- `admin-create-user`, `admin-permanent-delete-farm`
- `merchant-signup`, `send-team-invitation`
- `calculate-daily-stats`, `calculate-ovr-scores`, `generate-predictive-insights`
- etc.

### 8) Change Log + Consistency Check

Initial entry documenting this bootstrap and any drift findings.

### 9) Assumptions and Open Questions

Document known gaps found during audit (e.g., vet role RLS gap, ai_records missing direct farm_id column).

---

## Drift Scan Findings (Initial)

From comparing actual schema vs. existing project memories:

| Finding | Severity | Detail |
|---------|----------|--------|
| `ai_records` has no `farm_id` column | Info | Tenant isolation via `animal_id` join to `animals.farm_id` — by design but worth documenting |
| `milking_records`, `health_records`, `feeding_records`, `weight_records` — same pattern | Info | No direct `farm_id`; isolated via animal join |
| `heat_records`, `injection_records` — same pattern | Info | Via animal join |
| Vet role RLS gap | Warn | Previously documented — `is_vet()` function may not exist |
| Foreign key query returned empty | Warn | FKs may use different constraint types or be absent — needs investigation |
| `gov_farm_analytics` purpose unclear | Info | Needs documentation |

---

## Implementation Steps

1. Create `/docs/data-relationships-map.md` with all 9 sections
2. Populate Entities Index from the 70+ tables grouped by domain
3. Write Entity Specs for core/production/health/breeding/finance tables first, then remaining domains
4. Build Relationship Matrix from FK and join patterns found in RLS policies
5. Document all RLS policies per table
6. Document role model with enum values and enforcement layers
7. Document offline/sync architecture from `sync_queue` schema + `offlineQueue.ts` + `sw.ts`
8. Document edge function contracts (inputs/outputs/tables/roles)
9. Add initial Change Log entry and Drift Scan findings
10. Add Open Questions section with known gaps

**Estimated size**: ~1500-2000 lines of structured markdown

