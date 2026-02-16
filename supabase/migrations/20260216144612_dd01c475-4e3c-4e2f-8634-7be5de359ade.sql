
-- =============================================
-- COOPERATIVE MODULE: Phase 1 Migration
-- Tables, RLS, Helper Functions, Aggregation RPCs
-- =============================================

-- 1. Add 'cooperative' to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cooperative';

-- 2. Create cooperatives table
CREATE TABLE public.cooperatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region TEXT,
  municipality TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cooperatives ENABLE ROW LEVEL SECURITY;

-- 3. Create cooperative_memberships table
CREATE TABLE public.cooperative_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invitation_status TEXT NOT NULL DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'declined')),
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cooperative_id, farm_id)
);

ALTER TABLE public.cooperative_memberships ENABLE ROW LEVEL SECURITY;

-- 4. SECURITY DEFINER helper: check if user is a cooperative admin
CREATE OR REPLACE FUNCTION public.is_cooperative_admin(_user_id UUID, _cooperative_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cooperatives
    WHERE id = _cooperative_id AND admin_user_id = _user_id
  )
$$;

-- 5. SECURITY DEFINER helper: get cooperative ID for an admin user
CREATE OR REPLACE FUNCTION public.get_user_cooperative_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.cooperatives
  WHERE admin_user_id = _user_id
  LIMIT 1
$$;

