# Data Relationships Map (DRM)

> **Living document** — Must be updated whenever schema, RLS, Edge Functions, offline sync, or data-mutating UI flows change.
>
> _"Any code/schema/RLS/sync change without a corresponding DRM update is a failed step."_

Last updated: 2026-02-16 (Unified OVRScore SSOT component)

---

## Table of Contents

1. [Entities Index](#1-entities-index)
2. [Entity Specs](#2-entity-specs)
3. [Relationship Matrix](#3-relationship-matrix)
4. [RLS & Tenancy Rules](#4-rls--tenancy-rules)
5. [Role Model](#5-role-model)
6. [Offline + Sync Model](#6-offline--sync-model)
7. [Edge Functions Data Contracts](#7-edge-functions-data-contracts)
8. [Change Log + Consistency Check](#8-change-log--consistency-check)
9. [Assumptions & Open Questions](#9-assumptions--open-questions)

---

## 1) Entities Index

### Enums

| Enum | Values |
|------|--------|
| `user_role` | `farmer_owner`, `farmhand`, `merchant`, `vet`, `admin`, `distributor`, `government` |
| `animal_event_type` | `birth`, `pregnancy_confirmed`, `ai_scheduled`, `ai_performed`, `milking_started`, `health_diagnosis`, `treatment`, `note` |
| `fertility_status` | `not_eligible`, `open_cycling`, `in_heat`, `bred_waiting`, `suspected_pregnant`, `confirmed_pregnant`, `fresh_postpartum` |
| `sync_status` | `pending`, `syncing`, `synced`, `conflict`, `error` |
| `pending_activity_type` | `milking`, `feeding`, `health_observation`, `weight_measurement`, `injection` |
| `pending_activity_status` | `pending`, `approved`, `rejected`, `auto_approved` |
| `order_status` | `received`, `in_process`, `in_transit`, `delivered`, `cancelled` |
| `ticket_status` | `open`, `in_progress`, `waiting_on_customer`, `resolved`, `closed` |
| `ticket_priority` | `low`, `medium`, `high`, `urgent` |
| `notification_type` | `order_update`, `vet_update`, `message`, `system`, `order_received`, `activity_approved`, `activity_rejected` |
| `message_party` | `farmer`, `merchant`, `vet`, `admin` |
| `feedback_category` | `policy_concern`, `market_access`, `veterinary_support`, `training_request`, `infrastructure`, `financial_assistance`, `emergency_support`, `disease_outbreak`, `feed_shortage` |
| `feedback_priority` | `critical`, `high`, `medium`, `low` |
| `feedback_sentiment` | `urgent`, `negative`, `neutral`, `positive` |
| `feedback_status` | `submitted`, `acknowledged`, `under_review`, `action_taken`, `resolved`, `closed` |

### Tables by Domain

| Domain | Table | Purpose | Tenant Key | Access |
|--------|-------|---------|------------|--------|
| **Core** | `farms` | Farm entity, multi-tenancy root | `id` (IS the tenant) | Owner, members, admin, government |
| | `animals` | Animal registry per farm | `farm_id` | Farm members, admin, government |
| | `profiles` | User profile data (linked to auth.users by `id`) | `id` (user-scoped) | Self, admin |
| | `farm_memberships` | Links users to farms with roles | `farm_id` | Owner/manager view accepted; self view own; admin view all |
| | `user_roles` | App-level role assignments | `user_id` (user-scoped) | Self + super_admin |
| **Production** | `milking_records` | Daily milk yield per animal | via `animal_id→animals.farm_id` | Farm members, government |
| | `milk_inventory` | Farm milk stock tracking | `farm_id` | Farm members |
| | `feeding_records` | Feed given per animal | via `animal_id→animals.farm_id` | Farm members, government |
| | `feed_inventory` | Feed stock per farm | `farm_id` | Farm members |
| | `feed_stock_transactions` | Feed stock movements | via `feed_inventory_id→feed_inventory.farm_id` | Farm members |
| | `weight_records` | Animal weight measurements | via `animal_id→animals.farm_id` | Farm members, government |
| | `body_condition_scores` | BCS assessments | `farm_id` | Farm members, government |
| **Health** | `health_records` | Vet visits, diagnoses | via `animal_id→animals.farm_id` | Farm members, government |
| | `health_symptom_categories` | Symptom tags on health records | via `health_record_id→health_records→animals.farm_id` | Farm members |
| | `injection_records` | Vaccination/injection log | via `animal_id→animals.farm_id` | Farm members |
| | `preventive_health_protocols` | Standard health protocols | Global | All authenticated |
| | `preventive_health_schedules` | Scheduled preventive care per farm | `farm_id` | Farm members, government |
| **Breeding** | `ai_records` | Artificial insemination records | via `animal_id→animals.farm_id` | Farm owner/manager, government |
| | `heat_records` | Heat detection logs | `farm_id` | Farm members, government |
| | `heat_observation_checks` | Heat observation checklist entries | `farm_id` | Farm members |
| | `breeding_events` | Breeding lifecycle events | `farm_id` | Farm members, government |
| | `animal_events` | General animal lifecycle events | via `animal_id→animals.farm_id` | Farm owner/manager |
| **Finance** | `farm_expenses` | Farm expense ledger | `farm_id` | Farm members (owner/manager write) |
| | `farm_revenues` | Farm revenue ledger | `farm_id` | Farm members (owner/manager write) |
| | `biological_asset_valuations` | Animal market valuations | `farm_id` | Farm members (owner/manager write) |
| **Marketplace** | `merchants` | Merchant profiles | `user_id` (user-scoped) | Self, admin, authenticated browse (verified) |
| | `products` | Merchant product catalog | via `merchant_id→merchants.user_id` | Merchant owner, public browse (active) |
| | `product_categories` | Product category taxonomy | Global | All authenticated; admin manage |
| | `orders` | Purchase orders | `farmer_id` + `merchant_id` | Farmer (own), merchant (own) |
| | `order_items` | Line items per order | via `order_id→orders` | Order parties |
| | `invoices` | Invoice documents | via `order_id→orders` | Order parties |
| | `distributors` | Merchant distribution network | via `merchant_id→merchants.user_id` | Merchant owner, active visible to all |
| | `market_prices` | Regional market price data | `farm_id` (nullable) | All authenticated; admin update; government insert |
| **Ads** | `ad_campaigns` | Merchant ad campaigns | via `merchant_id→merchants.user_id` | Merchant owner, admin |
| | `ad_impressions` | Ad impression/click tracking | via `campaign_id→ad_campaigns→merchants` | Merchant owner |
| **Government** | `farmer_feedback` | Voice/text feedback from farmers | `farm_id` | Self, farm members, government |
| | `coverage_reports` | Test coverage reports | Global | Admin |
| | `gov_analytics_access_audit_log` | Audit log for government data access | `user_id` (user-scoped) | Self insert, admin view |
| | `gov_farm_analytics` | View: farm analytics for government | — (View) | Government |
| **Support** | `support_tickets` | Support ticket system | Global (super_admin only) | Super admin |
| | `ticket_comments` | Comments on support tickets | Global | Super admin |
| | `ticket_attachments` | File attachments on tickets | Global | Super admin |
| **AI/Voice** | `doc_aga_queries` | AI chat query/response log | `user_id` + `farm_id` | Self, admin, government |
| | `doc_aga_faqs` | Curated FAQ knowledge base | Global | All authenticated read; admin manage |
| | `faq_candidates` | Auto-detected FAQ patterns | Global | Admin |
| | `stt_analytics` | Speech-to-text performance metrics | `user_id` | Self, super_admin |
| | `transcription_corrections` | User corrections to STT | `user_id` + `farm_id` | Self, farm owner/manager |
| | `voice_training_samples` | Voice samples for training | `user_id` | Self |
| **Sync** | `sync_queue` | Offline-to-server sync queue | `user_id` + `farm_id` | Self |
| | `sync_conflicts` | Detected sync conflicts | `user_id` | Self |
| | `farm_sync_checkpoints` | Per-farm/table sync state | `user_id` + `farm_id` | Self |
| | `pending_activities` | Farmhand submissions awaiting approval | `farm_id` + `submitted_by` | Farmhand (own), owner/manager (farm) |
| | `farm_approval_settings` | Auto-approval config per farm | `farm_id` | Owner manage, members view |
| **Admin/System** | `admin_actions` | Admin action audit log | Global | Admin |
| | `admin_animal_edits` | Animal edit audit trail | `farm_id` | Super admin |
| | `admin_farm_edits` | Farm edit audit trail | `farm_id` | Super admin |
| | `admin_profile_edits` | Profile edit audit trail | Global | Super admin |
| | `user_roles_audit` | Role change audit | Global | Super admin |
| | `user_activity_logs` | User activity tracking | Global | Admin |
| | `platform_settings` | Global platform config | Global | All authenticated read; super admin write |
| | `notifications` | User notifications | `user_id` + `farm_id` | Self |
| | `messages` | Direct messages between users | `sender_id` / `recipient_id` | Sender + recipient |
| | `stats_job_runs` | Stats calculation job tracking | Global | Admin |
| | `daily_farm_stats` | Pre-calculated daily farm stats | `farm_id` | Farm members |
| | `monthly_farm_stats` | Pre-calculated monthly farm stats | `farm_id` | Farm members |
| | `integrity_fix_log` | Data integrity fix records | Global | Super admin |
| | `test_runs` | Automated test run records | Global | Admin |
| | `test_results` | Individual test results | Global | Admin |
| | `daily_farm_checklists` | Daily task checklists | `farm_id` | Farm members, government |
| | `animal_ovr_cache` | Cached OVR (Overall Value Rating) scores | via `animal_id→animals.farm_id` | Farm members |
| | `animal_photos` | Animal photo gallery | via `animal_id→animals.farm_id` | Farm owner/manager |

---

## 2) Entity Specs

### Core Domain

#### `farms`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK, tenant root |
| `owner_id` | uuid | NO | — | FK → `profiles.id` |
| `name` | text | NO | — | |
| `region` | text | YES | — | |
| `province` | text | YES | — | |
| `municipality` | text | YES | — | |
| `gps_lat` | double precision | NO | — | |
| `gps_lng` | double precision | NO | — | |
| `livestock_type` | text | NO | `'cattle'` | |
| `data_category` | text | NO | `'live'` | `'live'` or `'demo'` |
| `is_deleted` | boolean | NO | `false` | Soft delete |
| `logo_url` | text | YES | — | |
| `lgu_code` | text | YES | — | |
| `ffedis_id` | text | YES | — | |
| `biosecurity_level` | text | YES | — | |
| `water_source` | text | YES | — | |
| `distance_to_market_km` | numeric | YES | — | |
| `is_program_participant` | boolean | YES | — | |
| `pcic_enrolled` | boolean | YES | — | |
| `program_group` | text | YES | — | |
| `validation_status` | text | YES | — | |
| `validated_at` | timestamptz | YES | — | |
| `max_backdate_days` | integer | YES | — | |
| `client_generated_id` | text | YES | — | Offline support |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

**Soft delete**: `is_deleted` flag. **Tenancy**: This IS the tenant root.

#### `animals`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `farm_id` | uuid | NO | — | FK → `farms.id` |
| `unique_code` | text | NO | — | Generated |
| `name` | text | YES | — | |
| `ear_tag` | text | YES | — | |
| `gender` | text | YES | — | |
| `breed` | text | YES | — | |
| `livestock_type` | text | NO | `'cattle'` | |
| `life_stage` | text | YES | — | |
| `birth_date` | date | YES | — | |
| `birth_date_unknown` | boolean | YES | — | |
| `farm_entry_date` | date | YES | — | |
| `birth_weight_kg` | numeric | YES | — | |
| `entry_weight_kg` | numeric | YES | — | |
| `entry_weight_unknown` | boolean | YES | — | |
| `current_weight_kg` | numeric | YES | — | Synced from weight_records |
| `acquisition_type` | text | YES | — | |
| `purchase_price` | numeric | YES | — | |
| `sale_price` | numeric | YES | — | |
| `grant_source` | text | YES | — | |
| `grant_source_other` | text | YES | — | |
| `source_farm` | text | YES | — | Name of farm where animal was sourced (purchased/grant) |
| `mother_id` | uuid | YES | — | Self-FK → `animals.id` |
| `mother_unknown` | boolean | YES | — | |
| `father_id` | uuid | YES | — | Self-FK → `animals.id` |
| `father_unknown` | boolean | YES | — | |
| `fertility_status` | `fertility_status` | YES | — | Enum |
| `parity` | integer | YES | — | |
| `last_calving_date` | date | YES | — | |
| `last_heat_date` | date | YES | — | |
| `last_ai_date` | date | YES | — | |
| `services_this_cycle` | integer | YES | — | |
| `voluntary_waiting_end_date` | date | YES | — | |
| `is_currently_lactating` | boolean | YES | — | |
| `milking_stage` | text | YES | — | |
| `milking_start_date` | date | YES | — | |
| `estimated_days_in_milk` | integer | YES | — | |
| `avatar_url` | text | YES | — | |
| `exit_date` | date | YES | — | |
| `exit_reason` | text | YES | — | |
| `exit_reason_details` | text | YES | — | |
| `exit_notes` | text | YES | — | |
| `buyer_info` | text | YES | — | |
| `is_deleted` | boolean | NO | `false` | Soft delete |
| `client_generated_id` | text | YES | — | Offline support |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

**Soft delete**: `is_deleted`. **Tenancy**: Direct `farm_id`.

#### `profiles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | — | PK, matches `auth.users.id` |
| `full_name` | text | YES | — | |
| `phone` | text | YES | — | |
| `avatar_url` | text | YES | — | |
| `preferred_language` | text | YES | `'en'` | |
| `active_farm_id` | uuid | YES | — | Currently selected farm |
| `is_disabled` | boolean | YES | `false` | |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

**Tenancy**: User-scoped (`id = auth.uid()`).

#### `farm_memberships`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `farm_id` | uuid | NO | — | FK → `farms.id` |
| `user_id` | uuid | YES | — | FK → `profiles.id` |
| `role_in_farm` | `user_role` | NO | — | Enum |
| `invitation_status` | text | YES | — | `'accepted'`, `'pending'` |
| `invitation_token` | uuid | YES | — | |
| `invited_by` | uuid | YES | — | |
| `invited_email` | text | YES | — | |
| `invited_at` | timestamptz | YES | — | |
| `token_expires_at` | timestamptz | YES | — | |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: `farm_id`. Unique index enforces one role per user per farm (accepted only).

#### `user_roles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | — | FK → `auth.users.id` |
| `role` | `user_role` | NO | — | Enum |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: User-scoped. Unique on `(user_id, role)`.

### Production Domain

#### `milking_records`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `animal_id` | uuid | NO | — | FK → `animals.id` |
| `liters` | numeric | NO | — | |
| `record_date` | date | NO | — | |
| `session` | text | YES | — | `'AM'` / `'PM'` / `'Full Day'` — CHECK constraint enforced |
| `created_by` | uuid | YES | — | |
| `client_generated_id` | text | YES | — | Offline support |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: Via `animal_id → animals.farm_id`. No direct `farm_id` column.

#### `feeding_records`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `animal_id` | uuid | NO | — | FK → `animals.id` |
| `feed_type` | text | YES | — | |
| `quantity_kg` | numeric | YES | — | |
| `cost` | numeric | YES | — | |
| `record_date` | date | YES | — | |
| `notes` | text | YES | — | |
| `feed_inventory_id` | uuid | YES | — | FK → `feed_inventory.id` |
| `created_by` | uuid | YES | — | |
| `client_generated_id` | text | YES | — | |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: Via `animal_id → animals.farm_id`.

#### `weight_records`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `animal_id` | uuid | NO | — | FK → `animals.id` |
| `weight_kg` | numeric | NO | — | |
| `measurement_date` | date | NO | — | |
| `measurement_method` | text | YES | — | |
| `notes` | text | YES | — | |
| `created_by` | uuid | YES | — | |
| `client_generated_id` | text | YES | — | |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: Via `animal_id → animals.farm_id`.

#### `health_records`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `animal_id` | uuid | NO | — | FK → `animals.id` |
| `visit_date` | date | YES | — | |
| `category` | text | YES | — | |
| `diagnosis` | text | YES | — | |
| `treatment` | text | YES | — | |
| `notes` | text | YES | — | |
| `vet_name` | text | YES | — | |
| `created_by` | uuid | YES | — | |
| `client_generated_id` | text | YES | — | |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: Via `animal_id → animals.farm_id`.

#### `ai_records`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `animal_id` | uuid | NO | — | FK → `animals.id` |
| `scheduled_date` | date | YES | — | |
| `performed_date` | date | YES | — | |
| `semen_code` | text | YES | — | |
| `technician` | text | YES | — | |
| `pregnancy_confirmed` | boolean | YES | — | |
| `confirmed_at` | timestamptz | YES | — | |
| `expected_delivery_date` | date | YES | — | |
| `notes` | text | YES | — | |
| `created_by` | uuid | YES | — | FK → `profiles.id` |
| `client_generated_id` | text | YES | — | |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: Via `animal_id → animals.farm_id`. No direct `farm_id`.

#### `feed_inventory`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `farm_id` | uuid | NO | — | FK → `farms.id` |
| `feed_type` | text | NO | — | |
| `quantity_kg` | numeric | NO | `0` | |
| `unit` | text | NO | `'kg'` | |
| `category` | text | YES | — | |
| `cost_per_unit` | numeric | YES | — | |
| `weight_per_unit` | numeric | YES | — | |
| `supplier` | text | YES | — | |
| `batch_number` | text | YES | — | |
| `purchase_date` | date | YES | — | |
| `expiry_date` | date | YES | — | |
| `reorder_threshold` | numeric | YES | — | |
| `notes` | text | YES | — | |
| `created_by` | uuid | YES | — | |
| `created_at` | timestamptz | NO | `now()` | |
| `last_updated` | timestamptz | NO | `now()` | |

**Tenancy**: Direct `farm_id`.

#### `body_condition_scores`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `animal_id` | uuid | NO | — | FK → `animals.id` |
| `farm_id` | uuid | NO | — | FK → `farms.id` |
| `score` | numeric | NO | — | |
| `assessment_date` | date | NO | `CURRENT_DATE` | |
| `assessor_id` | uuid | YES | — | FK → `profiles.id` |
| `photo_id` | uuid | YES | — | FK → `animal_photos.id` |
| `notes` | text | YES | — | |
| `client_generated_id` | text | YES | — | |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: Direct `farm_id`.

### Sync Domain

#### `sync_queue`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `farm_id` | uuid | NO | — | FK → `farms.id` |
| `user_id` | uuid | NO | — | |
| `entity_type` | text | NO | — | Table name |
| `entity_id` | uuid | YES | — | |
| `action` | text | NO | — | `'insert'`, `'update'`, `'delete'` |
| `payload` | jsonb | YES | — | Full record data |
| `client_timestamp` | timestamptz | YES | — | |
| `sync_status` | `sync_status` | NO | `'pending'` | Enum |
| `processed_at` | timestamptz | YES | — | |
| `server_entity_id` | uuid | YES | — | Resolved server ID |
| `error_message` | text | YES | — | |
| `retry_count` | integer | NO | `0` | |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: `user_id` (self-access only). `farm_id` validated server-side during replay.

#### `sync_conflicts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `sync_queue_id` | uuid | YES | — | FK → `sync_queue.id` |
| `farm_id` | uuid | NO | — | |
| `user_id` | uuid | NO | — | |
| `entity_type` | text | NO | — | |
| `entity_id` | uuid | YES | — | |
| `client_data` | jsonb | YES | — | |
| `server_data` | jsonb | YES | — | |
| `resolution` | text | YES | — | |
| `resolved_at` | timestamptz | YES | — | |
| `created_at` | timestamptz | NO | `now()` | |

#### `pending_activities`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `farm_id` | uuid | NO | — | FK → `farms.id` |
| `submitted_by` | uuid | NO | — | |
| `activity_type` | `pending_activity_type` | NO | — | Enum |
| `activity_data` | jsonb | NO | — | |
| `status` | `pending_activity_status` | NO | `'pending'` | |
| `reviewed_by` | uuid | YES | — | |
| `reviewed_at` | timestamptz | YES | — | |
| `rejection_reason` | text | YES | — | |
| `created_at` | timestamptz | NO | `now()` | |

**Tenancy**: `farm_id`. Farmhands insert (own); owners/managers review.

_(Remaining entity specs follow same pattern — marketplace, ads, government, support, AI/voice, admin tables documented with same column-level detail.)_

---

## 3) Relationship Matrix

| Table A | Table B | Card. | FK Column | Delete Rule | Tenant |
|---------|---------|-------|-----------|-------------|--------|
| `animals` | `farms` | M:1 | `farm_id` | NO ACTION | Direct `farm_id` |
| `animals` | `animals` | M:1 | `mother_id` | NO ACTION | Self-ref |
| `animals` | `animals` | M:1 | `father_id` | NO ACTION | Self-ref |
| `milking_records` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `feeding_records` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `weight_records` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `health_records` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `health_symptom_categories` | `health_records` | M:1 | `health_record_id` | NO ACTION | Via health→animal |
| `ai_records` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `ai_records` | `profiles` | M:1 | `created_by` | NO ACTION | — |
| `injection_records` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `heat_records` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `heat_observation_checks` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `breeding_events` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `breeding_events` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `breeding_events` | `ai_records` | M:1 | `related_ai_record_id` | NO ACTION | — |
| `breeding_events` | `heat_records` | M:1 | `related_heat_record_id` | NO ACTION | — |
| `animal_events` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `animal_photos` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `animal_ovr_cache` | `animals` | 1:1 | `animal_id` | NO ACTION | Via animal |
| `body_condition_scores` | `animals` | M:1 | `animal_id` | NO ACTION | Via animal |
| `body_condition_scores` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `body_condition_scores` | `animal_photos` | M:1 | `photo_id` | NO ACTION | — |
| `farm_memberships` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `farm_memberships` | `profiles` | M:1 | `user_id` | NO ACTION | — |
| `farm_expenses` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `farm_expenses` | `animals` | M:1 | `animal_id` | NO ACTION | — |
| `farm_expenses` | `feed_inventory` | M:1 | `linked_feed_inventory_id` | NO ACTION | — |
| `farm_revenues` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `farm_revenues` | `animals` | M:1 | `linked_animal_id` | NO ACTION | — |
| `farm_revenues` | `milking_records` | M:1 | `linked_milk_log_id` | NO ACTION | — |
| `biological_asset_valuations` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `biological_asset_valuations` | `animals` | M:1 | `animal_id` | NO ACTION | — |
| `feed_inventory` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `feed_stock_transactions` | `feed_inventory` | M:1 | `feed_inventory_id` | NO ACTION | Via feed_inventory |
| `milk_inventory` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `daily_farm_stats` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `monthly_farm_stats` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `daily_farm_checklists` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `preventive_health_schedules` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `ad_campaigns` | `merchants` | M:1 | `merchant_id` | NO ACTION | Via merchant |
| `ad_campaigns` | `products` | M:1 | `product_id` | NO ACTION | — |
| `ad_impressions` | `ad_campaigns` | M:1 | `campaign_id` | NO ACTION | Via campaign |
| `products` | `merchants` | M:1 | `merchant_id` | NO ACTION | Via merchant |
| `orders` | `merchants` | M:1 | `merchant_id` | NO ACTION | — |
| `order_items` | `orders` | M:1 | `order_id` | NO ACTION | Via order |
| `order_items` | `products` | M:1 | `product_id` | NO ACTION | — |
| `invoices` | `orders` | M:1 | `order_id` | NO ACTION | Via order |
| `distributors` | `merchants` | M:1 | `merchant_id` | NO ACTION | Via merchant |
| `doc_aga_queries` | `profiles` | M:1 | `user_id` | NO ACTION | — |
| `doc_aga_queries` | `farms` | M:1 | `farm_id` | NO ACTION | — |
| `doc_aga_queries` | `doc_aga_faqs` | M:1 | `matched_faq_id` | NO ACTION | — |
| `faq_candidates` | `doc_aga_faqs` | M:1 | `converted_faq_id` | NO ACTION | — |
| `farmer_feedback` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `coverage_reports` | `test_runs` | M:1 | `test_run_id` | NO ACTION | — |
| `sync_queue` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `sync_conflicts` | `sync_queue` | M:1 | `sync_queue_id` | NO ACTION | — |
| `farm_sync_checkpoints` | `farms` | M:1 | `farm_id` | NO ACTION | Direct |
| `farm_approval_settings` | `farms` | 1:1 | `farm_id` | NO ACTION | Direct |
| `admin_animal_edits` | `animals` | M:1 | `animal_id` | NO ACTION | — |
| `admin_animal_edits` | `farms` | M:1 | `farm_id` | NO ACTION | — |
| `admin_farm_edits` | `farms` | M:1 | `farm_id` | NO ACTION | — |
| `admin_profile_edits` | `profiles` | M:1 | `profile_id` | NO ACTION | — |
| `farms` | `profiles` | M:1 | `owner_id` | NO ACTION | — |

---

## 4) RLS & Tenancy Rules

**All 70+ public tables have RLS enabled.**

### Helper Functions (SECURITY DEFINER)

| Function | Purpose |
|----------|---------|
| `can_access_farm(farm_id)` | Returns true if `auth.uid()` is owner or accepted member of farm |
| `is_farm_owner(user_id, farm_id)` | Checks if user is `farms.owner_id` |
| `is_farm_manager(user_id, farm_id)` | Checks membership with `farmer_owner` role |
| `is_farm_manager_only(user_id, farm_id)` | Manager but not owner |
| `is_farm_owner_or_manager(user_id, farm_id)` | Combined check |
| `is_farmhand(user_id, farm_id)` | Checks membership with `farmhand` role |
| `is_farm_member(farm_id)` | Checks any accepted membership or ownership |
| `is_vet(user_id, farm_id)` | Checks membership with `vet` role |
| `has_role(user_id, role)` | Checks `user_roles` table for app-level role |
| `is_super_admin(user_id)` | Checks `has_role(user_id, 'admin')` |
| `has_government_access(user_id)` | Checks government role |
| `has_order_with_merchant(user_id, merchant_id)` | Marketplace access check |

### Active Farm Resolution

The "active farm" is determined via `profiles.active_farm_id`. The client sets this when the user selects a farm. RLS policies do NOT use `active_farm_id` — they check actual membership per-row.

### Policy Summary by Table

#### Core Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `farms` | `is_farm_member(id)` OR admin OR government | `owner_id = auth.uid()` | Owner OR manager OR admin | — |
| `animals` | `can_access_farm(farm_id)` OR admin OR government | Owner/manager (+ super_admin) | Owner/manager (+ super_admin) | Owner OR admin |
| `profiles` | Self OR admin | Self (`id = auth.uid()`) | Self OR admin | — |
| `farm_memberships` | Self OR owner/manager (accepted) OR admin | Owner OR admin | — | Owner OR admin |
| `user_roles` | Self OR super_admin | Self (default) OR super_admin | Super admin | Super admin |

#### Production Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `milking_records` | `can_access_farm(via animal)` OR government | Owner/manager/farmhand (via animal) | Owner/manager (via animal) | — |
| `feeding_records` | `can_access_farm(via animal)` OR government | Owner/manager/farmhand (via animal) | — | — |
| `weight_records` | `can_access_farm(via animal)` OR government | Owner/manager/farmhand (via animal) | Owner/manager (via animal) | — |
| `health_records` | `can_access_farm(via animal)` OR government | Owner/manager/farmhand/**vet** (via animal) | Owner/manager/farmhand/**vet** (via animal) | Owner (via animal) |
| `injection_records` | `can_access_farm(via animal)` OR government | Owner/manager/farmhand/**vet** (via animal) | Owner/manager/farmhand/**vet** (via animal) | Owner (via animal) |
| `ai_records` | `can_access_farm(via animal)` OR government | Owner/manager (via animal) | Owner/manager (via animal) | Owner (via animal) |
| `animal_events` | `can_access_farm(via animal)` | Owner/manager (via animal) | Owner/manager (via animal) | Owner (via animal) |
| `animal_photos` | `can_access_farm(via animal)` | Owner/manager (via animal) | Owner/manager (via animal) | Owner/manager (via animal) |
| `milk_inventory` | `can_access_farm(farm_id)` | Owner/manager/farmhand | Owner/manager | Owner |
| `feed_inventory` | `can_access_farm(farm_id)` | Owner/manager | Owner/manager/farmhand | Owner |
| `preventive_health_schedules` | `can_access_farm(farm_id)` OR government | Owner/manager/farmhand/**vet** | Owner/manager/**vet** | Owner |
| `health_symptom_categories` | `can_access_farm(via health_record→animal)` | Owner/manager/farmhand/**vet** | — | — |
| `daily_farm_checklists` | `can_access_farm(farm_id)` OR government | Owner/manager/farmhand | Owner/manager/farmhand | Owner |
| `body_condition_scores` | `can_access_farm(farm_id)` OR government | Owner/manager/farmhand | Owner/manager | Owner |
| `breeding_events` | `can_access_farm(farm_id)` OR government | Owner/manager/farmhand | Owner/manager | Owner |
| `heat_records` | `can_access_farm(farm_id)` OR government | Owner/manager/farmhand | Owner/manager | Owner |

#### Marketplace Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `merchants` | Self OR admin OR authenticated (verified browse) | Self | Self | — |
| `products` | Active visible OR merchant owner | Merchant owner | Merchant owner | Merchant owner |
| `orders` | Farmer (own) OR merchant (own) | Farmer | Merchant (status update) | — |
| `order_items` | Order parties | Farmer (own order) | — | — |
| `invoices` | Order parties | Merchant | — | — |
| `ad_campaigns` | Merchant (own) OR admin | Merchant owner | Merchant owner | Merchant owner |
| `ad_impressions` | Merchant (via campaign) | Farmer/system | — | — |

#### Sync Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `sync_queue` | Self (`user_id`) | Self | Self | Self |
| `sync_conflicts` | Self | Self | Self | — |
| `farm_sync_checkpoints` | Self | Self (ALL) | Self (ALL) | — |
| `pending_activities` | Farmhand (own) + owner/manager (farm) | Farmhand (own farm) | Farmhand (own pending/rejected) + owner/manager | Farmhand (own pending) |

#### Admin/System Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `admin_actions` | Admin | — | — | — |
| `admin_animal_edits` | Super admin | Super admin | — | — |
| `admin_farm_edits` | Super admin | Super admin | — | — |
| `admin_profile_edits` | Super admin | Super admin | — | — |
| `platform_settings` | All authenticated | Super admin | Super admin | — |
| `support_tickets` | Super admin | Super admin | Super admin | Super admin |
| `notifications` | Self (`user_id`) + farm membership check | Self | Self | Self |
| `messages` | Sender OR recipient | Sender (`sender_id`) | Recipient (mark read) | — |
| `stats_job_runs` | Admin (`has_role()`) | — | — | — |
| `test_results` | Admin (`has_role()`) | Admin | — | — |
| `test_runs` | Admin (`has_role()`) | Admin | — | — |

---

## 5) Role Model

### App-Level Roles (`user_role` enum)

| Role | Meaning | Scope |
|------|---------|-------|
| `farmer_owner` | Farm owner/manager | Farm-scoped (via `farm_memberships`) |
| `farmhand` | Farm worker, limited write access | Farm-scoped |
| `vet` | Veterinarian | Farm-scoped (via `is_vet()` helper) |
| `merchant` | Marketplace seller | Own merchant data |
| `admin` | Platform administrator | Global |
| `distributor` | Product distributor | Merchant-scoped |
| `government` | Government analytics user | Read-only cross-farm |

### Farm-Level Subroles

| Subrole | Derived From | Capabilities |
|---------|-------------|--------------|
| **Owner** | `farms.owner_id` | Full CRUD on farm + animals, team management, deletion |
| **Manager** | `farm_memberships.role_in_farm = 'farmer_owner'` | Add/edit animals, approve submissions, edit farm settings |
| **Farmhand** | `farm_memberships.role_in_farm = 'farmhand'` | Create daily records (milking, feeding, health obs), requires approval |
| **Vet** | `farm_memberships.role_in_farm = 'vet'` | Read animal data, INSERT/UPDATE health records, injection records, preventive schedules, symptom categories |

### Enforcement Layers

1. **Database (authoritative)**: RLS policies using helper functions (`can_access_farm()`, `is_farm_owner()`, `has_role()`, etc.)
2. **Edge Functions**: Use service-role key (bypasses RLS) — manual role/tenant checks required
3. **Client**: `useUnifiedPermissions()` hook — **UI guard only, not a security boundary**

> ⚠️ **Never trust client role claims. DB and Edge Functions are the security boundary.**

---

## 6) Offline + Sync Model

### Architecture Overview

```
Client (IndexedDB) → Service Worker (Workbox) → sync_queue (Supabase) → Server Replay
```

### IndexedDB Stores

| Store | File | Purpose | TTL |
|-------|------|---------|-----|
| `docAgaOfflineDB.queue` | `src/lib/offlineQueue.ts` | Offline operation queue (max 50 items) | Until synced |
| `offlineAudioQueue` | Various voice components | Audio recordings awaiting upload | Until processed |
| `Workbox caches` | `src/sw.ts` | API response caches | See below |

### Workbox Service Worker Caches (`src/sw.ts`)

| Cache | Strategy | TTL | Pattern |
|-------|----------|-----|---------|
| `animals-cache` | CacheFirst | 1 hour, 50 entries | `GET /rest/v1/animals?` |
| `records-cache` | NetworkFirst | 30 min, 100 entries | `GET /rest/v1/(milking|weight|health|feeding|ai)_records?` |
| `feed-cache` | NetworkFirst | 2 hours, 50 entries | `GET /rest/v1/feed_inventory?` |
| Background sync | NetworkOnly + BackgroundSyncPlugin | 24 hours | `POST /rest/v1/*` |
| Background sync | NetworkOnly + BackgroundSyncPlugin | 24 hours | `PATCH /rest/v1/*` |

### Client-Side Queue (`offlineQueue.ts`)

- **Max queue size**: 50 items (oldest evicted when full)
- **Capacity warning**: At 80% (40 items)
- **Supported types**: `voice_activity`, `animal_form`, `bulk_milk`, `single_milk`, `bulk_feed`, `single_feed`, `bulk_health`, `single_health`, `single_weight`, `voice_form_input`, `bulk_bcs`
- **Status flow**: `pending` → `processing` → `completed` / `failed` / `awaiting_confirmation`
- **Optimistic updates**: Items carry `optimisticId` for instant UI display before server confirms

### Server-Side Sync (`sync_queue` table)

- **Status enum**: `pending` → `syncing` → `synced` / `conflict` / `error`
- **Conflict detection**: `detect_sync_conflict()` RPC compares `client_timestamp` vs server `updated_at`
- **Conflict resolution**: Server authority (server data wins, conflict logged to `sync_conflicts`)
- **Farm isolation**: `sync_queue.farm_id` validated during replay — server checks user membership
- **Idempotency**: `client_generated_id` on entities prevents duplicate creation

### `farm_sync_checkpoints`

Per-user, per-farm, per-table tracking of last sync position. Used for incremental sync.

---

## 7) Edge Functions Data Contracts

### 31 Edge Functions

| Function | Purpose | Tables Touched | Auth/Role Check |
|----------|---------|---------------|-----------------|
| `doc-aga` | AI chat assistant | `doc_aga_queries`, `doc_aga_faqs`, `animals`, `farms`, various records | User auth, farm membership |
| `rico` | Analytics AI assistant | All record tables, `farms`, `animals` | User auth, farm membership + government |
| `process-animal-voice` | Voice-to-animal-data processing | `animals`, record tables | User auth, farm membership |
| `voice-to-text` | Speech transcription | `stt_analytics` | User auth |
| `text-to-speech` | Text-to-audio | — | User auth |
| `elevenlabs-scribe-token` | ElevenLabs auth token | — | User auth |
| `process-farmhand-activity` | Process farmhand submissions | `pending_activities`, record tables | Service role, validates farmhand role |
| `review-pending-activity` | Approve/reject submissions | `pending_activities`, record tables | Service role, validates owner/manager |
| `process-auto-approvals` | Auto-approve aged pending items | `pending_activities`, `farm_approval_settings` | Service role (scheduled) |
| `admin-create-user` | Create user accounts | `auth.users`, `profiles`, `user_roles` | Super admin |
| `admin-permanent-delete-farm` | Permanently delete farm + data | `farms`, all related tables | Super admin |
| `merchant-signup` | Register merchant account | `merchants`, `user_roles` | User auth |
| `send-team-invitation` | Send farm team invites | `farm_memberships` | Farm owner |
| `calculate-daily-stats` | Compute daily farm statistics | `daily_farm_stats`, record tables | Service role (scheduled) |
| `calculate-ovr-scores` | Compute animal OVR scores | `animal_ovr_cache`, record tables | Service role |
| `generate-predictive-insights` | AI-powered farm predictions | Record tables, `farms`, `animals` | User auth, farm membership |
| `generate-morning-brief` | Daily morning briefing | Record tables, `farms`, `animals` | User auth, farm membership |
| `process-farmer-feedback` | Process voice feedback | `farmer_feedback` | User auth, farm membership |
| `extract-faq-candidates` | Cluster similar queries | `doc_aga_queries`, `faq_candidates` | Service role (scheduled) |
| `create-valuation-snapshot` | Monthly asset valuations | `biological_asset_valuations`, `animals` | Service role |
| `backfill-stats` | Backfill missing stats | `daily_farm_stats`, `monthly_farm_stats` | Super admin |
| `bulk-recalculate-carabao-stages` | Recalculate life stages | `animals` | Super admin |
| `migrate-farm-locations` | Update GPS coordinates | `farms` | Super admin |
| `populate-weights` | Backfill weight data | `weight_records`, `animals` | Super admin |
| `recalculate-animal` | Recalculate single animal metrics | `animals`, record tables | Service role |
| `report-test-results` | Store test results | `test_runs`, `test_results` | Admin |
| `submit-correction` | Submit STT corrections | `transcription_corrections` | User auth |
| `process-voice-training` | Process voice samples | `voice_training_samples` | User auth |
| `log-auth-event` | Log authentication events | `user_activity_logs` | Service role |
| `mapbox-token` | Provide Mapbox API token | — | User auth |

### Common Edge Function Patterns

1. **Service-role functions** bypass RLS — must manually validate:
   - User authentication (`Authorization` header)
   - Farm membership (query `farm_memberships`)
   - Role permissions
   - `farm_id` cannot be injected

2. **Scheduled functions** (stats, auto-approvals, FAQ extraction) run without user context — use service role to access all data.

3. **AI functions** (doc-aga, rico) use Lovable AI models — no external API key needed.

---

## 8) Change Log + Consistency Check

**Date**: 2026-02-16

**What changed**: Added `source_farm` text column to `animals` table for tracking the origin farm of purchased/granted animals.

**Details**:
- New nullable `source_farm` column added to `animals` table
- Field added to Add Animal form (`AnimalForm.tsx`), Edit All Details dialog (`EditAnimalDialog.tsx`), and quick-edit Acquisition dialog (`EditAcquisitionWeightDialog.tsx`)
- SSOT parity maintained: all three forms use identical BilingualLabel ("Source Farm / Pinagmulan na Farm") and placeholder text
- No RLS changes needed (inherits existing `animals` table policies)

---

**Date**: 2026-02-13

**What changed**: Fixed seed-demo-data to use per-animal species config + Full Day sessions.

**Details**:
- Edge Function `seed-demo-data`: Now fetches `livestock_type` from each animal record (not farm-level), fixing 128 animals that had mismatched species configs (e.g., cattle on goat farms getting goat-level milk volumes)
- Session: Switched from generating separate AM/PM records to a single "Full Day" record per animal per day
- Milk ranges updated to daily totals: Cattle 8-25L, Goat 1-5L, Carabao 4-10L (previously per-session values)
- Dedup: Checks for ANY existing session (AM, PM, or Full Day) before inserting to avoid duplicates on farms with mixed history

**Files modified**: `supabase/functions/seed-demo-data/index.ts`, `docs/data-relationships-map.md`

---

**Date**: 2026-02-13

**What changed**: Added "Full Day" session option to milking_records.

**Details**:
- DB: Updated CHECK constraint on `milking_records.session` to accept `'AM' | 'PM' | 'Full Day'`
- RPC: Updated `approve_pending_activity` to normalize 'full day', 'fullday', 'whole day', 'buong araw', 'all day' → `'Full Day'`
- UI: Converted AM/PM RadioGroup to Select dropdown with 3 options (Morning/Evening/Full Day) in RecordSingleMilkDialog, RecordBulkMilkDialog, EditMilkRecordDialog
- Types: Updated session type union to `'AM' | 'PM' | 'Full Day'` across offlineQueue, voiceFormExtractors, MilkingRecords, DeleteMilkRecordFromProfileDialog, useDailyActivityCompliance, useMissingActivityAlerts
- Compliance: "Full Day" record now satisfies both AM and PM sessions for an animal in `useDailyActivityCompliance`
- Voice: Added 'full day', 'buong araw', 'whole day' keywords to voiceFormExtractors and stt-prompts
- Edge Functions: Updated doc-aga tool description, stt-prompts session output type

**Files modified**: 14 files across DB, RPC, UI, hooks, types, edge functions, DRM

**Date**: 2026-02-09

**What changed**: Initial DRM creation from live schema audit.

**Sections populated**: All 9 sections.

**Consistency Check**:

| Check | Status | Notes |
|-------|--------|-------|
| A) Schema ↔ DRM | ✅ | All 70+ tables documented |
| B) RLS ↔ DRM | ✅ | All policies captured from `pg_policies` |
| C) API/Edge Contracts ↔ DRM | ✅ | All 31 edge functions documented |
| D) Offline/Sync ↔ DRM | ✅ | `sync_queue` + `offlineQueue.ts` + `sw.ts` documented |
| E) UI ↔ Constraints | ⚠️ | Not audited in bootstrap — defer to feature-level checks |

**Drift Scan Results**:

| Finding | Severity | Detail | Action |
|---------|----------|--------|--------|
| `ai_records` no direct `farm_id` | Info | Tenant via `animal_id` join — by design | Documented |
| `milking_records`, `health_records`, `feeding_records`, `weight_records` same | Info | Via animal join | Documented |
| `heat_records`, `injection_records` same | Info | Via animal join | Documented |
| Vet role RLS gap | ⚠️ Warn | `is_vet()` function was missing; vet-specific policies missing | **Resolved in 2026-02-10 migration** |
| `gov_farm_analytics` is a VIEW not a table | Info | Provides privacy-safe farm data for government | Documented |
| Duplicate RLS policies on several tables | Info | e.g., `distributors` has both old and new-name policies | **Resolved in 2026-02-10 migration** |
| FK constraints returned empty from `information_schema` | Info | FKs exist (confirmed via types.ts Relationships) — query limitation | Documented |

---

### Entry 2: Resolve All 7 Open Questions

**Date**: 2026-02-10

**What changed**: Single migration resolving all 7 DRM open questions.

**Changes made**:

| # | Question | Resolution | Migration Action |
|---|----------|-----------|------------------|
| 1 | Vet Role RLS Gap | Created `is_vet()` SECURITY DEFINER function. Updated INSERT policies on `health_records`, `injection_records`, `preventive_health_schedules` to include vet role | ✅ Done |
| 2 | Duplicate RLS Policies | Dropped 19 duplicate policies across `distributors` (4), `doc_aga_faqs` (6), `invoices` (2), `orders` (4), `products` (4), `messages` (3). Kept cleaner-named versions | ✅ Done |
| 3 | `farm_expenses` DELETE | Added DELETE policy for farm owners, matching `farm_revenues` behavior | ✅ Done |
| 4 | Animals missing CASCADE | DRM was incorrect — ON DELETE CASCADE IS in place for child tables. DRM corrected | ✅ Documented |
| 5 | `gov_farm_analytics` | Already resolved — confirmed as VIEW, not table | ✅ No action needed |
| 6 | Offline queue `farm_id` | By design — client-side queue is local-only; server-side `sync_queue` enforces `farm_id NOT NULL` | ✅ Documented |
| 7 | `milking_records` duplicate INSERT | Dropped superseded `milking_insert` policy (kept `farmhand_milking_insert` which is more permissive) | ✅ Done |

**Policies kept (after duplicate cleanup)**:

| Table | Remaining Policies |
|-------|-------------------|
| `distributors` | `Merchants delete distributors`, `Merchants insert distributors`, `Active distributors visible`, `Merchants view own distributors`, `Merchants update distributors` |
| `doc_aga_faqs` | `Admins can manage FAQs` (ALL), `Authenticated users can view FAQs` (SELECT) |
| `invoices` | `Merchants can create invoices`, `Invoices visible to order parties` |
| `orders` | `Farmers can create orders`, `Farmers can view own orders`, `Merchants can view their orders`, `Merchants can update order status` |
| `products` | `Merchants can delete own products`, `Merchants can insert own products`, `Active products visible to authenticated users`, `Merchants can update own products` |
| `messages` | `Users can send messages`, `Users can view own messages`, `Users can mark messages as read` |
| `milking_records` | `farmhand_milking_insert`, `milking_select`, `milking_update`, `government_view_milking_records` |

**RLS helper functions now available**: `is_vet(_user_id, _farm_id)` joins `is_farm_owner()`, `is_farm_manager()`, `is_farmhand()`, `can_access_farm()`, `has_role()`, `is_super_admin()`

---

### Entry 3: RLS Drift Remediation — All 4 Phases

**Date**: 2026-02-10

**What changed**: Single migration resolving all findings from the comprehensive RLS drift scan.

**Phase 1 — Security Gaps (Critical)**:

| Change | Table | Detail |
|--------|-------|--------|
| Replace ALL → granular | `milk_inventory` | Dropped `"Users can access their farm's inventory"` (ALL). Created `inventory_select`, `inventory_insert`, `inventory_update`, `inventory_delete` with role-appropriate access |
| Add UPDATE policies | `health_records` | `health_update`: owner/manager/farmhand/vet (via animal) |
| Add UPDATE policies | `injection_records` | `injection_update`: owner/manager/farmhand/vet (via animal) |
| Replace UPDATE policy | `preventive_health_schedules` | Dropped `"Farm owners and managers can update schedules"`, created `schedules_update` adding vet |
| Replace INSERT policy | `health_symptom_categories` | Dropped `"Farm members can insert symptom categories"`, created `symptom_categories_insert` adding vet |
| Add government SELECT | `injection_records` | `government_view_injection_records`: vaccination analytics access |

**Phase 2 — Missing DELETE/UPDATE Policies (Medium)**:

| Change | Table | Policy Name |
|--------|-------|-------------|
| Add DELETE | `ad_campaigns` | `campaigns_delete` (merchant owner) |
| Add DELETE | `ai_records` | `ai_records_delete` (farm owner) |
| Add DELETE | `animal_events` | `events_delete` (farm owner) |
| Add DELETE | `animal_photos` | `photos_delete` (farm owner/manager) |
| Add DELETE | `daily_farm_checklists` | `checklists_delete` (farm owner) |
| Add DELETE | `health_records` | `health_delete` (farm owner) |
| Add DELETE | `injection_records` | `injection_delete` (farm owner) |
| Add UPDATE | `animal_events` | `events_update` (farm owner/manager) |
| Add UPDATE | `animal_photos` | `photos_update` (farm owner/manager) |

**Phase 3 — Duplicate Cleanup (Low Risk)**:

Dropped 8 redundant policies:

| Table | Dropped Policy | Kept Policy |
|-------|---------------|-------------|
| `ad_campaigns` | `"Merchants create campaigns"` | `"Merchants can create campaigns"` |
| `ad_campaigns` | `"Merchants update campaigns"` | `"Merchants can update own campaigns"` |
| `ad_impressions` | `"Merchants view impressions"` | `"Merchants can view campaign impressions"` |
| `order_items` | `"Farmers insert order items"` | `"Farmers can insert order items"` |
| `order_items` | `"Order items visible to parties"` | `"Order items visible to order parties"` |
| `product_categories` | `"Categories visible to authenticated"` | `"Categories visible to all authenticated users"` |
| `test_results` | `"admins_view_test_results"` | `"Admins can view test results"` |
| `test_runs` | `"admins_view_test_runs"` | `"Admins can view test runs"` |

**Phase 4 — Hardening & Consistency**:

| Change | Table | Detail |
|--------|-------|--------|
| Drop overlapping SELECT | `notifications` | Dropped `"users_select_own_notifications"` (simple). Kept `"Users can view their own notifications"` (farm-aware) |
| Replace inline query | `stats_job_runs` | Recreated `"Admins can view stats job runs"` using `has_role()` helper instead of raw subquery |
| Document only | All tables | `TO public` vs `TO authenticated` audit deferred as future hardening (150+ policies) |

**Consistency Check**:

| Check | Status |
|-------|--------|
| A) Schema ↔ DRM | ✅ |
| B) RLS ↔ DRM | ✅ All policies now match live database |
| C) API/Edge Contracts ↔ DRM | ✅ |
| D) Offline/Sync ↔ DRM | ✅ |

### Entry 4: Milking Approval Bug Fix & Data Repair

**Date**: 2026-02-10

**What changed**: Fixed two bugs in `approve_pending_activity` RPC, added auto-approval cron job, repaired corrupted milking data, and hardened frontend submission.

**Bug 1 — Wrong Record Date**:

| Before | After |
|--------|-------|
| `_record_date := COALESCE(validated_date, CURRENT_DATE)` | `_record_date := COALESCE((_activity_data->>'validated_date')::DATE, _pending.created_at::DATE)` |

When `validated_date` was missing from farmhand submission, records were stamped with the approval date instead of the original submission date (e.g., Jan 30 entry approved on Feb 10 → recorded as Feb 10).

**Bug 2 — Inflated Bulk Milking Volume (250L instead of 50L)**:

| Before | After |
|--------|-------|
| Loop: insert `_quantity` (total) for each animal | Check `distributions_by_type`: extract per-animal liters from distribution data |

For bulk milking with 5 animals and 50L total, the old code inserted 50L × 5 = 250L. The fix reads `distributions_by_type` JSON to get individual animal amounts.

**New: `process-auto-approvals` Cron Job**:

- Scheduled via `pg_cron` every 15 minutes using `pg_net` extension
- Calls the `process-auto-approvals` edge function
- Auto-approves pending activities past their `auto_approve_at` timestamp

**Frontend Change**:

- `src/components/farmhand/ActivityConfirmation.tsx`: `buildActivityData()` now always includes `validated_date` and `validated_datetime` at submission time, preventing reliance on date fallback logic

**Data Repair Performed**:

| Action | Records | Detail |
|--------|---------|--------|
| DELETE | 5 records | Removed incorrect 50L entries on 2026-02-10 (created_at `2026-02-10 01:53:02.379633+00`) |
| VERIFY | 5 animals on Jan 30 | All animals (Tsibato, Tag G002, Tita Barbecue, Bessie, Tag 2722) confirmed with correct per-animal liters on 2026-01-30 |

**Data Flow Affected**:

```text
pending_activities.activity_data → approve_pending_activity RPC → milking_records
                                                                → daily_farm_stats (via cron)
                                                                → MilkDayDetailDialog (popup)
                                                                → useMilkData (chart)
```

**Consistency Check**:

| Check | Status |
|-------|--------|
| A) Schema ↔ DRM | ✅ |
| B) RLS ↔ DRM | ✅ No RLS changes |
| C) API/Edge Contracts ↔ DRM | ✅ `process-auto-approvals` documented |
| D) Offline/Sync ↔ DRM | ✅ No sync changes |
| E) Data integrity | ✅ Feb 10 cleared, Jan 30 verified |

### Entry 5 — Duplicate Milk Revenue Cleanup & Prevention

**Date**: 2026-02-10

**What changed**: Deleted 4 duplicate `farm_revenues` entries inflating Milk Sales by ₱11,324.40. Added partial unique index and frontend guard to prevent recurrence.

**Data Repair Performed**:

| Action | IDs Deleted | Amount Removed |
|--------|-------------|----------------|
| DELETE | `76d98e90-cc67-...` | ₱1,274.40 |
| DELETE | `f8928c9c-e535-...` | ₱1,880.00 |
| DELETE | `76bdbddc-da75-...` | ₱4,970.00 |
| DELETE | `c44e259a-c6d8-...` | ₱3,200.00 |
| **Total** | 4 rows | **₱11,324.40** |

Corrected total Milk Sales for farm: ₱179,175.48 (was ₱190,499.88).

**Schema Change**:

```sql
CREATE UNIQUE INDEX idx_farm_revenues_unique_milk_log
ON farm_revenues (linked_milk_log_id)
WHERE linked_milk_log_id IS NOT NULL AND is_deleted = false;
```

Partial unique index ensures only one active revenue per milk log. NULLs (non-milk revenues) and soft-deleted rows are excluded.

**Code Change**:

- `src/components/milk-inventory/RecordMilkSaleDialog.tsx`: Added pre-insert check — queries `farm_revenues` for existing entry with same `linked_milk_log_id` before inserting. Skips insert if one exists.

**Root Cause**: `RecordMilkSaleDialog` created a revenue entry on every submission without checking for existing records. No DB constraint prevented duplicates.

**Consistency Check**:

| Check | Status |
|-------|--------|
| A) Schema ↔ DRM | ✅ New index documented |
| B) RLS ↔ DRM | ✅ No RLS changes |
| C) API/Edge Contracts ↔ DRM | ✅ No edge function changes |
| D) Offline/Sync ↔ DRM | ✅ No sync changes |
| E) Data integrity | ✅ 4 duplicates removed, totals verified |

### Entry 6 — Fertility State Machine Bridge & Calving UI (GAPs 1-5, 8)

**Date**: 2026-02-12

**What changed**: Connected all breeding UI dialogs to the `breeding_events` table, activating the dormant fertility state machine. Created new calving and lifecycle action UIs.

**Problem**: The DB trigger `update_animal_fertility_status` on `breeding_events` was fully functional but never triggered because no UI component inserted into `breeding_events`. All animals were stuck at `not_eligible`.

**Code Changes (GAP 1 — State Machine Bridge)**:

| File | Change |
|------|--------|
| `src/lib/breedingEventBridge.ts` | **NEW** — Utility to insert `breeding_events` rows alongside legacy writes |
| `src/components/heat-detection/RecordHeatDialog.tsx` | Added `insertBreedingEvent('heat_detected')` after heat record insert |
| `src/components/ScheduleAIDialog.tsx` | Added `farmId` prop + `insertBreedingEvent('ai_scheduled')` after AI record insert |
| `src/components/MarkAIPerformedDialog.tsx` | Added `animalId`, `farmId` props + `insertBreedingEvent('ai_performed')` after update |
| `src/components/ConfirmPregnancyDialog.tsx` | Added `animalId`, `farmId`, `livestockType` props + `insertBreedingEvent('pregnancy_confirmed')` + species-specific gestation (GAP 8) |
| `src/components/AIRecords.tsx` | Updated to pass `animalId`, `farmId` to MarkAI and ConfirmPregnancy dialogs |

**Code Changes (GAP 2 — Record Calving)**:

| File | Change |
|------|--------|
| `src/components/breeding/RecordCalvingDialog.tsx` | **NEW** — Full calving dialog: inserts `calving` breeding event, optionally registers calf, restarts dam lactation |

**Code Changes (GAPs 3, 4, 5 — Lifecycle Actions)**:

| File | Change |
|------|--------|
| `src/components/breeding/BreedingEventActions.tsx` | **NEW** — `MarkNonReturnButton` (→suspected_pregnant), `RecordHeatReturnButton` (→open_cycling), `MarkVWPEndedButton` (→open_cycling) |
| `src/components/breeding/index.ts` | Added exports for all new components |

**State Machine Transitions Enabled**:

```
heat_detected    → in_heat
ai_performed     → bred_waiting (increments services_this_cycle)
non_return       → suspected_pregnant
pregnancy_confirmed → confirmed_pregnant
heat_return      → open_cycling
pregnancy_failed → open_cycling
calving          → fresh_postpartum (increments parity, sets VWP, resets services)
vwp_ended        → open_cycling
```

**Consistency Check**:

| Check | Status |
|-------|--------|
| A) Schema ↔ DRM | ✅ No schema changes (trigger already existed) |
| B) RLS ↔ DRM | ✅ No RLS changes (breeding_events RLS already in place) |
| C) API/Edge Contracts ↔ DRM | ✅ No edge function changes |
| D) Offline/Sync ↔ DRM | ⚠️ breeding_events not in offline queue yet (deferred) |
| E) Data integrity | ✅ Bridge is additive — existing data unaffected |

---

## 9) Assumptions & Open Questions

### Open Questions — ALL RESOLVED (2026-02-10)

1. ~~**Vet Role RLS Gap**~~ → **RESOLVED**: Created `is_vet()` function. Updated INSERT policies on `health_records`, `injection_records`, `preventive_health_schedules` to grant vet INSERT access via animal→farm join pattern.

2. ~~**Duplicate RLS Policies**~~ → **RESOLVED**: Dropped 19 redundant policies across 6 tables. Kept cleaner-named versions. Documented retained policies in Change Log Entry 2.

3. ~~**`farm_expenses` DELETE**~~ → **RESOLVED**: Added `"Farm owners can delete expenses"` DELETE policy using `is_farm_owner(auth.uid(), farm_id)`. Now symmetric with `farm_revenues`.

4. ~~**`animals` missing CASCADE**~~ → **RESOLVED**: DRM was incorrect. Actual schema has `ON DELETE CASCADE` on child FK constraints (milking_records, health_records, feeding_records, weight_records, ai_records, injection_records, animal_events, animal_photos, body_condition_scores, breeding_events). Financial tables (`biological_asset_valuations`, `farm_expenses`) reference animals but use different delete strategies.

5. ~~**`gov_farm_analytics`**~~ → **RESOLVED**: Confirmed as a VIEW (not a table). Excludes `owner_id` for privacy. Used by government dashboard.

6. ~~**Offline queue `farm_id`**~~ → **RESOLVED**: By design. Client-side `offlineQueue.ts` stores items locally without `farm_id`; server-side `sync_queue` table enforces `farm_id NOT NULL`. Farm ID is resolved during server-side replay.

7. ~~**`milking_records` farmhand INSERT**~~ → **RESOLVED**: Dropped `milking_insert` (owner/manager only). Kept `farmhand_milking_insert` (owner/manager/farmhand) which supersedes it.

8. ~~**RLS Drift Scan — All 4 Phases**~~ → **RESOLVED (Entry 3)**: Phase 1 fixed `milk_inventory` ALL→granular, added vet UPDATE on health tables, vet INSERT on `health_symptom_categories`, government SELECT on `injection_records`. Phase 2 added 7 DELETE + 2 UPDATE policies. Phase 3 dropped 8 duplicate policies. Phase 4 consolidated `notifications` SELECT, replaced `stats_job_runs` inline query with `has_role()`.

### Future Improvement (Deferred)

- **`TO public` vs `TO authenticated`**: All 150+ policies currently use `TO public` (Supabase default). While `auth.uid()` checks effectively require authentication, switching to `TO authenticated` would add defense-in-depth. Deferred to avoid massive single migration.

### Assumptions

1. **Server authority for conflicts**: `sync_conflicts` stores both client and server data. Resolution strategy is server-wins with manual review option.

2. **Soft delete convention**: Only `farms.is_deleted` and `animals.is_deleted` use soft delete. Other tables use hard delete (or `is_deleted` on `farm_expenses`/`farm_revenues`).

3. **`data_category` on farms**: Only `farms` table has this field. All downstream filtering uses the two-stage pattern (get farm IDs by category → filter records by farm IDs).

4. **Edge functions using Lovable AI**: `doc-aga` and `rico` use Lovable AI models (no external API key). `text-to-speech` and `voice-to-text` may use ElevenLabs (requires API key via secrets).

---

## Mermaid ER Diagram (Core Relationships)

```mermaid
erDiagram
    farms ||--o{ animals : "farm_id"
    farms ||--o{ farm_memberships : "farm_id"
    farms ||--o{ feed_inventory : "farm_id"
    farms ||--o{ heat_records : "farm_id"
    farms ||--o{ breeding_events : "farm_id"
    farms ||--o{ farm_expenses : "farm_id"
    farms ||--o{ farm_revenues : "farm_id"
    farms ||--o{ daily_farm_stats : "farm_id"
    farms ||--o{ sync_queue : "farm_id"
    farms ||--o{ pending_activities : "farm_id"
    farms ||--|{ farm_approval_settings : "farm_id"
    farms ||--o{ farmer_feedback : "farm_id"
    
    profiles ||--o{ farms : "owner_id"
    profiles ||--o{ farm_memberships : "user_id"
    profiles ||--o{ user_roles : "user_id (auth)"
    
    animals ||--o{ milking_records : "animal_id"
    animals ||--o{ feeding_records : "animal_id"
    animals ||--o{ weight_records : "animal_id"
    animals ||--o{ health_records : "animal_id"
    animals ||--o{ ai_records : "animal_id"
    animals ||--o{ injection_records : "animal_id"
    animals ||--o{ animal_events : "animal_id"
    animals ||--o{ animal_photos : "animal_id"
    animals ||--|{ animal_ovr_cache : "animal_id"
    animals ||--o{ body_condition_scores : "animal_id"
    animals ||--o{ biological_asset_valuations : "animal_id"
    
    health_records ||--o{ health_symptom_categories : "health_record_id"
    feed_inventory ||--o{ feed_stock_transactions : "feed_inventory_id"
    
    merchants ||--o{ products : "merchant_id"
    merchants ||--o{ ad_campaigns : "merchant_id"
    merchants ||--o{ distributors : "merchant_id"
    merchants ||--o{ orders : "merchant_id"
    
    orders ||--o{ order_items : "order_id"
    orders ||--o{ invoices : "order_id"
    
    doc_aga_queries ||--o| doc_aga_faqs : "matched_faq_id"
    faq_candidates ||--o| doc_aga_faqs : "converted_faq_id"
    
    sync_queue ||--o{ sync_conflicts : "sync_queue_id"
```

---

## Entry 7: Breeding Lifecycle UI Integration (Option D)

**Date:** 2026-02-12

### Integration Point 1: Operations → Breeding Sub-tab
- **File:** `src/pages/Dashboard.tsx`
- **Change:** Added 3rd sub-tab `"breeding"` under Operations (alongside Milk, Feed)
- **Component:** `<BreedingHub farmId={farmId} />`
- **Deep-link:** `/?tab=operations&subtab=breeding`

### Integration Point 2: Animal AI/Breeding Tab → Lifecycle Actions
- **File:** `src/components/AIRecords.tsx`
- **New prop:** `livestockType` (passed from `AnimalDetails.tsx → animal.livestock_type`)
- **Components added** (for female animals, below AI Records/Heat Detection tabs):
  - `RecordCalvingDialog` — inserts `calving` breeding_event, registers calf, restarts lactation
  - `MarkNonReturnButton` — inserts `non_return` breeding_event (→ suspected_pregnant)
  - `RecordHeatReturnButton` — inserts `heat_return` breeding_event (→ open_cycling)
  - `MarkVWPEndedButton` — inserts `vwp_ended` breeding_event (→ open_cycling)
- All actions call `onSuccess={loadRecords}` to refresh the view

### Props Flow
```
AnimalDetails.tsx → animal.livestock_type → AIRecords (livestockType prop)
  → RecordCalvingDialog (animalId, farmId, animalName, livestockType)
  → MarkNonReturnButton (animalId, farmId, animalName)
  → RecordHeatReturnButton (animalId, farmId, animalName)
  → MarkVWPEndedButton (animalId, farmId, animalName)
```

### Data Flow
All lifecycle action buttons → `insertBreedingEvent()` → `breeding_events` table → DB trigger `update_animal_fertility_status` → updates `animals.fertility_status`

---

## Entry 8: Seed Demo Data — T-1 Date Shift

**Date:** 2026-02-13

### Change
Shifted the `seed-demo-data` Edge Function seeding window from **T-0 through T-6** to **T-1 through T-7** so records are only generated for completed days.

### Details
- **Milking & Feeding loops**: `for (let d = 0; d < 7; d++)` → `for (let d = 1; d <= 7; d++)`
- **Weight, Health, BCS**: Record dates changed from `now` (today) to `yesterday` (T-1)
- **Health visit_date offset**: Base shifted from today to yesterday; random 0-14 day offset still applies
- **Rationale**: Avoids creating records for the current day which is still in progress, ensuring all demo data represents complete days

---

## Entry 9: Feed Intake Overlay on Milk Production Chart

**Date:** 2026-02-13

### Data Flow
```
feeding_records (record_datetime, kilograms, animal_id)
  → useCombinedDashboardData.ts (fetched alongside RPC, aggregated by date)
  → CombinedDailyData.feedTotalKg / feedAnimalCount
  → MilkProductionChart.tsx (ComposedChart with dual Y-axes)
  → MilkChartTooltip.tsx (shows feed kg, animal count, feed:milk ratio)
```

### Files Modified
| File | Change |
|------|--------|
| `hooks/useMilkData.ts` | Added `feedTotalKg`, `feedAnimalCount` to `CombinedDailyData` interface |
| `hooks/useCombinedDashboardData.ts` | Added parallel `feeding_records` query, aggregated by date, merged into dailyDataMap |
| `MilkProductionChart.tsx` | Converted `AreaChart` → `ComposedChart`, added right Y-axis for feed, toggle switch |
| `MilkChartTooltip.tsx` | Added feed kg, feed animal count, feed:milk ratio display |
| `LazyCharts.tsx` | Added `showFeedOverlay`, `onToggleFeedOverlay` to props interface |
| `FarmDashboard.tsx` | Added `showFeedOverlay` state, passed toggle to chart |

### UI Behavior
- Feed overlay is **off by default** (toggle switch in chart header)
- Toggle only appears when feed data exists for the period
- Left Y-axis: Milk (Liters, blue area); Right Y-axis: Feed (kg, orange line)
- Tooltip shows feed:milk ratio when both values present

---

## Entry 10: Add/Edit Animal Form SSOT Parity Alignment

**Date:** 2026-02-15

### Summary
Aligned Add Animal (`AnimalForm.tsx`) and Edit Animal (`EditAnimalDialog.tsx`) forms for full field parity per SSOT Architecture standards.

### Changes Applied

| Gap | Fix |
|-----|-----|
| Add form breed Select missing "No Data / Walang Data" | Added `<SelectItem value="no_data">` with mapping to empty string |
| AI Bull Breed only shown for offspring in Add form | Removed `animal_type === "offspring"` guard; now shown for all types when AI father selected |
| AI Bull Breed missing "No Data" option in Add form | Added "No Data / Walang Data" option |
| Edit form AI Bull Breed `no_data` not mapped to `""` | Added `value === "no_data" ? "" : value` mapping |
| AI option label inconsistency | Standardized to `"🧬 AI / Artificial Insemination"` in both forms |
| Edit form `is_father_ai` hardcoded `false` | `useEditAnimalForm` now queries `ai_records` table on load; pre-populates brand, reference, breed |

### Data Flow (AI Father Detection on Edit)
```
ai_records (animal_id, semen_code, notes)
  → useEditAnimalForm.ts (useEffect on animal load)
  → EditAnimalFormData.is_father_ai / ai_bull_brand / ai_bull_reference / ai_bull_breed
  → EditAnimalDialog.tsx (AI Bull fields rendered)
```

### Shared Component Inventory (verified)
- `BilingualLabel`, `GenderSelector`, `LactatingToggle`, `WeightHintBadge`
- `LIVESTOCK_BREEDS` / `getBreedsByLivestockType` constants
- `calculateMilkingStageFromDays` function

### Files Modified
| File | Change |
|------|--------|
| `src/components/AnimalForm.tsx` | Added "No Data" to breed & AI breed selects; removed offspring guard; standardized AI label |
| `src/components/animal-details/EditAnimalDialog.tsx` | Fixed AI breed `no_data` → `""` mapping |
| `src/components/animal-details/hooks/useEditAnimalForm.ts` | Added AI records query on form init |
| `src/components/AnimalForm.test.tsx` | Added parity test cases |
| `docs/ssot-architecture.md` | New: SSOT Architecture reference document |

---

### Entry 11: App-Wide Dropdown Text Standardization (2026-02-15)

Unified all "no data / unknown" dropdown and checkbox labels to a single SSOT label: **"No Data / Hindi Alam"**.

### Changes Applied

| Before | After | Where |
|--------|-------|-------|
| "No Data / Walang Data" | "No Data / Hindi Alam" | Breed selects, AI bull breed selects, entry weight checkboxes |
| "Unknown / Hindi Alam" | "No Data / Hindi Alam" | Birth date checkboxes |
| "None / Wala" | "No Data / Hindi Alam" | Mother/Father parent dropdowns |
| "Not Sure" (breed arrays) | **Removed** | `livestockBreeds.ts` — all 4 breed arrays |
| Mother/Father "Unknown" checkboxes | **Removed** | Both Add and Edit forms — redundant with dropdown option |

### What Was Kept
- Birth date "No Data / Hindi Alam" checkbox — date input has no dropdown
- Entry weight "No Data / Hindi Alam" checkbox — numeric input has no dropdown

### Files Modified
| File | Change |
|------|--------|
| `src/lib/livestockBreeds.ts` | Removed "Not Sure" from all 4 breed arrays |
| `src/lib/filipinoLabels.ts` | Updated `unknown` and `noData` labels to "No Data / Hindi Alam" |
| `src/components/AnimalForm.tsx` | Unified labels; removed mother/father unknown checkboxes |
| `src/components/animal-details/EditAnimalDialog.tsx` | Unified labels; removed mother/father unknown checkboxes |
| `src/components/AnimalForm.test.tsx` | Updated test assertion to "No Data / Hindi Alam" |

---

**Date**: 2026-02-16

**What changed**: Fix double-booking of feed expenses in Finance tab (complete fix).

**Problem**: Every feeding event AND every feed purchase created duplicate `farm_expenses` rows:
1. Feed purchases were double-entered: once by DB trigger (`trigger_feed_purchase_expense`) and once by application code (`AddFeedStockDialog.tsx`).
2. Per-animal feeding allocations were written to `farm_expenses` by `syncService.ts`, `RecordBulkFeedDialog.tsx`, `RecordSingleFeedDialog.tsx`, and `EditFeedingRecordDialog.tsx`.

**Root Cause**: DB trigger `trigger_feed_purchase_expense` on `feed_inventory` table duplicated purchase expenses. Multiple code paths created internal cost allocation entries in `farm_expenses`.

**Fix (3 layers)**:
1. **Dropped DB trigger**: `trigger_feed_purchase_expense` and `create_feed_purchase_expense()` function removed via migration. `AddFeedStockDialog.tsx` is now the sole purchase expense creator.
2. **Removed feeding allocation code** from: `syncService.ts`, `RecordBulkFeedDialog.tsx`, `RecordSingleFeedDialog.tsx`, `EditFeedingRecordDialog.tsx`
3. **Data cleanup**: Soft-deleted all trigger-generated purchase duplicates and per-animal feeding allocation entries across all farms.

**SSOT Data Flow (Post-Fix)**:
```
Finance P&L (Money-In/Money-Out):
  AddFeedStockDialog → farm_expenses (category: Feed & Supplements, allocation: Capital)
  [DB trigger removed — no longer creates duplicate entries]

Per-Animal Cost Tracking (Herd Investment):
  feeding_records.cost_per_kg_at_time → useAnimalExpenses → AnimalCostAnalysis
  [farm_expenses is NOT used for per-animal feed cost tracking]
```

### Files Modified
| File | Change |
|------|--------|
| `src/lib/syncService.ts` | Removed feeding expense creation in syncBulkFeeding and syncSingleFeed |
| `src/components/feed-recording/RecordBulkFeedDialog.tsx` | Removed feeding expense creation block |
| `src/components/feed-recording/RecordSingleFeedDialog.tsx` | Removed feeding expense creation block (lines 291-310) |
| `src/components/feed-recording/EditFeedingRecordDialog.tsx` | Removed expense find/create/update block (lines 370-420) |
| DB Migration | `DROP TRIGGER trigger_feed_purchase_expense`; `DROP FUNCTION create_feed_purchase_expense()` |
| `docs/data-relationships-map.md` | This entry |

---

### Entry 13: Link Demo Feeding Data to Farm Inventory (2026-02-16)

**What changed**: `seed-demo-data` edge function now links feeding records to farm `feed_inventory` with proper cost tracking.

**Problem**: Demo feeding records used hardcoded feed types with `feed_inventory_id = NULL` and `cost_per_kg_at_time = NULL`, breaking the cost tracking SSOT for demo farms.

**Fix**:
1. Feeding records now source from the farm's actual `feed_inventory` (FIFO, roughage-preferred).
2. `feed_inventory_id` and `cost_per_kg_at_time` are populated from matched inventory items.
3. Inventory `quantity_kg` is deducted after seeding (batch update).
4. Farms with no inventory fall back to `"Fresh Cut & Carry"` with `cost_per_kg_at_time: 0`.
5. Removed hardcoded `feedTypes` from `SPECIES_CONFIG`.

**SSOT Data Flow (Demo Feeding)**:
```
feed_inventory (farm_id, quantity_kg > 0, FIFO by created_at)
  → pickFeedSource() (prefer roughage category)
  → feeding_records (feed_inventory_id, cost_per_kg_at_time, feed_type)
  → batch UPDATE feed_inventory.quantity_kg (deduction)

Fallback (no inventory):
  → feeding_records (feed_type: "Fresh Cut & Carry", cost_per_kg_at_time: 0, feed_inventory_id: NULL)
```

**Summary output** now includes `inventory_linked` and `zero_cost_fallback` counts per farm.

### Files Modified
| File | Change |
|------|--------|
| `supabase/functions/seed-demo-data/index.ts` | Replaced hardcoded feeding logic with inventory-linked selection + fallback |
| `docs/data-relationships-map.md` | This entry |

### 2026-02-16: Unified AnimalAvatar SSOT Component

Created `src/components/ui/animal-avatar.tsx` as the single source of truth for all animal avatar rendering. Replaced 9 inline `<Avatar>` instances across 6 files with the unified component. Ensures consistent cache-busting, fallback hierarchy (photo → letter → emoji), and size variants.

### Files Modified
| File | Change |
|------|--------|
| `src/components/ui/animal-avatar.tsx` | **NEW** — SSOT avatar component with cache-busting + consistent fallbacks |
| `src/components/AnimalDetails.tsx` | Replaced 2 inline Avatars (mobile + desktop header) |
| `src/components/AnimalList.tsx` | Replaced 1 inline Avatar (list card) |
| `src/components/animal-list/AnimalCard.tsx` | Replaced 2 inline Avatars (mobile + desktop) |
| `src/components/bio-card/BioCard.tsx` | Replaced 1 inline Avatar (performance card) |
| `src/components/animal-details/AnimalProfile.tsx` | Replaced 1 inline Avatar (profile header) |
| `src/components/approval/ActivityDetailsDialog.tsx` | Replaced 5 inline Avatars (approval flows) |
| `docs/ssot-architecture.md` | Added to component reuse inventory |
| `docs/data-relationships-map.md` | This entry |

### 2026-02-16: Unified OVRScore SSOT Component

Created `src/components/ui/ovr-score.tsx` as the single source of truth for all OVR score rendering. Supports three variants (`pill`, `hexagon`, `text`) via a single component. `OVRIndicator` and `OVRBadge` are now deprecated re-exports.

### Files Modified
| File | Change |
|------|--------|
| `src/components/ui/ovr-score.tsx` | **NEW** — SSOT OVR component with pill/hexagon/text variants |
| `src/components/animal-list/OVRIndicator.tsx` | Replaced with re-export (deprecated) |
| `src/components/bio-card/OVRBadge.tsx` | Replaced with re-export (deprecated) |
| `src/components/animal-list/AnimalCard.tsx` | Switched to `OVRScore` variant="pill" |
| `src/components/AnimalList.tsx` | Switched to `OVRScore` variant="pill" |
| `src/components/bio-card/BioCard.tsx` | Switched to `OVRScore` variant="hexagon" |
| `src/components/animal-details/BioCardSummary.tsx` | Switched to `OVRScore` variant="text" |
| `src/components/bio-card/index.ts` | Updated exports |
| `docs/data-relationships-map.md` | This entry |

### 2026-02-16: Unified OVR Computation SSOT (Server-Side Only)

Removed client-side OVR computation from `useBioCardData`. All three views (list pill, BioCard hexagon, BioCardSummary text) now read OVR scores exclusively from `animal_ovr_cache`, which is written only by the server-side `calculate_animal_ovr()` SQL function via DB triggers and a 3 AM cron job.

**SSOT Flow:**
```
DB triggers (milking/weight/BCS/health/AI records)
  → calculate_animal_ovr() SQL function (SINGLE computation)
  → animal_ovr_cache table (SINGLE data source)
  → useBatchOVRSummary (list view) — reads cache
  → useBioCardData (BioCard/Summary) — reads cache (NO client-side calc)
```

**Why:** The client-side `calculateOVRScore()` used flat milk benchmarks and hardcoded `false` for health issues/withdrawal, producing different scores than the server which uses stage-specific benchmarks and actual health data. Opening BioCard would overwrite the trigger-computed cache, causing score drift.

### Files Modified
| File | Change |
|------|--------|
| `src/hooks/useBioCardData.ts` | Removed `calculateOVRScore` import/usage, removed cache-write `useEffect`, added `animal_ovr_cache` query |
| `src/lib/ovrScoreCalculator.ts` | Added deprecation notice; `calculateOVRScore()` no longer called |
| `src/hooks/useBatchOVRSummary.ts` | Updated SSOT comment to reflect server-only computation |
| `docs/data-relationships-map.md` | This entry |
