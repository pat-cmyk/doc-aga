-- Migration: Farm Category Enforcement
--
-- Formalizes that farms.livestock_type is a CATEGORY (ruminant, swine, poultry)
-- while animals.livestock_type remains a SPECIES (cattle, goat, sheep, carabao).
--
-- All existing farms with species-level values are migrated to 'ruminant'
-- since cattle, goat, sheep, and carabao are all ruminants.
--
-- animals.livestock_type is NOT changed — species-specific logic (breeding age,
-- gestation, life stages, feed calculations) all use animals.livestock_type.

BEGIN;

-- 1. Migrate all existing species values → 'ruminant' category
-- This is safe because all current species are ruminants
UPDATE farms SET livestock_type = 'ruminant'
WHERE livestock_type IN ('cattle', 'goat', 'sheep', 'carabao');

-- 2. Replace constraint: only farm CATEGORIES allowed (no species)
ALTER TABLE farms DROP CONSTRAINT IF EXISTS valid_livestock_type;
ALTER TABLE farms ADD CONSTRAINT valid_livestock_type
  CHECK (livestock_type IN ('ruminant', 'swine', 'poultry'));

-- 3. Set default to 'ruminant' for new farms
ALTER TABLE farms ALTER COLUMN livestock_type SET DEFAULT 'ruminant';

-- 4. Recreate create_default_farm with category-only _livestock_type
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

  -- Validate livestock_type is a valid category
  IF _livestock_type NOT IN ('ruminant', 'swine', 'poultry') THEN
    RAISE EXCEPTION 'Invalid livestock type: %. Must be ruminant, swine, or poultry.', _livestock_type;
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

COMMIT;
