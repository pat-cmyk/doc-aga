

# Fill Two Missing Feed Dates (Jan 23 and Jan 30)

## Problem

The feed chart shows two sharp dips to zero caused by missing records on Jan 23 and Jan 30. All other dates are properly normalized.

## Fix

### Jan 23 (Phase 1: 6 animals)
Insert 6 feeding records matching the established per-animal ranges:

| Animal | Ear Tag | Type | kg |
|--------|---------|------|-----|
| Cattle F (A002) | d8a96511 | Bag Corn Silage | 14.5 |
| Cattle F (C0001) | 61eefe8a | Bag Corn Silage | 13.8 |
| Cattle F (C0002) | fdc6fc6c | Bag Corn Silage | 11.2 |
| Bull M (C0010) | ded13129 | Bag Corn Silage | 10.0 |
| Goat F (G001) | 752c6654 | Bag Corn Silage | 2.0 |
| Goat F (G002) | d4a6c57b | Bag Corn Silage | 3.0 |
| **Total** | | | **54.5** |

### Jan 30 (Phase 2: 9 animals, 3 new cattle arrived this date)
Insert 9 feeding records:

| Animal | Ear Tag | Type | kg |
|--------|---------|------|-----|
| Cattle F (A002) | d8a96511 | Bag Corn Silage | 14.2 |
| Cattle F (C0001) | 61eefe8a | Bag Corn Silage | 14.0 |
| Cattle F (C0002) | fdc6fc6c | Bag Corn Silage | 11.5 |
| Bull M (C0010) | ded13129 | Bag Corn Silage | 10.2 |
| Goat F (G001) | 752c6654 | Bag Corn Silage | 2.0 |
| Goat F (G002) | d4a6c57b | Bag Corn Silage | 3.2 |
| New Cattle F (57406456) | | Bag Corn Silage | 13.0 |
| New Cattle F (62757488) | | Bag Corn Silage | 12.0 |
| New Heifer (73077546) | | Bag Corn Silage | 10.0 |
| **Total** | | | **90.1** |

All records use `cost_per_kg_at_time = 6` (PHP), matching existing data.

### Financial Sync
Insert corresponding `farm_expenses` entries for each new feeding record (category = "Feed & Supplements", amount = kg x 6 PHP).

### Verification
- Confirm no gaps remain (every date Jan 14 - Feb 13 has feed records)
- Confirm daily totals stay within expected ranges (54-56 for Phase 1, 87-91 for Phase 2)

## Scope

| Target | Action |
|--------|--------|
| `feeding_records` | Insert 15 new records (6 for Jan 23, 9 for Jan 30) |
| `farm_expenses` | Insert 15 matching expense entries |
| `daily_farm_stats` | Delete cached entries for Jan 23 and Jan 30 |

