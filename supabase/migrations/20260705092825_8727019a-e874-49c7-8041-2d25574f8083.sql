
-- 1) Fix can_access_farm and is_farm_member to require accepted invitations
CREATE OR REPLACE FUNCTION public.can_access_farm(fid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR EXISTS(
      SELECT 1
      FROM public.farms f
      LEFT JOIN public.farm_memberships fm
        ON fm.farm_id = f.id
       AND fm.user_id = auth.uid()
       AND fm.invitation_status = 'accepted'
      WHERE f.id = fid AND (f.owner_id = auth.uid() OR fm.user_id IS NOT NULL)
    )
$$;

CREATE OR REPLACE FUNCTION public.is_farm_member(farm_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.farms f
    LEFT JOIN public.farm_memberships fm
      ON fm.farm_id = f.id
     AND fm.user_id = auth.uid()
     AND fm.invitation_status = 'accepted'
    WHERE f.id = farm_id
      AND (f.owner_id = auth.uid() OR fm.user_id IS NOT NULL)
  );
$$;

-- 2) Restrict distributors visibility to authenticated users
DROP POLICY IF EXISTS "Active distributors visible" ON public.distributors;
CREATE POLICY "Active distributors visible to authenticated"
  ON public.distributors
  FOR SELECT
  TO authenticated
  USING (is_active = true OR has_role(auth.uid(), 'admin'::user_role));

-- 3) Column-level protection for invitation_token / accepted_ip
REVOKE SELECT (invitation_token, accepted_ip) ON public.farm_memberships FROM anon, authenticated;
REVOKE SELECT (invitation_token, accepted_ip) ON public.cooperative_memberships FROM anon, authenticated;

-- 4) Fix mutable search_path (correct signatures)
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.leave_cooperative(uuid) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.remove_farm_from_cooperative(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.set_voice_session_attempts_updated_at() SET search_path = public;
ALTER FUNCTION public.sync_milk_inventory_on_update() SET search_path = public;

-- 5) Revoke EXECUTE from anon on all public SECURITY DEFINER functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, PUBLIC;', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role;', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Additionally revoke EXECUTE from authenticated on admin-only / maintenance SECURITY DEFINER functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND (
        p.proname LIKE 'admin\_%' ESCAPE '\'
        OR p.proname LIKE 'fix\_%' ESCAPE '\'
        OR p.proname LIKE 'backfill%'
        OR p.proname LIKE 'correct\_%' ESCAPE '\'
        OR p.proname IN (
          'delete_email','move_to_dlq','read_email_batch',
          'email_queue_dispatch','email_queue_wake','enqueue_email',
          'get_all_farms_for_integrity_check','check_data_consistency',
          'check_stale_sync_items','aggregate_feed_to_daily_stats',
          'ensure_farm_stats','calculate_daily_farm_stats',
          'batch_calculate_ovr_scores','calculate_animal_ovr'
        )
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated;', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 6) Drop broad public SELECT policies on storage.objects (public buckets still work via getPublicUrl)
DROP POLICY IF EXISTS "Farm logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read farm-logos" ON storage.objects;
DROP POLICY IF EXISTS "Merchant logos publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Merchant logos readable" ON storage.objects;
DROP POLICY IF EXISTS "Public read merchant-logos" ON storage.objects;
DROP POLICY IF EXISTS "merchant_logos_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "Product images publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Product images readable" ON storage.objects;
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view product images" ON storage.objects;
DROP POLICY IF EXISTS "product_images_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for app releases" ON storage.objects;
DROP POLICY IF EXISTS "ad_campaign_images_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "animal_photos_select_policy" ON storage.objects;
