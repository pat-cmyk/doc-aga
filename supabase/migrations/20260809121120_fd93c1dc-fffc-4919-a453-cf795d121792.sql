-- 1. Product images: remove ownership-less policies
DROP POLICY IF EXISTS "Users can delete their product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their product images" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update_policy" ON storage.objects;

CREATE POLICY "product_images_delete_policy"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "product_images_update_policy"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- 2. Revoke anon EXECUTE on privileged error-monitoring SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_error_monitoring_summary(boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_error_log_ticket(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_error_log_status(uuid, error_log_status) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_error_report(uuid, text, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_error_monitoring_summary(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_error_log_ticket(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_error_log_status(uuid, error_log_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_error_report(uuid, text, uuid) TO authenticated;

-- 3. Revoke direct EXECUTE on trigger-only SECURITY DEFINER functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'capture_sale_price','handle_barn_assignment_insert','handle_barn_assignment_removal',
        'handle_new_user','log_farm_membership_activity','log_role_change_activity',
        'log_user_role_changes','mark_ovr_cache_stale','notify_farmer_order_update',
        'notify_merchant_new_order','prevent_multirow_farms_delete','prevent_multirow_farms_soft_delete',
        'set_animal_unique_code','set_initial_fertility_status','set_ticket_number',
        'sync_milk_inventory_on_insert','sync_milk_sale_to_revenue','sync_weight_to_animal',
        'update_animal_current_weight','update_milking_stage_on_record','update_product_stock',
        'validate_milking_gender'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.sig);
  END LOOP;
END $$;