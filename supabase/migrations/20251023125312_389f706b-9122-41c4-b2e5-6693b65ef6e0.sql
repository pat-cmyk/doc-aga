-- Add livestock_type column to farms table
ALTER TABLE farms 
ADD COLUMN livestock_type text DEFAULT 'cattle';

-- Add check constraint for valid livestock types
ALTER TABLE farms
ADD CONSTRAINT valid_livestock_type 
CHECK (livestock_type IN ('cattle', 'goat', 'sheep', 'carabao'));

-- Update existing farms to have 'cattle' as default
UPDATE farms 
SET livestock_type = 'cattle' 
WHERE livestock_type IS NULL;

-- Make column not null after setting defaults
ALTER TABLE farms 
ALTER COLUMN livestock_type SET NOT NULL;

-- Update create_default_farm RPC function to accept livestock_type
CREATE OR REPLACE FUNCTION public.create_default_farm(
  _name text DEFAULT 'My Farm'::text,
  _region text DEFAULT 'Not specified'::text,
  _role user_role DEFAULT 'farmer_owner'::user_role,
  _livestock_type text DEFAULT 'cattle'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _farm_id uuid;
BEGIN
  -- Ensure user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create farm with livestock type
  INSERT INTO public.farms (name, owner_id, gps_lat, gps_lng, region, livestock_type)
  VALUES (_name, auth.uid(), 0, 0, _region, _livestock_type)
  RETURNING id INTO _farm_id;

  -- Add farm membership with specified role
  INSERT INTO public.farm_memberships (farm_id, user_id, role_in_farm)
  VALUES (_farm_id, auth.uid(), _role)
  ON CONFLICT DO NOTHING;

  RETURN _farm_id;
END;
$function$;