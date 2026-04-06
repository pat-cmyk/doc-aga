-- Migration: Add cooperative membership removal/withdrawal support
-- Adds 'withdrawn' status to cooperative_memberships and RPCs for admin removal + farmer withdrawal

-- 1. Expand invitation_status to include 'withdrawn' and 'removed'
ALTER TABLE public.cooperative_memberships
  DROP CONSTRAINT IF EXISTS cooperative_memberships_invitation_status_check;

ALTER TABLE public.cooperative_memberships
  ADD CONSTRAINT cooperative_memberships_invitation_status_check
  CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'withdrawn', 'removed'));

-- 2. Update get_cooperative_member_farms to include membership_id
CREATE OR REPLACE FUNCTION public.get_cooperative_member_farms(_cooperative_id UUID)
RETURNS TABLE (
  membership_id UUID,
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
    cm.id AS membership_id,
    f.id AS farm_id,
    f.name::TEXT AS farm_name,
    f.region::TEXT,
    f.municipality::TEXT,
    (SELECT count(*) FROM animals a WHERE a.farm_id = f.id AND a.is_deleted = false)::BIGINT AS animal_count,
    cm.invitation_status::TEXT,
    cm.accepted_at
  FROM cooperative_memberships cm
  JOIN farms f ON f.id = cm.farm_id
  WHERE cm.cooperative_id = _cooperative_id
    AND cm.invitation_status IN ('pending', 'accepted')
  ORDER BY cm.accepted_at DESC NULLS LAST;
$$;

-- 3. RPC: Cooperative admin removes a farm from the cooperative
CREATE OR REPLACE FUNCTION public.remove_farm_from_cooperative(
  _cooperative_id UUID,
  _membership_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _membership RECORD;
BEGIN
  -- Verify caller is cooperative admin
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN 'error:not_authorized';
  END IF;

  -- Find the membership
  SELECT * INTO _membership
  FROM public.cooperative_memberships
  WHERE id = _membership_id
    AND cooperative_id = _cooperative_id
    AND invitation_status = 'accepted';

  IF _membership IS NULL THEN
    RETURN 'error:membership_not_found';
  END IF;

  -- Mark as removed
  UPDATE public.cooperative_memberships
  SET invitation_status = 'removed'
  WHERE id = _membership_id;

  RETURN 'success';
END;
$$;

-- 3. RPC: Farm owner voluntarily leaves the cooperative
CREATE OR REPLACE FUNCTION public.leave_cooperative(
  _membership_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _membership RECORD;
  _user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();

  -- Find the membership matching user's email
  SELECT * INTO _membership
  FROM public.cooperative_memberships
  WHERE id = _membership_id
    AND invitation_status = 'accepted'
    AND lower(invited_email) = lower(_user_email);

  IF _membership IS NULL THEN
    RETURN 'error:membership_not_found';
  END IF;

  -- Mark as withdrawn
  UPDATE public.cooperative_memberships
  SET invitation_status = 'withdrawn'
  WHERE id = _membership_id;

  RETURN 'success';
END;
$$;
