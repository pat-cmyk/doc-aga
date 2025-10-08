-- Update farm_memberships table to support invitations
ALTER TABLE public.farm_memberships 
ADD COLUMN IF NOT EXISTS invited_email text,
ADD COLUMN IF NOT EXISTS invitation_status text DEFAULT 'accepted' CHECK (invitation_status IN ('pending', 'accepted', 'declined')),
ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invited_at timestamp with time zone DEFAULT now();

-- Create index on invited_email
CREATE INDEX IF NOT EXISTS idx_farm_memberships_invited_email ON public.farm_memberships(invited_email);

-- Create security definer function to check if user is farm owner
CREATE OR REPLACE FUNCTION public.is_farm_owner(_user_id uuid, _farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farms
    WHERE id = _farm_id AND owner_id = _user_id
  )
$$;

-- Create security definer function to check if user is farm manager  
-- Using 'farmer_owner' as the manager role for now
CREATE OR REPLACE FUNCTION public.is_farm_manager(_user_id uuid, _farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farm_memberships fm
    JOIN public.user_roles ur ON ur.user_id = fm.user_id
    WHERE fm.farm_id = _farm_id 
      AND fm.user_id = _user_id 
      AND ur.role = 'farmer_owner'
      AND fm.invitation_status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM public.farms f WHERE f.id = _farm_id AND f.owner_id = _user_id
      )
  )
$$;

-- Create security definer function to check if user is farm owner or manager
CREATE OR REPLACE FUNCTION public.is_farm_owner_or_manager(_user_id uuid, _farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_farm_owner(_user_id, _farm_id) OR is_farm_manager(_user_id, _farm_id)
$$;

-- Update RLS policy for farm_memberships to allow farm managers to view
DROP POLICY IF EXISTS "fm_select" ON public.farm_memberships;
CREATE POLICY "fm_select" ON public.farm_memberships
FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_farm_owner(auth.uid(), farm_id)
  OR is_farm_manager(auth.uid(), farm_id)
);

-- Update animals policies to allow farm managers
DROP POLICY IF EXISTS "animals_insert" ON public.animals;
CREATE POLICY "animals_insert" ON public.animals
FOR INSERT
WITH CHECK (
  is_farm_owner(auth.uid(), farm_id) 
  OR is_farm_manager(auth.uid(), farm_id)
);

DROP POLICY IF EXISTS "animals_update" ON public.animals;
CREATE POLICY "animals_update" ON public.animals
FOR UPDATE
USING (
  is_farm_owner(auth.uid(), farm_id) 
  OR is_farm_manager(auth.uid(), farm_id)
);

DROP POLICY IF EXISTS "animals_delete" ON public.animals;
CREATE POLICY "animals_delete" ON public.animals
FOR DELETE
USING (is_farm_owner(auth.uid(), farm_id));

-- Update record policies to allow farm managers
DROP POLICY IF EXISTS "ai_insert" ON public.ai_records;
CREATE POLICY "ai_insert" ON public.ai_records
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = ai_records.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "ai_update" ON public.ai_records;
CREATE POLICY "ai_update" ON public.ai_records
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = ai_records.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "weight_records_insert" ON public.weight_records;
CREATE POLICY "weight_records_insert" ON public.weight_records
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = weight_records.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "weight_records_update" ON public.weight_records;
CREATE POLICY "weight_records_update" ON public.weight_records
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = weight_records.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "milking_insert" ON public.milking_records;
CREATE POLICY "milking_insert" ON public.milking_records
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = milking_records.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "milking_update" ON public.milking_records;
CREATE POLICY "milking_update" ON public.milking_records
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = milking_records.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "health_insert" ON public.health_records;
CREATE POLICY "health_insert" ON public.health_records
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = health_records.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "feeding_insert" ON public.feeding_records;
CREATE POLICY "feeding_insert" ON public.feeding_records
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = feeding_records.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "injection_insert" ON public.injection_records;
CREATE POLICY "injection_insert" ON public.injection_records
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = injection_records.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "photos_insert" ON public.animal_photos;
CREATE POLICY "photos_insert" ON public.animal_photos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = animal_photos.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);

DROP POLICY IF EXISTS "events_insert" ON public.animal_events;
CREATE POLICY "events_insert" ON public.animal_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a 
    WHERE a.id = animal_events.animal_id 
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id))
  )
);