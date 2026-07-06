
-- Re-grant EXECUTE to authenticated for admin/maintenance SECURITY DEFINER
-- functions that are called from the client. The functions internally verify
-- the caller has the required admin/farm role, so restricting the Postgres
-- EXECUTE bit blocks legitimate admin flows without adding security.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND p.proname IN (
        'admin_add_animal','admin_edit_animal','admin_edit_farm','admin_edit_profile',
        'admin_remove_role','admin_assign_role','admin_revoke_user_invitation',
        'get_all_farms_for_integrity_check',
        'fix_animal_weights','fix_missing_milk_revenues','fix_valuation_calculations',
        'calculate_daily_farm_stats'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', r.nspname, r.proname, r.args);
  END LOOP;
END $$;
