

# Resolve All 7 DRM Open Questions

## Summary of Resolutions

| # | Question | Resolution | Action |
|---|----------|-----------|--------|
| 1 | Vet Role RLS Gap | Create `is_vet()` function + add vet INSERT policies on health_records, injection_records, preventive_health_schedules | **DB Migration** |
| 2 | Duplicate RLS Policies | Drop all duplicates across distributors, doc_aga_faqs, invoices, orders, products, messages | **DB Migration** |
| 3 | farm_expenses DELETE | Add DELETE policy for farm owners | **DB Migration** |
| 4 | Animals missing CASCADE | DRM was wrong -- cascades ARE in place. Update DRM only | **DRM Update** |
| 5 | gov_farm_analytics | Already resolved (VIEW, not table) | **No action** |
| 6 | Offline queue farm_id | By design -- client-side queue is local, server-side sync_queue enforces farm_id NOT NULL | **DRM Update** |
| 7 | milking_records duplicate INSERT | Drop `milking_insert` (superseded by `farmhand_milking_insert`) | **DB Migration** |

---

## DB Migration (Single Migration)

### Step 1: Create `is_vet()` function

```sql
CREATE OR REPLACE FUNCTION public.is_vet(_user_id uuid, _farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farm_memberships
    WHERE user_id = _user_id
      AND farm_id = _farm_id
      AND role_in_farm = 'vet'
      AND invitation_status = 'accepted'
  )
$$;
```

### Step 2: Add vet INSERT policies (health_records, injection_records, preventive_health_schedules)

For `health_records` -- update existing `health_insert` policy to include vet:
```sql
DROP POLICY IF EXISTS "health_insert" ON health_records;
CREATE POLICY "health_insert" ON health_records FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = health_records.animal_id
      AND (is_farm_owner(auth.uid(), a.farm_id)
        OR is_farm_manager(auth.uid(), a.farm_id)
        OR is_farmhand(auth.uid(), a.farm_id)
        OR is_vet(auth.uid(), a.farm_id))
  ));
```

Same pattern for `injection_records` and `preventive_health_schedules`.

### Step 3: Drop duplicate RLS policies

Tables affected: `distributors`, `doc_aga_faqs`, `invoices`, `orders`, `products`, `milking_records`

For each, drop the redundant policy name (keeping the cleanest-named version).

### Step 4: Add farm_expenses DELETE policy

```sql
CREATE POLICY "Farm owners can delete expenses"
  ON farm_expenses FOR DELETE
  USING (is_farm_owner(auth.uid(), farm_id));
```

### Step 5: Drop milking_records superseded INSERT policy

```sql
DROP POLICY IF EXISTS "milking_insert" ON milking_records;
```

---

## DRM File Update

Update `/docs/data-relationships-map.md` Section 9 to mark all 7 questions as resolved with documented rationale, and correct the CASCADE information in Section 2/3.

---

## Technical Details

### Tables with RLS Changes

| Table | Change |
|-------|--------|
| health_records | Recreate INSERT policy with vet role |
| injection_records | Add/update INSERT policy with vet role |
| preventive_health_schedules | Add/update INSERT policy with vet role |
| farm_expenses | Add DELETE policy for owners |
| milking_records | Drop redundant `milking_insert` |
| distributors | Drop 4 duplicate policies |
| doc_aga_faqs | Drop ~4 duplicate policies |
| invoices | Drop 1 duplicate SELECT + 1 duplicate INSERT |
| orders | Drop duplicates (to be identified) |
| products | Drop duplicates (to be identified) |

### Files Modified

| File | Change |
|------|--------|
| `docs/data-relationships-map.md` | Update Sections 2, 3, 4, and 9 with resolved questions + corrected CASCADE info |
| New migration SQL | Single migration with all RLS fixes |

### Testing Points

1. Log in as a vet user -- verify you can add health records, injections, and preventive schedules
2. Log in as a farm owner -- verify you can delete expenses
3. Verify no regression on existing farm owner/manager/farmhand operations
4. Check admin dashboard loads without RLS errors

