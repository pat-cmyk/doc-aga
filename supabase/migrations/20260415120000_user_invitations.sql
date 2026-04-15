-- Admin Dashboard: email-invite flow for global roles (admin, government, merchant, distributor, cooperative)
-- Parallel to farm_memberships (which handles farm-scoped invites).
-- Super admin sends invite → pending row + email → invitee signs up/in → RPC grants role.

-- =========================================================
-- Table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.user_role NOT NULL,
  invitation_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invitation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (invitation_status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_token
  ON public.user_invitations(invitation_token);

CREATE INDEX IF NOT EXISTS idx_user_invitations_email_pending
  ON public.user_invitations(lower(email))
  WHERE invitation_status = 'pending';

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Only super admins can read/write directly; anon accept flow goes through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "super_admin_all_user_invitations" ON public.user_invitations;
CREATE POLICY "super_admin_all_user_invitations"
  ON public.user_invitations
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================
-- Public RPC for accept page (anon-friendly, narrow read)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_invitation_public(_token UUID)
RETURNS TABLE (
  email TEXT,
  role public.user_role,
  invitation_status TEXT,
  token_expires_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email, role, invitation_status, token_expires_at, invited_at
  FROM public.user_invitations
  WHERE invitation_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_invitation_public(UUID) TO anon, authenticated;

-- =========================================================
-- Accept RPC (authenticated caller only)
-- Grants the role from the invitation to the calling user.
-- Idempotent on user_roles (ON CONFLICT DO NOTHING).
-- =========================================================
CREATE OR REPLACE FUNCTION public.accept_user_invitation(_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _uid UUID := auth.uid();
  _user_email TEXT;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = _uid;

  SELECT * INTO _inv
  FROM public.user_invitations
  WHERE invitation_token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF _inv.invitation_status <> 'pending' THEN
    RAISE EXCEPTION 'invitation_%', _inv.invitation_status;
  END IF;

  IF _inv.token_expires_at < now() THEN
    UPDATE public.user_invitations
       SET invitation_status = 'expired'
     WHERE id = _inv.id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;

  -- Require the accepting account's email to match the invite email (case-insensitive).
  IF lower(_user_email) <> lower(_inv.email) THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  -- Grant role (idempotent via UNIQUE(user_id, role)).
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, _inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.user_invitations
     SET invitation_status = 'accepted',
         accepted_at = now(),
         accepted_user_id = _uid
   WHERE id = _inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'role', _inv.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_user_invitation(UUID) TO authenticated;

-- =========================================================
-- Revoke helper (super admin only) — used by admin UI.
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_revoke_user_invitation(_invitation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can revoke invitations';
  END IF;

  UPDATE public.user_invitations
     SET invitation_status = 'revoked'
   WHERE id = _invitation_id
     AND invitation_status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revoke_user_invitation(UUID) TO authenticated;
