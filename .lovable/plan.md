

# Normalize Estehanon Farm Dataset: Milk, Feed, and Financial Integrity

## Assessment Summary

### Farm Profile
- **Farm ID:** `0ffc89c8-152d-42a3-a0f5-67cf772860cc`
- **Type:** Mixed (cattle + goat), demo farm
- **Animals:** 9 total (6 arrived Oct 15, 3 arrived Jan 30)

| Animal | Species | Lactating | Weight | Entry Date |
|--------|---------|-----------|--------|------------|
| RUM-2512-17197653 | Cattle F | Yes | 420 kg | Oct 15 |
| RUM-2512-54384963 | Goat F (Doeling) | Yes | 22 kg | Oct 15 |
| RUM-2601-01946214 | Cattle F | Yes | 450 kg | Oct 15 |
| RUM-2601-10234508 | Goat F | Yes | 41 kg | Oct 15 |
| RUM-2601-49471028 | Cattle F (Yearling) | No | 420 kg | Oct 15 |
| RUM-2601-67761709 | Cattle M (Young Bull) | No | -- | Oct 15 |
| RUM-2601-57406456 | Cattle F | Yes | -- | Jan 30 |
| RUM-2601-62757488 | Cattle F | No | -- | Jan 30 |
| RUM-2601-73077546 | Cattle F (Heifer) | No | -- | Jan 30 |

### Phase 1: Before Jan 30 (6 animals, 4 lactating)
- Expected daily milk: ~28-35L (2 cattle x 12-16L + 2 goats x 1.5-2.5L)
- Expected daily feed: ~50-60kg (3 cattle x 12kg + 1 bull x 10kg + 2 goats x 3kg)

### Phase 2: From Jan 30 onward (9 animals, 5 lactating)
- Expected daily milk: ~40-50L (3 cattle x 12-16L + 2 goats x 1.5-2.5L)
- Expected daily feed: ~80-90kg (5 cattle x 12kg + 1 bull x 10kg + 1 heifer x 10kg + 2 goats x 3kg)

---

## Data Problems Found

### Problem 1: Jan 30 Milk Spike (180L -- IMPOSSIBLE)
The records show physically impossible volumes:
- RUM-2512-17197653 (cattle): 53.1L in one day (max realistic: ~20L)
- RUM-2512-54384963 (goat, 22kg doeling): **17.46L** (max realistic: ~2L)
- RUM-2601-01946214 (cattle): 56.9L in one day
- RUM-2601-10234508 (goat): **32.54L** (max realistic: ~3L)

**Action:** Delete these 8 records and replace with realistic values. Delete corresponding `farm_revenues` entries, then re-insert correct ones.

### Problem 2: Massive Gaps in Milk Data
Zero milk records on these dates:
- Jan 14, 16, 18, 19, 20, 21, 22, 23, 24, 28, 31
- Feb 1, 2, 3, 4, 5, 6

**Action:** Insert "Full Day" milking records for all lactating animals on each missing date.

### Problem 3: Massive Gaps in Feed Data
Zero feed records on these dates:
- Jan 14, 15, 16, 24, 25, 29, 31
- Feb 1, 2, 3, 4, 5

**Action:** Insert daily feeding records for ALL animals on each missing date.

### Problem 4: Feed Volume Inconsistency
- Jan 17: 150kg for 5 animals (30kg/animal -- too high, includes duplicates)
- Feb 6-11: 30-36kg for 9 animals (3-4kg/animal -- too low, should be ~10kg for cattle)
- Feb 12: 180kg spike (anomalous)

**Action:** Update existing records with incorrect volumes to realistic per-animal rates.

### Problem 5: Missing Financial Records
- Milk sold on Jan 15, 17, 25, 26, 27, 29, 30 has `farm_revenues` entries
- Seeder-generated milk (Feb 7-13) is all `is_sold = false` -- no revenue impact yet
- Feed expenses exist for some days but not all
- Missing dates need feed expense records

**Action:** After fixing milk records, ensure all sold milk has corresponding `farm_revenues`. After fixing feed records, ensure all feed with `cost_per_kg_at_time` has corresponding `farm_expenses`.

---

