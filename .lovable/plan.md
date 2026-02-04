

# Plan: Expand Demo Data for Government Dashboard

## Current State Assessment

### Regional Coverage (Currently Only 4 Regions)
| Region | Demo Farms | Animals | Notes |
|--------|-----------|---------|-------|
| NCR | 1 | 14 | nXscale Farm (cattle only) |
| Region IV-A | 12 | 160 | Heavy concentration, mostly single-species |
| Region IV-A (CALABARZON) | 1 | 32 | Multi-species (cattle, goat, carabao) |
| Region VIII | 2 | 9 | Estehanon + Samar Goat Farm |

### Data Quality Issues
1. **Too concentrated in Region IV-A** - 12 of 15 farms in one region
2. **Limited multi-species farms** - Most farms are single-species
3. **Data time range gaps**:
   - Milking records: Nov 2025 - Jan 2026 (only ~3 months)
   - Health records: Nov 2024 - Dec 2025 (~13 months, good)
   - Weight records: Nov 2024 - Jan 2026 (~14 months, good)
4. **Missing sales data** - Only 2 farms have milk sales (nXscale, Estehanon)
5. **Limited breeding data** - Only Estehanon has breeding events
6. **Limited feeding records** - Only 3 farms have feeding data

### Target State
- **17 Regions** with 3 farms each = **51 farms** 
- Each farm: multi-species (cattle + goat OR carabao + goat)
- **12 months** of milking, health, weight, feeding, and sales records
- Breeding cycle data for dairy animals
- Mix of small (5-10 animals), medium (15-25 animals) farm sizes

---

## Implementation Plan

### Phase 1: Create Farm Infrastructure

**A. Delete or Reassign Existing Demo Farms**
- Keep Laguna Multi-Species Dairy Cooperative (good example of multi-species)
- Keep Estehanon Farm (complete breeding cycle example)
- Reassign TF-001 through TF-010 to different regions
- Delete duplicates and Troll Farm

**B. Create 51 Demo Farms Across 17 Regions**
Each region gets 3 farms:
- 1 small cattle/goat dairy (5-8 cattle + 3-5 goats)
- 1 medium cattle dairy (15-20 cattle)  
- 1 small carabao/goat farm (4-6 carabao + 4-6 goats)

Regions to populate:
```
NCR, CAR, Region I, Region II, Region III, Region IV-A, 
MIMAROPA, Region V, Region VI, Region VII, Region VIII,
Region IX, Region X, Region XI, Region XII, Region XIII, BARMM
```

GPS coordinates: Use predefined values from `regionalCoordinates.ts` with small random offsets per farm.

---

### Phase 2: Create Animal Records

For each farm, create animals with:
- Proper birth dates (staggered 6-24 months ago)
- Appropriate breeds per species
- Mix of genders (mostly female for dairy, some males)
- Proper life stages and milking stages
- Entry dates and acquisition types (purchased, born, grant)

**Species Distribution Per Region (example):**
| Farm Type | Cattle | Goat | Carabao | 
|-----------|--------|------|---------|
| Small Multi-Species | 6 | 4 | 0 |
| Medium Cattle Dairy | 18 | 0 | 0 |
| Small Carabao/Goat | 0 | 5 | 5 |

---

### Phase 3: Generate Production Records (12 months)

**Date Range:** February 2025 - February 2026

**A. Milking Records**
- 2x daily (AM/PM sessions)
- Realistic production per species:
  - Cattle: 8-14 L/day (with seasonal variation)
  - Goat: 1-3 L/day
  - Carabao: 4-8 L/day
- 60-80% marked as sold with realistic pricing:
  - Cattle milk: ₱35-45/L
  - Goat milk: ₱55-70/L  
  - Carabao milk: ₱50-65/L

**B. Health Records**
- 8-15 health events per farm per year
- Mix of: vaccinations, dewormings, illnesses, treatments
- Include seasonal patterns (more respiratory issues in wet season)

**C. Weight Records**
- Monthly measurements for all animals
- Realistic growth curves by species and life stage

**D. Feeding Records**
- Daily feeding entries
- Feed types: hay, concentrates, napier grass, commercial feed
- Consumption varies by species and life stage

**E. Breeding Events (for dairy females)**
- Heat detection records every 21 days (±3 days)
- AI or natural service records
- Pregnancy confirmations and calvings
- 40-60% conception rate

---

### Phase 4: Animal Exits (Meat Production Simulation)

Create exit records for ~10-15% of animals over the year:
- **Sold for slaughter**: ~60% of exits, with sale prices
- **Died**: ~20% of exits (realistic mortality)
- **Culled**: ~20% of exits (low producers, old age)

Exit prices:
- Cattle: ₱50,000 - ₱120,000 (based on weight)
- Goat: ₱8,000 - ₱25,000
- Carabao: ₱40,000 - ₱100,000

---

### Phase 5: Feed Inventory

For each farm, create feed inventory entries:
- 3-5 feed types per farm
- Quantity levels showing realistic stock management
- Some farms with low stock (for feed security alerts)

---

## Technical Implementation

### Database Inserts Required
1. `farms` table: Insert ~40 new farms (keep some existing)
2. `animals` table: Insert ~500-600 animals total
3. `milking_records` table: ~200,000 records (365 days × 2 sessions × ~275 lactating animals)
4. `health_records` table: ~600 records
5. `weight_records` table: ~6,000 records (monthly × all animals)
6. `feeding_records` table: ~50,000 records
7. `breeding_events` table: ~800 records
8. `heat_records` table: ~1,000 records
9. `feed_inventory` table: ~200 records

### Owner Assignment
All demo farms will be assigned to the existing demo account owner: `c8514ae7-f603-415e-8603-039515f7189e`

### Data Category
All new records will have `data_category = 'demo'` on the farm level.

---

## Expected Dashboard Improvements

After implementation, the Government Dashboard will show:

1. **Regional Map**: Pins across all 17 Philippine regions
2. **Milk Analytics**: 12-month production trends by species
3. **Feed Security**: Some regions showing low stock alerts
4. **Market Prices**: Regional price variations
5. **Breeding Metrics**: Conception rates, heat cycles across regions
6. **Health Analytics**: Regional disease prevalence patterns
7. **Mortality/Sales**: Economic impact of animal exits

---

## Execution Steps

1. Create SQL script for new farms with GPS coordinates
2. Create SQL script for animals with proper relationships
3. Create SQL script for milking records (use date generation)
4. Create SQL script for health records
5. Create SQL script for weight records
6. Create SQL script for feeding records
7. Create SQL script for breeding/heat events
8. Create SQL script for animal exits
9. Create SQL script for feed inventory
10. Validate data appears correctly in dashboard

---

## Risk Mitigation

- Use transactions to ensure atomic inserts
- Generate unique IDs (UUID) programmatically
- Validate foreign key relationships before bulk insert
- Keep existing working demo data (Estehanon, Laguna Co-op) as reference

