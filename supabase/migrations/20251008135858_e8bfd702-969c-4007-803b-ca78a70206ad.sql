-- Fix duplicate key constraint for farm_memberships
-- The unique constraint should only apply to accepted memberships
-- This allows multiple pending invitations with placeholder user_ids

-- Drop the existing unique constraint
ALTER TABLE public.farm_memberships 
DROP CONSTRAINT IF EXISTS farm_memberships_farm_id_user_id_key;

-- Create a partial unique index that only applies to accepted memberships
CREATE UNIQUE INDEX farm_memberships_farm_id_user_id_accepted_key 
ON public.farm_memberships (farm_id, user_id) 
WHERE invitation_status = 'accepted';