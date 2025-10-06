-- Drop old function and create new one with role parameter
DROP FUNCTION IF EXISTS public.create_default_farm(text, text);

CREATE OR REPLACE FUNCTION public.create_default_farm(
  _name text DEFAULT 'My Farm',
  _region text DEFAULT 'Not specified',
  _role user_role DEFAULT 'farmer_owner'::user_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _farm_id uuid;
BEGIN
  -- Ensure user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create farm
  INSERT INTO public.farms (name, owner_id, gps_lat, gps_lng, region)
  VALUES (_name, auth.uid(), 0, 0, _region)
  RETURNING id INTO _farm_id;

  -- Add farm membership with specified role
  INSERT INTO public.farm_memberships (farm_id, user_id, role_in_farm)
  VALUES (_farm_id, auth.uid(), _role)
  ON CONFLICT DO NOTHING;

  RETURN _farm_id;
END;
$$;