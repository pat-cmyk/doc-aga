-- Drop the automatic farm membership trigger to prevent duplicate entries
-- We'll handle role assignment manually in the application code
DROP TRIGGER IF EXISTS trigger_add_farm_owner_membership ON public.farms;
DROP FUNCTION IF EXISTS public.add_farm_owner_membership();