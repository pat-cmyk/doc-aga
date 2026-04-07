# CAIN Milk-In, Feed-Out Cooperative Module — Design Spec

**Date:** 2026-04-07
**Status:** Draft
**Authors:** Pat Buna + Claude

---

## Context

The CAIN (Cooperative Aggregator and Integrated Nutrition) program is Golden Forage's proposed cooperative model being advocated to the Philippine Department of Agriculture and National Dairy Authority. The core mechanism is "Milk-In, Feed-Out": dairy farmers deliver milk to a cooperative hub, the same vehicle returns with TMR/feed as an in-kind loan, and the feed cost is automatically deducted from the farmer's milk check — cashless, zero empty miles.

Doc Aga's existing cooperative module is a **read-only aggregation dashboard** (7 tabs: Overview, Member Farms, Milk Production, Herd Summary, Health, Financials, Settings). It can monitor but cannot operate. This spec extends the cooperative module into a **full operational platform** for the Milk-In, Feed-Out system, making Doc Aga the working platform for CAIN implementation.

**Problem:** The cooperative currently has zero transactional capability. For CAIN, it needs to:
1. Record milk received from member farms (separate ledger from the farm's own milking_records)
2. Manage the hub's own feed inventory (silage, TMR, concentrates)
3. Record feed disbursed to member farms (with auto-sync to the farm's feed inventory)
4. Maintain a standing milk price schedule by species
5. Generate bi-monthly Statements of Account (SOA) showing net payable/collectible per member farm

**Outcome:** The cooperative becomes a transactional hub — coop admins can run the Milk-In, Feed-Out loop daily, and farmers see their deliveries, feed receipts, and SOA balance in their own Doc Aga account.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Milk ledger model | Separate coop ledger (`coop_milk_receivings`) with farm FIFO deduction | Coop records at hub independently. Farm's milk_inventory is FIFO-deducted (like a sale) to keep inventory accurate. No farm_revenue created (payment via SOA). |
| Feed sync to farm | Auto-create `feed_inventory` entry on farm side | Zero friction for farmer. Feed appears ready for feeding records. Tagged `supplier = 'Cooperative Hub'` to distinguish from self-purchased. |
| SOA settlement period | Bi-monthly (1st-15th, 16th-end of month) | Aligns with typical PH dairy cooperative pay cycles. |
| Milk pricing | Standing price list by species with effective dates | Simplifies daily hub operations. Price auto-populates on receipt, can be overridden per transaction. |
| Architecture | Extend existing cooperative module | Follows established SECURITY DEFINER RPC pattern, same dashboard shell, SSOT-compliant. |
| Record immutability | Correction entries (reversal + correction pairs) | Government funds are involved — every transaction must be traceable. No edits or deletes. "Corrections" create a reversal of the original + a new corrected entry. SOA computes on active records only. |

---

## Immutability & Audit Trail

All operational records (`coop_milk_receivings`, `coop_feed_disbursements`) are **immutable after creation**. No UPDATEs or DELETEs are permitted on the core data fields. Corrections follow a **reversal + correction pair** pattern (similar to double-entry accounting):

### Correction Flow

**Example:** Coop admin recorded 50L milk from Farm A, but the actual volume was 45L.

1. **Original stays untouched:** Record #001 — `+50L, entry_type = 'original', status = 'reversed'`
2. **Reversal created:** Record #002 — `-50L, entry_type = 'reversal', original_id = #001, reversal_reason = "Volume correction"`
3. **Correction created:** Record #003 — `+45L, entry_type = 'correction', original_id = #001, reversal_reason = "Volume correction"`

**Net effect:** 50 - 50 + 45 = 45L. Full trail preserved. Every record has a timestamp and `created_by` for audit.

### Rules

- **No DELETE** on `coop_milk_receivings` or `coop_feed_disbursements` — ever.
- **No UPDATE** on core data fields (volume, price, quantity, cost). Only `status` can be updated (from 'active' to 'reversed').
- All queries that compute totals (SOA, dashboards) filter `WHERE status = 'active'` — reversed entries are excluded and their reversal/correction pairs provide the corrected values.
- Feed disbursement reversals must also reverse the farm-side `feed_inventory` entry (mark it with `quantity_kg = 0` or create a negative adjustment).
- The `coop_milk_price_schedule` is append-only — prices are never edited, only superseded by new effective dates.
- `coop_soa_periods` tracks `revision_number` — if a finalized SOA needs re-computation (due to corrections in the period), the revision increments and links to the previous version.

### Farmer Visibility

The farmer's "My Cooperative" view shows **net results** by default (reversals cancel out). An expandable detail view shows the full correction trail for transparency.

---

## Data Architecture

### New Tables

#### 1. `coop_milk_price_schedule`

Standing price list. When recording a milk receipt, price auto-populates from the active entry for that species.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `cooperative_id` | UUID | FK → cooperatives, NOT NULL | |
| `species` | TEXT | NOT NULL | 'cattle', 'goat', 'carabao', 'sheep' |
| `price_per_liter` | NUMERIC | NOT NULL, >= 0 | Active price in PHP |
| `effective_date` | DATE | NOT NULL | When this price takes effect |
| `notes` | TEXT | | Reason for price change |
| `created_by` | UUID | FK → auth.users | Admin who set it |
| `created_at` | TIMESTAMPTZ | default now() | |

**Unique constraint:** `(cooperative_id, species, effective_date)` — one price per species per date.

**Active price query pattern:** `WHERE cooperative_id = $1 AND species = $2 AND effective_date <= CURRENT_DATE ORDER BY effective_date DESC LIMIT 1`

---

#### 2. `coop_milk_receivings`

The hub's own ledger of milk received from member farms. Independent of the farm's `milking_records`.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `cooperative_id` | UUID | FK → cooperatives, NOT NULL | |
| `farm_id` | UUID | FK → farms, NOT NULL | Which member farm delivered |
| `receiving_date` | DATE | NOT NULL | Date of delivery |
| `session` | TEXT | NOT NULL, CHECK IN ('AM','PM','Full Day') | |
| `volume_liters` | NUMERIC | NOT NULL, > 0 | Total liters received |
| `species` | TEXT | NOT NULL | Source animal species |
| `milk_quality` | TEXT | NOT NULL, CHECK IN ('good','rejected'), default 'good' | |
| `price_per_liter` | NUMERIC | NOT NULL, >= 0 | From schedule, overridable |
| `total_value` | NUMERIC | GENERATED ALWAYS AS (volume_liters * price_per_liter) STORED | |
| `received_by` | UUID | FK → auth.users | Hub operator |
| `notes` | TEXT | | |
| `farm_milk_deductions` | JSONB | | Array of {milk_inventory_id, liters_deducted} — tracks FIFO deduction from farm milk_inventory |
| `status` | TEXT | NOT NULL, CHECK IN ('active','reversed'), default 'active' | Immutability: only status can change |
| `entry_type` | TEXT | NOT NULL, CHECK IN ('original','reversal','correction'), default 'original' | Type of ledger entry |
| `original_receiving_id` | UUID | FK → coop_milk_receivings, NULL for originals | Links reversal/correction to original |
| `reversal_reason` | TEXT | | Why the correction was made |
| `created_at` | TIMESTAMPTZ | default now() | |

**Indexes:**
- `idx_coop_milk_receivings_coop_date` ON (cooperative_id, receiving_date DESC)
- `idx_coop_milk_receivings_farm` ON (farm_id, receiving_date DESC)
- `idx_coop_milk_receivings_active` ON (cooperative_id, farm_id) WHERE status = 'active'

---

#### 3. `coop_feed_inventory`

The hub's own feed stock. Mirrors the farm-level `feed_inventory` structure for consistency.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `cooperative_id` | UUID | FK → cooperatives, NOT NULL | |
| `feed_type` | TEXT | NOT NULL | e.g., "Corn Silage", "TMR Blend A", "Dairy Concentrate" |
| `category` | TEXT | NOT NULL, default 'roughage' | 'concentrates', 'roughage', 'minerals', 'supplements' |
| `quantity_kg` | NUMERIC | NOT NULL, >= 0 | Current stock |
| `cost_per_kg` | NUMERIC | NOT NULL, >= 0 | Unit cost in PHP/kg |
| `purchase_date` | DATE | | |
| `supplier` | TEXT | | e.g., "Corn Farmer Buyback", "External Supplier" |
| `batch_number` | TEXT | | |
| `expiry_date` | DATE | | |
| `notes` | TEXT | | |
| `created_by` | UUID | FK → auth.users | |
| `created_at` | TIMESTAMPTZ | default now() | |
| `last_updated` | TIMESTAMPTZ | default now() | |

**Indexes:**
- `idx_coop_feed_inventory_coop` ON (cooperative_id)
- `idx_coop_feed_inventory_category` ON (category)

---

#### 4. `coop_feed_disbursements`

Feed released from hub to member farm. Triggers auto-sync to farm's `feed_inventory`.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `cooperative_id` | UUID | FK → cooperatives, NOT NULL | |
| `farm_id` | UUID | FK → farms, NOT NULL | Receiving farm |
| `coop_feed_inventory_id` | UUID | FK → coop_feed_inventory, NOT NULL | Source stock |
| `disbursement_date` | DATE | NOT NULL | |
| `feed_type` | TEXT | NOT NULL | Denormalized from inventory |
| `category` | TEXT | NOT NULL | Denormalized from inventory |
| `quantity_kg` | NUMERIC | NOT NULL, > 0 | Amount released |
| `cost_per_kg` | NUMERIC | NOT NULL, >= 0 | Locked from inventory at disbursement time |
| `total_cost` | NUMERIC | GENERATED ALWAYS AS (quantity_kg * cost_per_kg) STORED | |
| `disbursed_by` | UUID | FK → auth.users | Hub operator |
| `farm_feed_inventory_id` | UUID | FK → feed_inventory | Auto-created entry on farm side |
| `notes` | TEXT | | |
| `status` | TEXT | NOT NULL, CHECK IN ('active','reversed'), default 'active' | Immutability: only status can change |
| `entry_type` | TEXT | NOT NULL, CHECK IN ('original','reversal','correction'), default 'original' | Type of ledger entry |
| `original_disbursement_id` | UUID | FK → coop_feed_disbursements, NULL for originals | Links reversal/correction to original |
| `reversal_reason` | TEXT | | Why the correction was made |
| `created_at` | TIMESTAMPTZ | default now() | |

**Indexes:**
- `idx_coop_feed_disbursements_coop_date` ON (cooperative_id, disbursement_date DESC)
- `idx_coop_feed_disbursements_farm` ON (farm_id, disbursement_date DESC)
- `idx_coop_feed_disbursements_active` ON (cooperative_id, farm_id) WHERE status = 'active'

---

#### 5. `coop_soa_periods`

Pre-computed Statement of Account per member farm per bi-monthly period.

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK, default gen_random_uuid() | |
| `cooperative_id` | UUID | FK → cooperatives, NOT NULL | |
| `farm_id` | UUID | FK → farms, NOT NULL | |
| `period_start` | DATE | NOT NULL | 1st or 16th of month |
| `period_end` | DATE | NOT NULL | 15th or last day of month |
| `total_milk_liters` | NUMERIC | NOT NULL, default 0 | Sum of receivings in period |
| `total_milk_value` | NUMERIC | NOT NULL, default 0 | Sum of milk value |
| `total_feed_kg` | NUMERIC | NOT NULL, default 0 | Sum of disbursements in period |
| `total_feed_cost` | NUMERIC | NOT NULL, default 0 | Sum of feed cost |
| `net_balance` | NUMERIC | NOT NULL, default 0 | milk_value - feed_cost |
| `status` | TEXT | NOT NULL, CHECK IN ('draft','finalized','settled'), default 'draft' | |
| `finalized_at` | TIMESTAMPTZ | | When admin locks the period |
| `settled_at` | TIMESTAMPTZ | | When payment is made |
| `notes` | TEXT | | |
| `revision_number` | INTEGER | NOT NULL, default 1 | Increments on re-computation after corrections |
| `previous_soa_id` | UUID | FK → coop_soa_periods | Links to prior revision (NULL for first) |
| `created_by` | UUID | FK → auth.users | |
| `created_at` | TIMESTAMPTZ | default now() | |

**Unique constraint:** `(cooperative_id, farm_id, period_start, revision_number)` — one SOA per farm per period per revision.

**Indexes:**
- `idx_coop_soa_coop_period` ON (cooperative_id, period_start DESC)
- `idx_coop_soa_farm` ON (farm_id, period_start DESC)
- `idx_coop_soa_status` ON (status) WHERE status != 'settled'

---

## Operational Flows

### Daily Hub Operations (Coop Admin)

#### Morning — Milk-In

1. Farmer arrives at hub with milk
2. Coop admin opens **Milk Collection** tab → clicks **Record Milk Receipt**
3. `RecordMilkReceiptDialog` opens:
   - Select member farm (dropdown: accepted members only via `get_cooperative_farm_ids()`)
   - Enter: volume (liters), species, session (AM/PM/Full Day), quality (good/rejected)
   - Price auto-populates from `coop_milk_price_schedule` via `get_active_coop_price(cooperative_id, species)`
   - Price is editable (override allowed)
   - Total value computed live: `volume × price`
4. On submit: calls `record_coop_milk_receiving()` RPC
5. RPC internally:
   - Inserts `coop_milk_receivings` record
   - **Farm-side FIFO deduction:** Deducts `volume_liters` from the farm's `milk_inventory` using FIFO (oldest available first), mirroring the existing `RecordMilkSaleDialog` deduction pattern:
     - Queries `milk_inventory` WHERE `farm_id` = target farm, `is_available = true`, `milk_quality = 'good'`, ordered by `record_date ASC`
     - Deducts liters from each inventory record until volume is fulfilled (supports partial deduction)
     - Sets `is_available = false` on fully consumed records
     - Records the deduction details in `farm_milk_deductions` JSONB column
   - Does **NOT** create a `farm_revenues` entry (payment happens via SOA settlement, not per-delivery)
6. Receipt appears in daily log, farm milk inventory reflects the deduction

#### Return Trip — Feed-Out

1. Same visit — coop admin opens **Feed Disbursement** tab → clicks **Record Feed Release**
2. `RecordFeedDisbursementDialog` opens:
   - Select member farm (same dropdown)
   - Select from hub's available feed inventory (shows: feed_type, category, quantity_kg available, cost_per_kg)
   - Enter quantity (kg) to disburse
   - `cost_per_kg` locked from selected inventory item (read-only)
   - Total cost computed live: `quantity × cost_per_kg`
3. On submit: calls `record_coop_feed_disbursement()` RPC
4. RPC internally:
   - Validates sufficient stock (`coop_feed_inventory.quantity_kg >= requested`)
   - Deducts from `coop_feed_inventory.quantity_kg`
   - Creates `feed_inventory` entry on farm side:
     - `farm_id` = target farm
     - `feed_type`, `category` from coop inventory
     - `quantity_kg` = disbursed amount
     - `cost_per_unit` = `cost_per_kg` (already in PHP/kg)
     - `unit` = 'kg', `weight_per_unit` = 1
     - `supplier` = 'Cooperative Hub'
     - `purchase_date` = disbursement_date
   - Links `farm_feed_inventory_id` back to the disbursement record

#### Price Management

1. Coop admin opens **Price Schedule** tab
2. Views current prices per species (cattle, goat, carabao, sheep)
3. Clicks **Set Price** → `SetMilkPriceDialog`:
   - Select species, enter new price, effective date, optional notes
4. Calls `set_coop_milk_price()` RPC
5. History preserved — previous entries remain (no updates/deletes, only new effective dates)

#### SOA Generation (Bi-monthly)

1. Coop admin opens **Statements** tab
2. `CoopSOAList` shows periods with status badges (draft/finalized/settled)
3. For each member farm in a period, system computes:
   - `total_milk_liters` = SUM(`coop_milk_receivings.volume_liters`) WHERE quality = 'good' AND receiving_date BETWEEN period_start AND period_end
   - `total_milk_value` = SUM(`coop_milk_receivings.total_value`) WHERE quality = 'good'
   - `total_feed_kg` = SUM(`coop_feed_disbursements.quantity_kg`)
   - `total_feed_cost` = SUM(`coop_feed_disbursements.total_cost`)
   - `net_balance` = total_milk_value - total_feed_cost
4. Positive net_balance = coop owes farmer. Negative = farmer owes coop (carried forward).
5. Admin reviews → clicks **Finalize** → status becomes 'finalized', `finalized_at` set
6. After payment → clicks **Mark Settled** → status becomes 'settled', `settled_at` set
7. Export: PDF/CSV per farm or batch export

### Farmer Side

#### Feed Inventory (existing tab — enhanced)

- Coop-sourced feed entries auto-appear with a distinct badge: "From Cooperative Hub"
- These entries are **read-only** for cost and supplier fields (coop controls the ledger)
- Farmer can use them normally in feeding records (existing flow, no changes)
- The `cost_per_kg_at_time` in `feeding_records` correctly captures the coop's cost allocation

#### New: "My Cooperative" Section

Visible only when the farm has an accepted `cooperative_memberships` entry.

- **My Milk Deliveries** — read-only table from `coop_milk_receivings` WHERE `farm_id` = my farm
- **My Feed Receipts** — read-only table from `coop_feed_disbursements` WHERE `farm_id` = my farm
- **My Statements** — view SOA per period with:
  - Milk delivered (liters + value)
  - Feed received (kg + cost)
  - Net balance (payable or collectible)
  - Status (draft/finalized/settled)

---

## Component Architecture

### New Cooperative Dashboard Components

```
src/components/cooperative/hub-operations/
├── CoopMilkCollection.tsx              — Tab: daily log + "Record Receipt" button
├── RecordMilkReceiptDialog.tsx         — Form: farm, volume, species, quality, auto-price
├── CoopMilkReceivingLog.tsx            — Filterable table (by farm, date range)
├── CoopFeedInventory.tsx               — Tab: hub stock list + "Add Stock" button
├── AddCoopFeedStockDialog.tsx          — Form: mirrors AddFeedStockDialog patterns
├── CoopFeedDisbursement.tsx            — Tab: disbursement log + "Record Release" button
├── RecordFeedDisbursementDialog.tsx    — Form: farm, select feed, quantity
├── CoopPriceSchedule.tsx               — Price list + "Set Price" button
├── SetMilkPriceDialog.tsx              — Form: species, price, effective_date
├── CorrectMilkReceivingDialog.tsx      — Correction form: shows original, enter corrected values + reason
├── CorrectFeedDisbursementDialog.tsx   — Correction form: shows original, enter corrected qty + reason
└── CoopStatements.tsx                  — SOA management container
    ├── CoopSOAList.tsx                 — Period list with status badges + revision indicator
    ├── CoopSOADetail.tsx               — Single farm: milk lines + feed lines + net + correction trail
    └── CoopSOAExport.tsx               — PDF/CSV export
```

### New Farmer-Side Components

```
src/components/cooperative/farmer-view/
├── MyCooperativeTab.tsx                — Container (visible only for coop members)
├── MyMilkDeliveries.tsx                — Read-only delivery history
├── MyFeedReceipts.tsx                  — Read-only feed receipt history
└── MyStatementOfAccount.tsx            — View SOA per period with net balance
```

### New Hooks

```
src/hooks/
├── useCoopMilkCollection.ts
│   ├── useCoopMilkReceivings(cooperativeId, dateRange?)
│   ├── useAddCoopMilkReceiving()
│   ├── useCorrectCoopMilkReceiving()                      — Creates reversal + correction pair
│   └── useCoopMilkReceivingsByFarm(cooperativeId, farmId)
│
├── useCoopFeedInventory.ts
│   ├── useCoopFeedInventory(cooperativeId)
│   ├── useAddCoopFeedStock()
│   └── useUpdateCoopFeedStock()
│
├── useCoopFeedDisbursement.ts
│   ├── useCoopFeedDisbursements(cooperativeId, dateRange?)
│   ├── useAddCoopFeedDisbursement()
│   ├── useCorrectCoopFeedDisbursement()                    — Creates reversal + correction pair
│   └── useCoopFeedDisbursementsByFarm(cooperativeId, farmId)
│
├── useCoopPriceSchedule.ts
│   ├── useCoopPriceSchedule(cooperativeId)
│   ├── useSetCoopMilkPrice()
│   └── useActiveCoopPrice(cooperativeId, species)
│
├── useCoopSOA.ts
│   ├── useCoopSOAPeriods(cooperativeId)
│   ├── useCoopSOADetail(cooperativeId, farmId, periodStart, periodEnd)
│   ├── useFinalizeCoopSOA()
│   └── useMyCoopSOA(farmId)
│
├── useMyCooperative.ts
│   ├── useMyCoopMembership(farmId)
│   ├── useMyMilkDeliveries(farmId, dateRange?)
│   └── useMyFeedReceipts(farmId, dateRange?)
```

All hooks: React Query + SECURITY DEFINER RPCs, online-only (no IndexedDB caching for cross-farm data).

---

## Database RPCs

### Coop Admin RPCs (SECURITY DEFINER)

All verify `is_cooperative_admin(auth.uid(), _cooperative_id)` before executing.

| RPC | Parameters | Returns | Purpose |
|-----|-----------|---------|---------|
| `record_coop_milk_receiving` | cooperative_id, farm_id, receiving_date, session, volume_liters, species, milk_quality, price_per_liter, notes | UUID (new id) | Insert milk receipt |
| `get_coop_milk_receivings` | cooperative_id, date_from, date_to | TABLE (all receivings with farm_name join) | List receivings |
| `get_coop_milk_receivings_by_farm` | cooperative_id, farm_id, date_from, date_to | TABLE | Farm-specific receivings |
| `add_coop_feed_stock` | cooperative_id, feed_type, category, quantity_kg, cost_per_kg, purchase_date, supplier, batch_number, expiry_date, notes | UUID | Add feed to hub |
| `get_coop_feed_inventory` | cooperative_id | TABLE (all stock with computed value) | List hub feed |
| `update_coop_feed_stock` | id, quantity_kg (adjustment) | TEXT ('success' or error) | Adjust stock |
| `record_coop_feed_disbursement` | cooperative_id, farm_id, coop_feed_inventory_id, quantity_kg, notes | UUID | Disburse feed + auto-sync to farm |
| `get_coop_feed_disbursements` | cooperative_id, date_from, date_to | TABLE (with farm_name join) | List disbursements |
| `set_coop_milk_price` | cooperative_id, species, price_per_liter, effective_date, notes | UUID | Set new price |
| `get_coop_price_schedule` | cooperative_id | TABLE (all prices, ordered by effective_date DESC) | Price history |
| `get_active_coop_price` | cooperative_id, species | NUMERIC | Current effective price |
| `compute_coop_soa` | cooperative_id, farm_id, period_start, period_end | JSON {milk_liters, milk_value, feed_kg, feed_cost, net_balance, line_items} | Compute SOA (uses WHERE status='active') |
| `finalize_coop_soa` | cooperative_id, farm_id, period_start, period_end | TEXT ('success' or error) | Lock SOA |
| `settle_coop_soa` | cooperative_id, farm_id, period_start, period_end | TEXT | Mark settled |
| `correct_coop_milk_receiving` | original_id, new_volume_liters, new_price_per_liter, reason | UUID (correction id) | Creates reversal + correction pair. Sets original status='reversed'. |
| `correct_coop_feed_disbursement` | original_id, new_quantity_kg, reason | UUID (correction id) | Creates reversal + correction pair. Reverses farm feed_inventory, creates new one. |
| `recompute_coop_soa` | cooperative_id, farm_id, period_start, period_end | UUID (new SOA id) | Re-computes finalized SOA after corrections. Increments revision_number. |

### Farmer RPCs (SECURITY DEFINER, read-only)

All verify the requesting user owns the farm via `is_farm_owner()` or `can_access_farm()`.

| RPC | Parameters | Returns | Purpose |
|-----|-----------|---------|---------|
| `get_my_coop_milk_deliveries` | farm_id, date_from, date_to | TABLE | My deliveries |
| `get_my_coop_feed_receipts` | farm_id, date_from, date_to | TABLE | My feed from hub |
| `get_my_coop_soa` | farm_id, period_start, period_end | JSON | My SOA |
| `get_my_coop_membership` | farm_id | TABLE (cooperative_id, cooperative_name, status) | Am I in a coop? |

---

## DB Triggers

### Milk Receipt — Farm Inventory Sync

Handled inside the `record_coop_milk_receiving` RPC (not a trigger — needs transactional control):
1. Query farm's `milk_inventory` WHERE `farm_id = _farm_id`, `is_available = true`, `milk_quality = 'good'`, `liters_remaining >= 0.05` ORDER BY `record_date ASC`
2. FIFO deduction loop: for each inventory record, deduct min(remaining_to_deduct, liters_remaining)
3. Update `milk_inventory.liters_remaining` and set `is_available = false` if fully consumed
4. Store deduction details in `coop_milk_receivings.farm_milk_deductions` as JSONB: `[{milk_inventory_id, liters_deducted}]`
5. If farm doesn't have enough available milk inventory to cover the full volume → RPC still succeeds (the coop's own receiving record is the source of truth; the farm inventory deduction is best-effort — farm may not have recorded all milking yet)

**Correction reversal:** When a milk receiving is reversed, the FIFO deductions are reversed — `liters_remaining` is restored on each `milk_inventory` record, `is_available` is set back to `true` where applicable. The deduction details in `farm_milk_deductions` provide the exact records to reverse.

### `on_coop_feed_disbursement_insert`

**Fires:** AFTER INSERT on `coop_feed_disbursements`
**Actions:**
1. Validate: `coop_feed_inventory.quantity_kg >= NEW.quantity_kg` (raise exception if insufficient)
2. UPDATE `coop_feed_inventory` SET `quantity_kg = quantity_kg - NEW.quantity_kg`, `last_updated = now()`
3. INSERT INTO `feed_inventory`:
   - `farm_id = NEW.farm_id`
   - `feed_type = NEW.feed_type`
   - `category = NEW.category`
   - `quantity_kg = NEW.quantity_kg`
   - `cost_per_unit = NEW.cost_per_kg`
   - `unit = 'kg'`
   - `weight_per_unit = 1`
   - `supplier = 'Cooperative Hub'`
   - `purchase_date = NEW.disbursement_date`
4. UPDATE `coop_feed_disbursements` SET `farm_feed_inventory_id = (new feed_inventory id)`

---

## Security Model

### RLS Policies (all new tables)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `coop_milk_price_schedule` | Coop admin | Coop admin | None (append-only) | None |
| `coop_milk_receivings` | Coop admin OR farm owner (own farm_id) | Via RPC only | `status` field only, via RPC (reversal) | None (immutable) |
| `coop_feed_inventory` | Coop admin | Coop admin | Coop admin (quantity adjustments) | None |
| `coop_feed_disbursements` | Coop admin OR farm owner (own farm_id) | Via RPC only | `status` field only, via RPC (reversal) | None (immutable) |
| `coop_soa_periods` | Coop admin OR farm owner (own farm_id) | Via RPC only | Via RPC only (finalize/settle) | None |

**Immutability enforcement:** UPDATE policies on `coop_milk_receivings` and `coop_feed_disbursements` restrict updates to the `status` column only. All other columns are frozen after INSERT. This is enforced at the RLS policy level with a CHECK that only `status` differs between OLD and NEW rows.

All cross-farm queries go through SECURITY DEFINER RPCs that verify `is_cooperative_admin()` internally. Farmer-side reads verify farm ownership.

### Farm-side feed_inventory entries from coop

The auto-created `feed_inventory` entries are owned by the farm (existing RLS applies). However, they are tagged with `supplier = 'Cooperative Hub'`. The farmer can:
- **Use** them in feeding records (normal flow)
- **View** cost and source
- **Cannot edit** the cost_per_unit or supplier (enforced via UI — the coop ledger is the source of truth)

---

## Reusable Existing Assets

| Existing Asset | Location | Reuse For |
|---------------|----------|-----------|
| `feed_inventory` table schema | DB | `coop_feed_inventory` mirrors same structure |
| `FEED_CATEGORIES` constants | `src/lib/feedInventory.ts` | Same categories for coop feed |
| `calculateInventoryValue()` | `src/lib/feedInventory.ts` | Compute coop inventory value |
| `REVENUE_SOURCE_KEYS` | `src/lib/revenueCategories.ts` | Pattern for SOA revenue computation |
| `useCooperative*.ts` hook patterns | `src/hooks/useCooperative.ts` | New hooks follow same React Query + RPC pattern |
| `RecordMilkSaleDialog` UX + FIFO logic | `src/components/milk-inventory/RecordMilkSaleDialog.tsx` | Coop milk receipt dialog structure + FIFO deduction pattern for farm milk_inventory |
| `deductMilkFromInventoryCache()` | `src/lib/dataCache.ts` | Pattern reference for farm-side milk inventory deduction |
| `AddFeedStockDialog` UX patterns | `src/components/feed-inventory/AddFeedStockDialog.tsx` | Coop feed stock dialog structure |
| `FinanceDateRangePicker` | `src/components/finance/FinanceDateRangePicker.tsx` | SOA period selection |
| `financialReportGenerator.ts` | `src/lib/financialReportGenerator.ts` | SOA report structure and patterns |
| `financialReportExport.ts` | `src/lib/financialReportExport.ts` | SOA PDF/CSV export |
| `is_cooperative_admin()` | DB function | Auth check for all new RPCs |
| `get_cooperative_farm_ids()` | DB function | Farm dropdown population |
| `MILK_QUALITY_OPTIONS` | `src/constants/milkQuality.ts` | Quality options in milk receipt form |
| `useLastMilkPriceBySpecies` pattern | `src/hooks/useRevenues.ts` | Pattern for coop price schedule queries |

---

## Cooperative Dashboard Tab Updates

The existing 7 tabs remain unchanged. Five new tabs are added:

| # | Tab | Icon | Content |
|---|-----|------|---------|
| 1-7 | (existing) | (unchanged) | (unchanged) |
| 8 | **Milk Collection** | Droplet icon | `CoopMilkCollection` — daily log + Record Receipt |
| 9 | **Hub Feed** | Package icon | `CoopFeedInventory` — hub stock management |
| 10 | **Feed Release** | Truck icon | `CoopFeedDisbursement` — disbursement log + Record Release |
| 11 | **Pricing** | Tag icon | `CoopPriceSchedule` — price list by species |
| 12 | **Statements** | FileText icon | `CoopStatements` — SOA management |

---

## Farmer Dashboard Update

A new **"My Cooperative"** tab/section appears in the farmer's dashboard, visible only when `useMyCoopMembership(farmId)` returns an accepted membership.

Content:
- `MyMilkDeliveries` — table of deliveries to hub (date, volume, species, price, value)
- `MyFeedReceipts` — table of feed received from hub (date, type, kg, cost)
- `MyStatementOfAccount` — current period SOA with net balance + history

---

## Verification Plan

### Data Layer
1. Create all 5 tables via migration SQL
2. Create all RPCs + trigger via migration SQL
3. Run in Supabase SQL Editor
4. Verify via direct queries: insert test data, confirm trigger fires, confirm farm feed_inventory auto-creation

### Coop Admin Flow
1. Login as cooperative admin
2. Set milk prices via Price Schedule tab
3. Record milk receipt for a member farm → verify:
   - Appears in coop milk collection log
   - Farm's `milk_inventory` FIFO-deducted (liters_remaining decreased, is_available updated)
   - `farm_milk_deductions` JSONB populated with deduction details
   - No `farm_revenues` entry created (payment via SOA only)
4. Add feed stock to hub inventory → verify appears in Hub Feed tab
5. Record feed disbursement to member farm → verify:
   - Hub inventory decremented
   - Disbursement appears in log
   - Farm's feed_inventory has new entry with `supplier = 'Cooperative Hub'`
6. Generate SOA for a period → verify milk + feed totals + net balance
7. Finalize SOA → verify status change
8. Export SOA to PDF → verify document

### Farmer Flow
1. Login as farm owner (member of the cooperative)
2. Navigate to "My Cooperative" section → verify visibility
3. View milk deliveries → verify matches coop's records
4. View feed receipts → verify matches disbursements
5. View SOA → verify net balance matches
6. Go to Feed Inventory tab → verify coop-sourced entries appear with badge
7. Record feeding using coop-sourced feed → verify `cost_per_kg_at_time` captures coop cost

### Immutability & Corrections
1. Record a milk receipt → attempt direct UPDATE on volume_liters → should be blocked by RLS
2. Record a milk receipt → correct it via `correct_coop_milk_receiving` RPC → verify:
   - Original record status = 'reversed'
   - Reversal record created with negative volume, entry_type = 'reversal'
   - Correction record created with correct volume, entry_type = 'correction'
   - SOA query returns only the corrected net amount
3. Record a feed disbursement → correct it → verify:
   - Hub inventory adjusts correctly (reversed amount restored, new amount deducted)
   - Farm feed_inventory: original entry zeroed out, new entry created
   - Farmer's "My Feed Receipts" shows net result
4. Finalize an SOA → make a correction in that period → recompute SOA → verify revision_number increments and previous_soa_id links to prior version
5. Farmer views correction trail → verify expandable detail shows original + reversal + correction

### Edge Cases
- Disbursement exceeding hub stock → should fail with error
- SOA for period with no transactions → should show zeros
- Farm not a coop member → "My Cooperative" section should not appear
- Price change mid-period → receipts before change use old price, after use new price
- Correction on already-reversed record → should fail (can't reverse twice)
- Correction that would make hub stock negative → should fail with error
