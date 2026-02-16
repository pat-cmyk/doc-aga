

# Fix Animal Avatar Upload Error (22P02)

## Root Cause

The storage bucket `animal-photos` has an RLS insert policy that expects the **first folder** in the file path to be a **farm UUID**:

```sql
(storage.foldername(name))[1]::uuid IN (
  SELECT id FROM farms WHERE owner_id = auth.uid()
)
```

But the upload code in `AnimalProfile.tsx` uses `avatars/${fileName}` as the path. When the policy tries to cast `"avatars"` to UUID, it fails with error `22P02: invalid input syntax for type uuid`.

## Fix

Two small changes:

### 1. `src/components/animal-details/hooks/useAnimalDetails.ts`
- Add `farm_id: string;` to the `Animal` interface (the data is already fetched via `select("*")`, just not typed)

### 2. `src/components/animal-details/AnimalProfile.tsx`
- Change the upload path from `avatars/${fileName}` to `${animal.farm_id}/avatars/${fileName}`
- This satisfies the RLS policy by putting the farm UUID as the first folder segment

## Data Flow Impact

None -- this is a path string fix only. No database, RPC, or trigger changes needed.

