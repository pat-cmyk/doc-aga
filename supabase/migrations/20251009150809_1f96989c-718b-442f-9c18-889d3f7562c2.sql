-- Update RLS policies for farmhands to create records

-- Function to check if user is a farmhand on a farm
CREATE OR REPLACE FUNCTION public.is_farmhand(_user_id uuid, _farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farm_memberships fm
    WHERE fm.farm_id = _farm_id 
      AND fm.user_id = _user_id 
      AND fm.role_in_farm = 'farmhand'
      AND fm.invitation_status = 'accepted'
  )
$$;

-- Update milking_records INSERT policy
DROP POLICY IF EXISTS "farmhand_milking_insert" ON public.milking_records;
CREATE POLICY "farmhand_milking_insert" ON public.milking_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = milking_records.animal_id
    AND (
      is_farm_owner(auth.uid(), a.farm_id) 
      OR is_farm_manager(auth.uid(), a.farm_id)
      OR is_farmhand(auth.uid(), a.farm_id)
    )
  )
);

-- Update feeding_records INSERT policy
DROP POLICY IF EXISTS "feeding_insert" ON public.feeding_records;
CREATE POLICY "feeding_insert" ON public.feeding_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = feeding_records.animal_id
    AND (
      is_farm_owner(auth.uid(), a.farm_id) 
      OR is_farm_manager(auth.uid(), a.farm_id)
      OR is_farmhand(auth.uid(), a.farm_id)
    )
  )
);

-- Update health_records INSERT policy
DROP POLICY IF EXISTS "health_insert" ON public.health_records;
CREATE POLICY "health_insert" ON public.health_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = health_records.animal_id
    AND (
      is_farm_owner(auth.uid(), a.farm_id) 
      OR is_farm_manager(auth.uid(), a.farm_id)
      OR is_farmhand(auth.uid(), a.farm_id)
    )
  )
);

-- Update weight_records INSERT policy
DROP POLICY IF EXISTS "weight_records_insert" ON public.weight_records;
CREATE POLICY "weight_records_insert" ON public.weight_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = weight_records.animal_id
    AND (
      is_farm_owner(auth.uid(), a.farm_id) 
      OR is_farm_manager(auth.uid(), a.farm_id)
      OR is_farmhand(auth.uid(), a.farm_id)
    )
  )
);

-- Update injection_records INSERT policy
DROP POLICY IF EXISTS "injection_insert" ON public.injection_records;
CREATE POLICY "injection_insert" ON public.injection_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM animals a
    WHERE a.id = injection_records.animal_id
    AND (
      is_farm_owner(auth.uid(), a.farm_id) 
      OR is_farm_manager(auth.uid(), a.farm_id)
      OR is_farmhand(auth.uid(), a.farm_id)
    )
  )
);