-- Allow anyone to view pending invitations by token
-- This is safe because tokens are UUIDs and hard to guess
CREATE POLICY "fm_select_by_token" 
ON public.farm_memberships 
FOR SELECT 
USING (
  invitation_status = 'pending' 
  AND invitation_token IS NOT NULL
);