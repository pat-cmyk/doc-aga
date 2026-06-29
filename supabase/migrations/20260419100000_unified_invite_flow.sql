-- Unified Invite Flow: accepted_ip + last_resend_at columns + lookup_invitation + request_invitation_resend
-- Spec: docs/superpowers/specs/2026-04-19-unified-invite-flow-design.md

BEGIN;

-- 1. Audit + rate-limit columns on all three invitation tables
ALTER TABLE public.farm_memberships        ADD COLUMN IF NOT EXISTS accepted_ip inet;
ALTER TABLE public.farm_memberships        ADD COLUMN IF NOT EXISTS last_resend_at timestamptz;
ALTER TABLE public.user_invitations        ADD COLUMN IF NOT EXISTS accepted_ip inet;
ALTER TABLE public.user_invitations        ADD COLUMN IF NOT EXISTS last_resend_at timestamptz;
ALTER TABLE public.cooperative_memberships ADD COLUMN IF NOT EXISTS accepted_ip inet;
ALTER TABLE public.cooperative_memberships ADD COLUMN IF NOT EXISTS last_resend_at timestamptz;

-- 2. lookup_invitation — unified read RPC
CREATE OR REPLACE FUNCTION public.lookup_invitation(p_token uuid)
RETURNS TABLE (
  type text,              -- 'farm' | 'user' | 'coop'
  status text,            -- 'pending' | 'accepted' | 'revoked' | 'expired' | 'declined'
  email text,
  role text,
  role_label text,
  inviter_name text,
  inviter_email text,
  target_name text,
  invited_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Probe user_invitations first (global-role invites — usually the busiest path for admin dashboard)
  RETURN QUERY
  SELECT
    'user'::text AS type,
    CASE
      WHEN ui.invitation_status = 'pending' AND ui.token_expires_at < now() THEN 'expired'
      ELSE ui.invitation_status
    END::text AS status,
    ui.email::text,
    ui.role::text,
    CASE ui.role::text
      WHEN 'admin'        THEN 'System Administrator'
      WHEN 'government'   THEN 'Government Account'
      WHEN 'merchant'     THEN 'Merchant'
      WHEN 'distributor'  THEN 'Distributor'
      WHEN 'cooperative'  THEN 'Cooperative Admin'
      ELSE ui.role::text
    END AS role_label,
    COALESCE(p.full_name, 'A Doc Aga administrator')::text AS inviter_name,
    COALESCE(au.email, '')::text AS inviter_email,
    'Doc Aga'::text AS target_name,
    ui.invited_at,
    ui.token_expires_at
  FROM public.user_invitations ui
  LEFT JOIN public.profiles p ON p.id = ui.invited_by
  LEFT JOIN auth.users au ON au.id = ui.invited_by
  WHERE ui.invitation_token = p_token
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Probe farm_memberships
  RETURN QUERY
  SELECT
    'farm'::text AS type,
    CASE
      WHEN fm.invitation_status = 'pending'
           AND fm.token_expires_at IS NOT NULL
           AND fm.token_expires_at < now() THEN 'expired'
      ELSE fm.invitation_status
    END::text AS status,
    fm.invited_email::text,
    fm.role_in_farm::text,
    CASE fm.role_in_farm::text
      WHEN 'farmer_owner' THEN 'Farm Owner'
      WHEN 'farmhand'     THEN 'Farm Hand'
      WHEN 'vet'          THEN 'Veterinarian'
      ELSE fm.role_in_farm::text
    END AS role_label,
    COALESCE(p.full_name, 'Someone')::text AS inviter_name,
    COALESCE(au.email, '')::text AS inviter_email,
    COALESCE(f.name, 'a farm')::text AS target_name,
    fm.invited_at,
    fm.token_expires_at
  FROM public.farm_memberships fm
  LEFT JOIN public.farms f ON f.id = fm.farm_id
  LEFT JOIN public.profiles p ON p.id = fm.invited_by
  LEFT JOIN auth.users au ON au.id = fm.invited_by
  WHERE fm.invitation_token = p_token
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Probe cooperative_memberships
  RETURN QUERY
  SELECT
    'coop'::text AS type,
    CASE
      WHEN cm.invitation_status = 'pending'
           AND cm.token_expires_at < now() THEN 'expired'
      ELSE cm.invitation_status
    END::text AS status,
    cm.invited_email::text,
    'farmer_owner'::text AS role,
    'Farm Owner (Cooperative Member)'::text AS role_label,
    'Cooperative administrator'::text AS inviter_name,
    ''::text AS inviter_email,
    COALESCE(c.name, 'a cooperative')::text AS target_name,
    cm.invited_at,
    cm.token_expires_at
  FROM public.cooperative_memberships cm
  LEFT JOIN public.cooperatives c ON c.id = cm.cooperative_id
  WHERE cm.invitation_token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_invitation(uuid) TO anon, authenticated;

-- 3. request_invitation_resend — read-then-guard-then-update, ≤1 resend per token per 24h
CREATE OR REPLACE FUNCTION public.request_invitation_resend(p_token uuid)
RETURNS TABLE (sent boolean, reason text, new_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token uuid := gen_random_uuid();
  v_last_at timestamptz;
BEGIN
  -- user_invitations branch
  SELECT COALESCE(last_resend_at, invited_at) INTO v_last_at
    FROM public.user_invitations
   WHERE invitation_token = p_token
     AND invitation_status IN ('pending', 'expired')
     AND accepted_at IS NULL
   FOR UPDATE;

  IF FOUND THEN
    IF v_last_at > now() - interval '24 hours' THEN
      RETURN QUERY SELECT false, 'recent_resend'::text, NULL::uuid;
      RETURN;
    END IF;
    UPDATE public.user_invitations
       SET invitation_token  = v_new_token,
           token_expires_at  = now() + interval '7 days',
           invitation_status = 'pending',
           last_resend_at    = now()
     WHERE invitation_token = p_token;
    RETURN QUERY SELECT true, NULL::text, v_new_token;
    RETURN;
  END IF;

  -- farm_memberships branch
  SELECT COALESCE(last_resend_at, invited_at) INTO v_last_at
    FROM public.farm_memberships
   WHERE invitation_token = p_token
     AND invitation_status = 'pending'
   FOR UPDATE;

  IF FOUND THEN
    IF v_last_at > now() - interval '24 hours' THEN
      RETURN QUERY SELECT false, 'recent_resend'::text, NULL::uuid;
      RETURN;
    END IF;
    UPDATE public.farm_memberships
       SET invitation_token  = v_new_token,
           token_expires_at  = now() + interval '7 days',
           invitation_status = 'pending',
           last_resend_at    = now()
     WHERE invitation_token = p_token;
    RETURN QUERY SELECT true, NULL::text, v_new_token;
    RETURN;
  END IF;

  -- cooperative_memberships branch
  SELECT COALESCE(last_resend_at, invited_at) INTO v_last_at
    FROM public.cooperative_memberships
   WHERE invitation_token = p_token
     AND invitation_status = 'pending'
   FOR UPDATE;

  IF FOUND THEN
    IF v_last_at > now() - interval '24 hours' THEN
      RETURN QUERY SELECT false, 'recent_resend'::text, NULL::uuid;
      RETURN;
    END IF;
    UPDATE public.cooperative_memberships
       SET invitation_token  = v_new_token,
           token_expires_at  = now() + interval '7 days',
           invitation_status = 'pending',
           last_resend_at    = now()
     WHERE invitation_token = p_token;
    RETURN QUERY SELECT true, NULL::text, v_new_token;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 'not_found_or_revoked'::text, NULL::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_invitation_resend(uuid) TO anon, authenticated;

-- 4. Index on cooperative_memberships.invitation_token for the probe
CREATE INDEX IF NOT EXISTS idx_cooperative_memberships_invitation_token
  ON public.cooperative_memberships(invitation_token)
  WHERE invitation_status = 'pending';

COMMIT;