## Implementation Plan

### Step 1: Fix the Jan 30 Milk Spike
1. Delete the 8 bad milking records for Jan 30
2. Delete corresponding `farm_revenues` entries linked to those records
3. Insert realistic replacement records:
   - 2 cattle at ~14-16L each (Full Day)
   - 2 goats at ~1.5-2.5L each (Full Day)
   - New cattle (RUM-2601-57406456) at ~12L (Full Day)
4. Mark new records as `is_sold = true` with correct `sale_amount` (at ~40 PHP/L)
5. Insert new `farm_revenues` entries for each sold record

### Step 2: Fill Milk Gaps (17 missing dates)
For each missing date, insert one "Full Day" record per lactating animal:
- Before Jan 30: 4 animals (2 cattle + 2 goats)
- From Jan 30: 5 animals (3 cattle + 2 goats)

Per-animal daily volumes (with small daily variation using seeded randomness):
- Cattle: 12-18L (avg ~15L)
- Goat (doeling 22kg): 1.0-2.0L (avg ~1.5L)
- Goat (41kg): 1.5-3.0L (avg ~2.0L)

### Step 3: Fill Feed Gaps (12 missing dates)
For each missing date, insert one feed record per animal:
- Before Jan 30: 6 animals
- From Jan 30: 9 animals

Per-animal daily feed:
- Cattle (lactating): 12-15kg
- Cattle (non-lactating): 10-12kg
- Young Bull: 8-12kg
- Goat (doeling 22kg): 1.5-2.5kg
- Goat (41kg): 2.5-4.0kg

Feed type: "Bag Corn Silage" (consistent with existing records), cost_per_kg_at_time = 6 PHP/kg

### Step 4: Normalize Existing Feed Volumes
- Feb 6-11 records: Update cattle feed from ~3-4kg to ~12-15kg each
- Feb 12 spike: Reduce any outlier records to realistic ranges
- Jan 17 duplicates: Remove duplicate "Fresh Cut and Carry" entries if they double-count

### Step 5: Financial Reconciliation
1. For all newly inserted milk records marked `is_sold = true`, create `farm_revenues` entries (source = "Milk Sales", linked_milk_log_id)
2. For all newly inserted feed records with `cost_per_kg_at_time`, create `farm_expenses` entries (category = "Feed and Supplements")
3. Verify no duplicate revenue/expense entries

### Step 6: Verification
Run summary queries to confirm:
- Daily milk totals are 28-50L (smooth curve, no spikes)
- Daily feed totals are 50-90kg (proportional to animal count)
- Feed-to-milk ratio is ~2.5:1 to 3:1 (industry standard)
- Every sold milk record has a matching `farm_revenues` entry
- Every feed record with cost has a matching `farm_expenses` entry

---

## Technical Details

All data changes will be executed via SQL INSERT/UPDATE/DELETE statements using the data tools (not migrations). The approach:

1. Use deterministic values (not random) based on animal ID + date hash for reproducibility
2. Process in batches of ~50 records per SQL statement
3. Run verification queries after each step before proceeding
4. Update `daily_farm_stats` cache entries for affected dates (or invalidate them)

### Expected Final Chart Shape
The normalized chart should show:
- **Milk (blue area):** Smooth curve, 28-35L/day (Jan 14-29), stepping up to 40-50L/day (Jan 30+)
- **Feed (orange line):** Parallel curve, 50-60kg/day (Jan 14-29), stepping up to 80-90kg/day (Jan 30+)
- **Ratio:** Feed line roughly 2-3x the milk line -- visually demonstrating the feed-milk correlation

### Files Modified
| Target | Change |
|--------|--------|
| Database: `milking_records` | Delete bad Jan 30 records, insert ~85 new records |
| Database: `feeding_records` | Insert ~108 new records, update ~54 existing |
| Database: `farm_revenues` | Delete bad Jan 30 entries, insert ~85 new milk sale entries |
| Database: `farm_expenses` | Insert ~108 new feed expense entries |
| Database: `daily_farm_stats` | Invalidate/delete stale cached entries for affected dates |
| `docs/data-relationships-map.md` | Entry 10: Estehanon normalization changelog |

