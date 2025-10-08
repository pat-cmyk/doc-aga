-- Add invitation token columns to farm_memberships
ALTER TABLE public.farm_memberships
ADD COLUMN IF NOT EXISTS invitation_token UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days');

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_farm_memberships_invitation_token 
ON public.farm_memberships(invitation_token) 
WHERE invitation_status = 'pending';