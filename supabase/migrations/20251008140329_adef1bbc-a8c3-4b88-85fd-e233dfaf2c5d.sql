-- Allow null user_id for pending invitations
-- Update the farm_memberships table to make user_id nullable for pending invites

ALTER TABLE public.farm_memberships 
ALTER COLUMN user_id DROP NOT NULL;

-- Update the unique constraint to allow null user_ids
DROP INDEX IF EXISTS farm_memberships_farm_id_user_id_accepted_key;

-- Create a partial unique index that handles nulls properly
CREATE UNIQUE INDEX farm_memberships_farm_id_user_id_accepted_key 
ON public.farm_memberships (farm_id, user_id) 
WHERE invitation_status = 'accepted' AND user_id IS NOT NULL;

-- Create another unique constraint for pending invitations by email
CREATE UNIQUE INDEX farm_memberships_farm_id_email_pending_key 
ON public.farm_memberships (farm_id, invited_email) 
WHERE invitation_status = 'pending';