-- Add 'ruminant' to farms.livestock_type CHECK constraint
-- This supports the new farm category selector: Ruminant (active), Swine/Poultry (coming soon)
-- Existing farms keep their current species values (cattle, goat, sheep, carabao)
-- New farms will use 'ruminant' as the default category

-- Drop existing constraint and add expanded one
ALTER TABLE farms DROP CONSTRAINT IF EXISTS valid_livestock_type;
ALTER TABLE farms ADD CONSTRAINT valid_livestock_type
  CHECK (livestock_type IN ('cattle', 'goat', 'sheep', 'carabao', 'ruminant'));

-- Update create_default_farm default from 'cattle' to 'ruminant'
CREATE OR REPLACE FUNCTION public.create_default_farm(
  _name text DEFAULT 'My Farm'::text,
  _region text DEFAULT 'Not specified'::text,
  _province text DEFAULT NULL,
  _municipality text DEFAULT NULL,
  _role user_role DEFAULT 'farmer_owner'::user_role,
  _livestock_type text DEFAULT 'ruminant'::text
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

  -- Create farm with separate location fields
  INSERT INTO public.farms (name, owner_id, gps_lat, gps_lng, region, province, municipality, livestock_type)
  VALUES (_name, auth.uid(), 0, 0, _region, _province, _municipality, _livestock_type)
  RETURNING id INTO _farm_id;

  -- Add farm membership with specified role
  INSERT INTO public.farm_memberships (farm_id, user_id, role_in_farm)
  VALUES (_farm_id, auth.uid(), _role)
  ON CONFLICT DO NOTHING;

  RETURN _farm_id;
END;
$function$;