-- 6. SECURITY DEFINER helper: get farm IDs for accepted memberships
CREATE OR REPLACE FUNCTION public.get_cooperative_farm_ids(_cooperative_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT farm_id FROM public.cooperative_memberships
  WHERE cooperative_id = _cooperative_id
    AND invitation_status = 'accepted'
$$;

-- 7. RLS Policies for cooperatives
CREATE POLICY "Cooperative admin can view own cooperative"
  ON public.cooperatives FOR SELECT
  USING (admin_user_id = auth.uid());

CREATE POLICY "Cooperative admin can update own cooperative"
  ON public.cooperatives FOR UPDATE
  USING (admin_user_id = auth.uid());

-- Super admin can manage all cooperatives
CREATE POLICY "Super admin full access to cooperatives"
  ON public.cooperatives FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- 8. RLS Policies for cooperative_memberships
CREATE POLICY "Cooperative admin can manage memberships"
  ON public.cooperative_memberships FOR ALL
  USING (public.is_cooperative_admin(auth.uid(), cooperative_id));

-- Farm owners can view their own invitations (by matching email to their auth email)
CREATE POLICY "Farm owners can view own invitations"
  ON public.cooperative_memberships FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Farm owners can update their own invitations (accept/decline)
CREATE POLICY "Farm owners can accept/decline invitations"
  ON public.cooperative_memberships FOR UPDATE
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- 9. Public RPC to validate invitation token (for acceptance page)
CREATE OR REPLACE FUNCTION public.get_cooperative_invitation_public(_token UUID)
RETURNS TABLE (
  cooperative_name TEXT,
  farm_name TEXT,
  invitation_status TEXT,
  token_expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.name AS cooperative_name,
    f.name AS farm_name,
    cm.invitation_status,
    cm.token_expires_at
  FROM public.cooperative_memberships cm
  JOIN public.cooperatives c ON c.id = cm.cooperative_id
  JOIN public.farms f ON f.id = cm.farm_id
  WHERE cm.invitation_token = _token
  LIMIT 1
$$;

-- 10. RPC to accept invitation by token
CREATE OR REPLACE FUNCTION public.accept_cooperative_invitation(_token UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _membership RECORD;
  _user_email TEXT;
BEGIN
  -- Get the current user's email
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  
  IF _user_email IS NULL THEN
    RETURN 'error:not_authenticated';
  END IF;

  -- Find the membership
  SELECT * INTO _membership FROM public.cooperative_memberships
  WHERE invitation_token = _token
  LIMIT 1;

  IF _membership IS NULL THEN
    RETURN 'error:invitation_not_found';
  END IF;

  IF _membership.invitation_status != 'pending' THEN
    RETURN 'error:already_' || _membership.invitation_status;
  END IF;

  IF _membership.token_expires_at < now() THEN
    RETURN 'error:token_expired';
  END IF;

  IF lower(_membership.invited_email) != lower(_user_email) THEN
    RETURN 'error:email_mismatch';
  END IF;

  -- Accept the invitation
  UPDATE public.cooperative_memberships
  SET invitation_status = 'accepted', accepted_at = now()
  WHERE id = _membership.id;

  RETURN 'success';
END;
$$;

-- 11. RPC to decline invitation by token
CREATE OR REPLACE FUNCTION public.decline_cooperative_invitation(_token UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _membership RECORD;
  _user_email TEXT;
BEGIN
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  
  IF _user_email IS NULL THEN
    RETURN 'error:not_authenticated';
  END IF;

  SELECT * INTO _membership FROM public.cooperative_memberships
  WHERE invitation_token = _token
  LIMIT 1;

  IF _membership IS NULL THEN
    RETURN 'error:invitation_not_found';
  END IF;

  IF lower(_membership.invited_email) != lower(_user_email) THEN
    RETURN 'error:email_mismatch';
  END IF;

  UPDATE public.cooperative_memberships
  SET invitation_status = 'declined'
  WHERE id = _membership.id;

  RETURN 'success';
END;
$$;

-- 12. RPC to invite a farm by email (cooperative admin only)
CREATE OR REPLACE FUNCTION public.invite_farm_to_cooperative(
  _cooperative_id UUID,
  _email TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _farm RECORD;
  _existing RECORD;
BEGIN
  -- Verify caller is the cooperative admin
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN 'error:not_authorized';
  END IF;

  -- Find a farm owned by this email
  SELECT f.* INTO _farm
  FROM public.farms f
  JOIN public.profiles p ON p.id = f.owner_id
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = lower(_email)
    AND f.is_deleted = false
  LIMIT 1;

  IF _farm IS NULL THEN
    RETURN 'error:no_farm_found';
  END IF;

  -- Check if already invited
  SELECT * INTO _existing FROM public.cooperative_memberships
  WHERE cooperative_id = _cooperative_id AND farm_id = _farm.id;

  IF _existing IS NOT NULL THEN
    RETURN 'error:already_invited';
  END IF;

  -- Create the membership invitation
  INSERT INTO public.cooperative_memberships (cooperative_id, farm_id, invited_email)
  VALUES (_cooperative_id, _farm.id, _email);

  RETURN 'success';
END;
$$;

-- 13. Aggregation RPC: Member farms list with basic stats
CREATE OR REPLACE FUNCTION public.get_cooperative_member_farms(_cooperative_id UUID)
RETURNS TABLE (
  farm_id UUID,
  farm_name TEXT,
  region TEXT,
  municipality TEXT,
  animal_count BIGINT,
  invitation_status TEXT,
  accepted_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id AS farm_id,
    f.name AS farm_name,
    f.region,
    f.municipality,
    (SELECT COUNT(*) FROM public.animals a WHERE a.farm_id = f.id AND a.is_deleted = false) AS animal_count,
    cm.invitation_status,
    cm.accepted_at
  FROM public.cooperative_memberships cm
  JOIN public.farms f ON f.id = cm.farm_id
  WHERE cm.cooperative_id = _cooperative_id
    AND public.is_cooperative_admin(auth.uid(), _cooperative_id)
  ORDER BY cm.accepted_at DESC NULLS LAST
$$;

-- 14. Aggregation RPC: Herd summary across all member farms
CREATE OR REPLACE FUNCTION public.get_cooperative_herd_summary(_cooperative_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSON;
  _farm_ids UUID[];
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN '{"error":"not_authorized"}'::JSON;
  END IF;

  SELECT ARRAY_AGG(farm_id) INTO _farm_ids
  FROM public.get_cooperative_farm_ids(_cooperative_id);

  IF _farm_ids IS NULL OR array_length(_farm_ids, 1) IS NULL THEN
    RETURN '{"total_animals":0,"breeds":[],"species":[]}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_animals', (SELECT COUNT(*) FROM public.animals WHERE farm_id = ANY(_farm_ids) AND is_deleted = false),
    'by_species', (
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::JSON)
      FROM (
        SELECT livestock_type AS species, COUNT(*) AS count
        FROM public.animals
        WHERE farm_id = ANY(_farm_ids) AND is_deleted = false
        GROUP BY livestock_type
        ORDER BY count DESC
      ) s
    ),
    'by_breed', (
      SELECT COALESCE(json_agg(row_to_json(b)), '[]'::JSON)
      FROM (
        SELECT COALESCE(breed, 'Unknown') AS breed, COUNT(*) AS count
        FROM public.animals
        WHERE farm_id = ANY(_farm_ids) AND is_deleted = false
        GROUP BY breed
        ORDER BY count DESC
        LIMIT 20
      ) b
    ),
    'by_gender', (
      SELECT COALESCE(json_agg(row_to_json(g)), '[]'::JSON)
      FROM (
        SELECT COALESCE(gender, 'Unknown') AS gender, COUNT(*) AS count
        FROM public.animals
        WHERE farm_id = ANY(_farm_ids) AND is_deleted = false
        GROUP BY gender
      ) g
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- 15. Aggregation RPC: Milk production summary
CREATE OR REPLACE FUNCTION public.get_cooperative_milk_production(
  _cooperative_id UUID,
  _days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSON;
  _farm_ids UUID[];
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN '{"error":"not_authorized"}'::JSON;
  END IF;

  SELECT ARRAY_AGG(farm_id) INTO _farm_ids
  FROM public.get_cooperative_farm_ids(_cooperative_id);

  IF _farm_ids IS NULL OR array_length(_farm_ids, 1) IS NULL THEN
    RETURN '{"total_liters":0,"daily":[],"by_farm":[]}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_liters', (
      SELECT COALESCE(SUM(volume_liters), 0)
      FROM public.milking_records mr
      JOIN public.animals a ON a.id = mr.animal_id
      WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
        AND mr.record_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
    ),
    'daily', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::JSON)
      FROM (
        SELECT mr.record_date::DATE AS date, SUM(mr.volume_liters) AS liters
        FROM public.milking_records mr
        JOIN public.animals a ON a.id = mr.animal_id
        WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
          AND mr.record_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
        GROUP BY mr.record_date::DATE
        ORDER BY date
      ) d
    ),
    'by_farm', (
      SELECT COALESCE(json_agg(row_to_json(f)), '[]'::JSON)
      FROM (
        SELECT a.farm_id, fa.name AS farm_name, SUM(mr.volume_liters) AS total_liters
        FROM public.milking_records mr
        JOIN public.animals a ON a.id = mr.animal_id
        JOIN public.farms fa ON fa.id = a.farm_id
        WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
          AND mr.record_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
        GROUP BY a.farm_id, fa.name
        ORDER BY total_liters DESC
      ) f
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- 16. Aggregation RPC: Health overview
CREATE OR REPLACE FUNCTION public.get_cooperative_health_overview(_cooperative_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSON;
  _farm_ids UUID[];
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN '{"error":"not_authorized"}'::JSON;
  END IF;

  SELECT ARRAY_AGG(farm_id) INTO _farm_ids
  FROM public.get_cooperative_farm_ids(_cooperative_id);

  IF _farm_ids IS NULL OR array_length(_farm_ids, 1) IS NULL THEN
    RETURN '{"total_records":0,"recent_issues":[]}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_records_30d', (
      SELECT COUNT(*)
      FROM public.health_records hr
      WHERE hr.farm_id = ANY(_farm_ids)
        AND hr.visit_date >= (CURRENT_DATE - INTERVAL '30 days')
    ),
    'by_diagnosis', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::JSON)
      FROM (
        SELECT COALESCE(hr.diagnosis, 'No Diagnosis') AS diagnosis, COUNT(*) AS count
        FROM public.health_records hr
        WHERE hr.farm_id = ANY(_farm_ids)
          AND hr.visit_date >= (CURRENT_DATE - INTERVAL '90 days')
        GROUP BY hr.diagnosis
        ORDER BY count DESC
        LIMIT 10
      ) d
    ),
    'mortality_30d', (
      SELECT COUNT(*)
      FROM public.animals a
      WHERE a.farm_id = ANY(_farm_ids)
        AND a.exit_reason = 'death'
        AND a.exit_date >= (CURRENT_DATE - INTERVAL '30 days')
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- 17. Aggregation RPC: Financial summary
CREATE OR REPLACE FUNCTION public.get_cooperative_financial_summary(
  _cooperative_id UUID,
  _days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSON;
  _farm_ids UUID[];
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN '{"error":"not_authorized"}'::JSON;
  END IF;

  SELECT ARRAY_AGG(farm_id) INTO _farm_ids
  FROM public.get_cooperative_farm_ids(_cooperative_id);

  IF _farm_ids IS NULL OR array_length(_farm_ids, 1) IS NULL THEN
    RETURN '{"total_revenue":0,"total_expenses":0}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_revenue', (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.farm_revenues
      WHERE farm_id = ANY(_farm_ids) AND (is_deleted IS NULL OR is_deleted = false)
        AND transaction_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
    ),
    'total_expenses', (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.farm_expenses
      WHERE farm_id = ANY(_farm_ids) AND (is_deleted IS NULL OR is_deleted = false)
        AND expense_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
    ),
    'revenue_by_farm', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT fr.farm_id, f.name AS farm_name, SUM(fr.amount) AS total
        FROM public.farm_revenues fr
        JOIN public.farms f ON f.id = fr.farm_id
        WHERE fr.farm_id = ANY(_farm_ids) AND (fr.is_deleted IS NULL OR fr.is_deleted = false)
          AND fr.transaction_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
        GROUP BY fr.farm_id, f.name
        ORDER BY total DESC
      ) r
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- 18. Updated_at trigger for cooperatives
CREATE TRIGGER update_cooperatives_updated_at
  BEFORE UPDATE ON public.cooperatives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
