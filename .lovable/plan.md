
# Update Past Expected Delivery Dates to Current/Future Dates

## Problem Summary

The "Expected Deliveries Timeline" shows outdated months (Nov 2025 - Jan 2026) because **27 AI records** on older demo farms have past `expected_delivery_date` values:

| Month | Past Records | Farms Affected |
|-------|--------------|----------------|
| Aug-Oct 2025 | 16 | TF-001 through TF-009 |
| Nov 2025 | 6 | TF-004, TF-005, TF-006, TF-007 |
| Dec 2025 | 2 | TF-001, TF-005 |
| Jan 2026 | 5 | TF-001, TF-003, TF-004, TF-005 |

Meanwhile, the **63 new demo farm records** correctly show future dates (Feb - Sep 2026).

---

## Solution: Shift Past Dates Forward

Update all AI records with past expected_delivery_date to realistic future dates:

### Update Strategy

For each AI record with `expected_delivery_date < '2026-02-05'`:
- Shift the date forward by adding a consistent offset to bring it into the future
- Maintain species-appropriate spacing using existing performed_date + gestation period
- Target distribution: Feb 2026 → May 2026

### SQL Update

```sql
UPDATE ai_records ar
SET expected_delivery_date = 
  CASE 
    WHEN a.livestock_type = 'cattle' THEN ar.performed_date + interval '283 days'
    WHEN a.livestock_type = 'goat' THEN ar.performed_date + interval '150 days'
    WHEN a.livestock_type = 'carabao' THEN ar.performed_date + interval '310 days'
    ELSE ar.performed_date + interval '200 days'
  END
FROM animals a
JOIN farms f ON a.farm_id = f.id
WHERE ar.animal_id = a.id
  AND f.data_category = 'demo'
  AND ar.expected_delivery_date IS NOT NULL
  AND ar.expected_delivery_date < '2026-02-05'
  AND ar.performed_date IS NOT NULL;
```

This recalculates expected_delivery_date based on correct gestation periods from the performed_date, which will naturally bring dates into the future if the performed_date is recent.

### Alternative: Direct Date Shift

If performed_dates are also old, use a direct shift:
```sql
UPDATE ai_records ar
SET expected_delivery_date = expected_delivery_date + interval '6 months'
FROM animals a
JOIN farms f ON a.farm_id = f.id
WHERE ar.animal_id = a.id
  AND f.data_category = 'demo'
  AND ar.expected_delivery_date IS NOT NULL
  AND ar.expected_delivery_date < '2026-02-05';
```

---

## Expected Outcomes

### Before
| Timeline Shows | Issue |
|----------------|-------|
| Nov 2025 (6) | ❌ Past |
| Dec 2025 (2) | ❌ Past |
| Jan 2026 (5) | ❌ Past |
| Feb 2026 (3) | ✅ Current |
| Mar 2026 (18) | ✅ Future |

### After
| Timeline Shows | Status |
|----------------|--------|
| Feb 2026 (6) | ✅ Current/Urgent |
| Mar 2026 (22) | ✅ Future |
| Apr 2026 (8) | ✅ Future |
| May-Sep 2026 | ✅ Future |

---

## Technical Details

### Records to Update
- **27 AI records** across 8 older demo farms (TF-001 to TF-009)
- All have `f.data_category = 'demo'`
- No live/production data will be affected

### Data Isolation Guarantee
Filter explicitly by:
- `f.data_category = 'demo'`
- `ar.expected_delivery_date < '2026-02-05'` (only past dates)

---

## Dashboard Impact

After update, the Expected Deliveries Timeline will:
- Show only future months starting from February 2026
- Display the "due in 30 days" badge for Feb 2026 deliveries
- Properly highlight urgent upcoming deliveries
- Remove confusing past-dated entries
