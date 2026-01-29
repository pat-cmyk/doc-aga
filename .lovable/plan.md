

# Demo Data Seed Plan: Estehanon Farm
## Presentation Preparation for Jan 23, 2026

### Current State Summary

| Data Type | Current Records | Date Range | Gap |
|-----------|----------------|------------|-----|
| **Milking Records** | 41 records | Jan 8-29, 2026 | Missing Oct 22, 2025 - Jan 7, 2026 |
| **Feeding Records** | 102 records | Jan 2-28, 2026 | Missing Oct 22, 2025 - Jan 1, 2026 |
| **Heat Detection** | 2 observations | Jan 15-17, 2026 | No breeding events recorded |
| **Milk Sales Revenue** | 32 records | Jan 8-29, 2026 | ₱14,371 total |
| **AI Records** | 0 | None | Needs full breeding cycle data |

### Target Date Range
- **Start**: October 22, 2025
- **End**: January 22, 2026 (3 months of complete data)
- **Days to Fill**: ~78 days of missing data

---

## Animals in Demo Farm

| Name | Ear Tag | Type | Gender | Status | Daily Production Target |
|------|---------|------|--------|--------|------------------------|
| Bessie | A002 | Cattle | Female | Early Lactation | 8-12L/day |
| Tita Barbecue | C0001 | Cattle | Female | Early Lactation | 8-12L/day |
| Mang Flora | C0002 | Cattle | Female | Not Lactating (heifer) | N/A (breeding candidate) |
| Olens Main | Olens | Cattle | Male | Young Bull | N/A |
| Tsibato | G001 | Goat | Female | Early Lactation | 1-2L/day |
| (Unnamed) | G002 | Goat | Female | Early Lactation | 1-2L/day |

---

## Phase 1: Milk Production Data

### Seed Data Strategy
Generate daily AM and PM milking sessions for lactating animals.

**Production Targets (Realistic Average, Premium Pricing):**
- **Cattle (Bessie, Tita Barbecue)**: 8-12L/day total (4-6L AM, 4-6L PM)
- **Goats (Tsibato, G002)**: 1-2L/day total (0.5-1L AM, 0.5-1L PM)

**Pricing (Premium):**
- Cattle milk: ₱40/L
- Goat milk: ₱60/L

**Sales**: 100% sold - all records marked with `is_sold = true` and `sale_amount` calculated

**Date Range to Insert**: Oct 22, 2025 → Jan 7, 2026 (before existing data starts)

### SQL Insert Pattern
```text
For each day in range:
  For each lactating animal:
    INSERT milking_record (AM session)
    INSERT milking_record (PM session)
    INSERT farm_revenues (Milk Sales) - daily batch
```

---

## Phase 2: Feeding Records

### Seed Data Strategy
Daily feeding entries using existing feed inventory items.

**Feeding Schedule:**
- **Cattle**: ~15-20kg roughage + 3-5kg concentrates per day
- **Goats**: ~2-3kg roughage + 0.5-1kg concentrates per day

**Feed Inventory Available:**
- Roughage: Bag Corn Silage, Baled Corn Silage, Sako, Soya
- Concentrates: Copra, Rice Bran, Rumsol Feeds Cattle Grower

**Date Range to Insert**: Oct 22, 2025 → Jan 1, 2026

---

## Phase 3: Active Breeding Program

### Breeding Story Arc

**Scenario**: Mang Flora (breeding heifer, born Nov 2023, now ~2 years old) goes through a complete breeding cycle.

| Date | Event | Animal | Details |
|------|-------|--------|---------|
| Nov 1, 2025 | Heat Observed | Mang Flora | Standing heat, vulva swelling |
| Nov 2, 2025 | AI Service | Mang Flora | Technician: "Dr. Santos", Semen: "Angus A-102" |
| Nov 22, 2025 | No Return Check | Mang Flora | 21 days - no return to heat (positive sign) |
| Dec 7, 2025 | Pregnancy Check | Mang Flora | Confirmed pregnant at 35 days |
| Jan 5, 2026 | Routine Check | Mang Flora | 65 days pregnant, healthy |

**Additional Heat Observations (goats cycle every ~21 days):**
- Tsibato: Oct 25, Nov 15, Dec 6, Dec 27 (observed but not bred)
- G002: Oct 30, Nov 20, Dec 11, Jan 1 (observed but not bred)

### Tables to Populate
1. `breeding_events` - For heat observations and AI events
2. `ai_records` - For artificial insemination details
3. `heat_observation_checks` - Daily heat monitoring

---

## Technical Implementation

### Step 1: Update Animal Entry Dates
Before seeding historical data, backdate animal `farm_entry_date` to allow records:

```text
Animals needing farm_entry_date update:
- Bessie: Change from Jan 8 → Oct 15, 2025
- Tita Barbecue: Change from Dec 30 → Oct 15, 2025
- Mang Flora: Already Jan 2 → Change to Oct 15, 2025
- Tsibato: Needs entry date → Oct 15, 2025
- G002: Change from Jan 8 → Oct 15, 2025
```

### Step 2: Set Milking Start Dates
Adjust milking_start_date to enable historical milk records:

```text
- Bessie: Change from Jan 8 → Oct 22, 2025
- Tita Barbecue: Change from Jan 8 → Oct 22, 2025
- Tsibato: Change from Jan 8 → Oct 22, 2025
- G002: Change from Jan 8 → Oct 22, 2025
- Mang Flora: Keep NULL (not lactating - she's a breeding heifer)
```

### Step 3: Insert Milking Records
~78 days × 4 lactating animals × 2 sessions = ~624 new milking records

### Step 4: Insert Milk Sales Revenue
Batch daily sales into farm_revenues table with source = 'Milk Sales'

### Step 5: Insert Feeding Records
~72 days × 6 animals × 1 record/day = ~432 new feeding records

### Step 6: Insert Breeding Events
~15-20 breeding_events records for the active breeding program

### Step 7: Recalculate Daily Farm Stats
Run ensure_farm_stats RPC to regenerate aggregated statistics

---

## Expected Demo Outcomes

After seeding, the farm dashboard will show:

1. **Milk Production Chart**: 3-month trend with consistent daily production
2. **Total Milk Produced**: ~7,000-8,000L (cattle) + ~250-300L (goats)
3. **Total Milk Revenue**: ~₱300,000-350,000 (at premium pricing)
4. **Feeding History**: Complete daily feeding logs
5. **Breeding Hub**: Active breeding program with pregnancy confirmation
6. **Heat Calendar**: Regular heat observations for all females

---

## Summary of SQL Operations

| Operation | Records | Table |
|-----------|---------|-------|
| Update animal dates | 5 | animals |
| Insert milking (AM) | ~312 | milking_records |
| Insert milking (PM) | ~312 | milking_records |
| Insert milk revenues | ~78 | farm_revenues |
| Insert feeding records | ~432 | feeding_records |
| Insert breeding events | ~20 | breeding_events |
| Insert AI records | 1 | ai_records |
| Insert heat checks | ~30 | heat_observation_checks |
| Regenerate stats | - | daily_farm_stats (via RPC) |

**Total**: ~1,200 new records to create a complete 3-month demo dataset

