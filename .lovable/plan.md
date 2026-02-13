

# Clean Up Duplicate Feeding Records

## Baseline

12 duplicate feeding records exist on two dates for 6 animals each:

| Date | Animal | Duplicate IDs (keep first, delete second) | kg values |
|------|--------|-------------------------------------------|-----------|
| Jan 15 | 61eefe8a (Cattle) | keep `45e275f9`, delete `30355eda` | 13.8, 13.8 |
| Jan 15 | 752c6654 (Goat) | keep `c3dc2be9`, delete `d36852bf` | 2.2, 2.0 |
| Jan 15 | d4a6c57b (Goat) | keep `c5bf215f`, delete `5478fbb1` | 3.0, 2.8 |
| Jan 15 | d8a96511 (Cattle) | keep `7d9bf0d1`, delete `773c0a10` | 14.5, 14.5 |
| Jan 15 | ded13129 (Bull) | keep `5a550e4c`, delete `58b60f20` | 10.2, 10.2 |
| Jan 15 | fdc6fc6c (Cattle) | keep `af44a7a8`, delete `6ca7d2cc` | 11.2, 11.2 |
| Jan 24 | 61eefe8a (Cattle) | keep `0175c50b`, delete `2d3cfbb4` | 13.5, 13.5 |
| Jan 24 | 752c6654 (Goat) | keep `a97d2162`, delete `c1906d10` | 1.8, 1.8 |
| Jan 24 | d4a6c57b (Goat) | keep `b86c8574`, delete `737807d2` | 3.2, 3.0 |
| Jan 24 | d8a96511 (Cattle) | keep `13f15bc3`, delete `18e9b553` | 14.0, 14.0 |
| Jan 24 | ded13129 (Bull) | keep `7d6987f6`, delete `35f41df7` | 10.0, 10.0 |
| Jan 24 | fdc6fc6c (Cattle) | keep `1a37d27a`, delete `a12d44fd` | 11.5, 11.5 |

No duplicate expenses exist for these dates, so no financial cleanup is needed.

## Execution

Single DELETE statement removing the 12 duplicate feeding record IDs (keeping the first of each pair).

## Verification

Re-run the duplicate check query to confirm 0 duplicates remain across all tables.

## Scope

| Target | Action |
|--------|--------|
| `feeding_records` | Delete 12 duplicate rows |
| `farm_expenses` | No changes needed (no duplicates) |
| `milking_records` | No changes needed (no duplicates) |
| `farm_revenues` | No changes needed (no duplicates) |

