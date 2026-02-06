-- Drop the vulnerable public policy that exposes invitation tokens
-- The frontend already uses the secure RPC 'get_farm_invitation_public' for token lookups
-- which is SECURITY DEFINER and only returns non-sensitive data
DROP POLICY IF EXISTS "fm_select_by_token" ON public.farm_memberships;