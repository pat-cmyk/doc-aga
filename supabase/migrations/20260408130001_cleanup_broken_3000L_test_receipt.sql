-- ============================================================================
-- Cleanup: Fix the 3000L test receipt that created 203 individual revenue
-- entries via the sync_milk_sale_to_revenue trigger instead of one consolidated.
--
-- Receipt ID: b695d396-c921-45f4-b07a-152ea58d1449
-- Farm ID: d8f28aae-0e99-4594-8787-66d55e9c9f1e
-- Volume: 3000L, Price: ₱40/L, Date: 2026-04-08
--
-- Also clean up the earlier broken 200L test receipt (reversed but left
-- trigger-created revenues behind).
-- ============================================================================

-- Step 1: Soft-delete all "Auto-synced from milk sale" revenues that were
-- created by the trigger firing during coop milk receipts.
-- These have milking_record_ids that match the FIFO deductions from the
-- 3000L receipt (created_at = 2026-04-07T23:13:30 which is when the receipt ran).
UPDATE public.farm_revenues
SET is_deleted = true, updated_at = now()
WHERE farm_id = 'd8f28aae-0e99-4594-8787-66d55e9c9f1e'
  AND notes = 'Auto-synced from milk sale'
  AND created_at >= '2026-04-07T22:00:00+00:00'
  AND is_deleted = false;

-- Step 2: Create the ONE correct consolidated revenue entry
INSERT INTO public.farm_revenues (
  farm_id, user_id, amount, source, transaction_date, notes, is_deleted
)
SELECT
  'd8f28aae-0e99-4594-8787-66d55e9c9f1e',
  f.owner_id,
  120000,  -- 3000L × ₱40/L
  'Milk Sale',
  '2026-04-08',
  'Cooperative Hub delivery: 3000L @ ₱40/L',
  false
FROM public.farms f
WHERE f.id = 'd8f28aae-0e99-4594-8787-66d55e9c9f1e';
