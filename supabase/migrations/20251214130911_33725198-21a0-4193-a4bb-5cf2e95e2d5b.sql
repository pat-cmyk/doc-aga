-- Fix: Restrict invitation token visibility to only the inviting user
-- Pending invitations with tokens should NOT be visible to other farm owners/managers

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "fm_select" ON farm_memberships;

-- Policy 1: Users can see their own membership record
CREATE POLICY "fm_self_select"
ON farm_memberships FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Farm owners/managers can see ACCEPTED memberships of their farm
-- (No token exposure since accepted memberships don't use tokens)
CREATE POLICY "fm_accepted_members_select"
ON farm_memberships FOR SELECT
USING (
  invitation_status = 'accepted'
  AND (
    is_farm_owner(auth.uid(), farm_id)
    OR is_farm_manager(auth.uid(), farm_id)
  )
);

-- Policy 3: Only the inviting user can see pending invitations they created
-- (This includes the invitation_token for resending/managing)
CREATE POLICY "fm_inviter_select"
ON farm_memberships FOR SELECT
USING (invited_by = auth.uid());

-- Policy 4: Admins can view all memberships for support
CREATE POLICY "fm_admin_select"
ON farm_memberships FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));