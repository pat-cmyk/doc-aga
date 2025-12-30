-- Function to get public invitation details (safe for anonymous access)
CREATE OR REPLACE FUNCTION public.get_farm_invitation_public(p_token uuid)
RETURNS TABLE (
  farm_id uuid,
  farm_name text,
  inviter_name text,
  invited_email text,
  role_in_farm text,
  token_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fm.farm_id,
    f.name::text AS farm_name,
    COALESCE(p.full_name, 'Someone')::text AS inviter_name,
    fm.invited_email::text,
    fm.role_in_farm::text,
    fm.token_expires_at
  FROM farm_memberships fm
  LEFT JOIN farms f ON f.id = fm.farm_id
  LEFT JOIN profiles p ON p.id = fm.invited_by
  WHERE fm.invitation_token = p_token
    AND fm.invitation_status = 'pending'
    AND (fm.token_expires_at IS NULL OR fm.token_expires_at > now());
END;
$$;

-- Function to accept invitation (requires authentication)
CREATE OR REPLACE FUNCTION public.accept_farm_invitation(p_token uuid)
RETURNS TABLE (
  success boolean,
  farm_id uuid,
  farm_name text,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_invite RECORD;
  v_farm_name text;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'not_authenticated';
    RETURN;
  END IF;

  -- Get user email from JWT
  v_user_email := auth.jwt() ->> 'email';

  -- Fetch the invitation
  SELECT fm.*, f.name AS fname
  INTO v_invite
  FROM farm_memberships fm
  LEFT JOIN farms f ON f.id = fm.farm_id
  WHERE fm.invitation_token = p_token;

  -- Check if invitation exists
  IF v_invite IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'invalid_token';
    RETURN;
  END IF;

  -- Check if already accepted
  IF v_invite.invitation_status != 'pending' THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'already_used';
    RETURN;
  END IF;

  -- Check expiration
  IF v_invite.token_expires_at IS NOT NULL AND v_invite.token_expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'expired';
    RETURN;
  END IF;

  -- Check email match (case-insensitive)
  IF v_invite.invited_email IS NOT NULL AND lower(v_invite.invited_email) != lower(v_user_email) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'email_mismatch';
    RETURN;
  END IF;

  -- Accept the invitation
  UPDATE farm_memberships
  SET user_id = v_user_id,
      invitation_status = 'accepted',
      invitation_token = NULL  -- Clear token to prevent reuse
  WHERE invitation_token = p_token;

  v_farm_name := v_invite.fname;

  RETURN QUERY SELECT true, v_invite.farm_id, v_farm_name::text, NULL::text;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_farm_invitation_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_farm_invitation(uuid) TO authenticated;