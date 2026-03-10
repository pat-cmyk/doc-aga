-- ============================================================================
-- Seed: Golden Sunrise Milk Coop
--
-- Creates a national cooperative for ALL demo farms (data_category = 'demo').
--   • Admin: the user who owns the farm with email estehanon@gmail.com
--   • All demo farms become accepted members
--
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT guards.
-- No impact on farmer-facing UI — cooperative data is only surfaced
-- through the cooperative login (CooperativeAuth) and dashboard.
-- ============================================================================

DO $$
DECLARE
  _admin_user_id UUID;
  _coop_id UUID;
  _farm RECORD;
  _owner_email TEXT;
BEGIN
  -- 1. Find the user ID for estehanon@gmail.com
  SELECT id INTO _admin_user_id
  FROM auth.users
  WHERE lower(email) = lower('estehanon@gmail.com')
  LIMIT 1;

  IF _admin_user_id IS NULL THEN
    RAISE NOTICE 'User estehanon@gmail.com not found — skipping cooperative seed.';
    RETURN;
  END IF;

  -- 2. Ensure the user has the 'cooperative' role in user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_admin_user_id, 'cooperative')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3. Create the cooperative (or find existing by admin)
  SELECT id INTO _coop_id
  FROM public.cooperatives
  WHERE admin_user_id = _admin_user_id
  LIMIT 1;

  IF _coop_id IS NULL THEN
    INSERT INTO public.cooperatives (name, admin_user_id, region, municipality)
    VALUES (
      'Golden Sunrise Milk Coop',
      _admin_user_id,
      'National',         -- national scope
      NULL                -- not municipality-specific
    )
    RETURNING id INTO _coop_id;

    RAISE NOTICE 'Created cooperative "Golden Sunrise Milk Coop" (id=%)', _coop_id;
  ELSE
    -- Update name in case it already exists with a different name
    UPDATE public.cooperatives
    SET name = 'Golden Sunrise Milk Coop',
        region = 'National'
    WHERE id = _coop_id;

    RAISE NOTICE 'Cooperative already exists for this admin (id=%), updated name.', _coop_id;
  END IF;

  -- 4. Add all demo farms as accepted members
  FOR _farm IN
    SELECT f.id AS farm_id, u.email AS owner_email
    FROM public.farms f
    JOIN public.profiles p ON p.id = f.owner_id
    JOIN auth.users u ON u.id = p.id
    WHERE f.data_category = 'demo'
      AND f.is_deleted = false
  LOOP
    _owner_email := COALESCE(_farm.owner_email, 'demo@docaga.app');

    INSERT INTO public.cooperative_memberships (
      cooperative_id,
      farm_id,
      invited_email,
      invitation_status,
      accepted_at
    )
    VALUES (
      _coop_id,
      _farm.farm_id,
      _owner_email,
      'accepted',
      now()
    )
    ON CONFLICT (cooperative_id, farm_id) DO UPDATE
    SET invitation_status = 'accepted',
        accepted_at = COALESCE(cooperative_memberships.accepted_at, now());

    RAISE NOTICE 'Enrolled farm % (owner: %) into cooperative.', _farm.farm_id, _owner_email;
  END LOOP;

  RAISE NOTICE 'Done — Golden Sunrise Milk Coop fully seeded.';
END;
$$;
