-- Enable RLS on gov_farm_analytics view
ALTER VIEW public.gov_farm_analytics SET (security_invoker = true);

-- Note: Views don't support RLS policies directly in the same way tables do.
-- The security_invoker = true setting makes the view respect the RLS policies
-- of the underlying tables (farms, animals) which already have government access policies.

-- However, to add an additional layer of protection, we can create a wrapper function
-- that checks government access before returning data.

-- Create a secure function to access gov_farm_analytics
CREATE OR REPLACE FUNCTION public.get_gov_farm_analytics(
  p_region TEXT DEFAULT NULL,
  p_province TEXT DEFAULT NULL,
  p_municipality TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  region TEXT,
  province TEXT,
  municipality TEXT,
  lgu_code TEXT,
  ffedis_id TEXT,
  validation_status TEXT,
  program_group TEXT,
  validated_at TIMESTAMPTZ,
  is_program_participant BOOLEAN,
  gps_lat NUMERIC,
  gps_lng NUMERIC,
  owner_id UUID,
  animal_count BIGINT,
  active_animal_count BIGINT,
  health_events_7d BIGINT,
  health_events_30d BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only government and admin users can access this data
  IF NOT (has_role(auth.uid(), 'government'::user_role) OR has_role(auth.uid(), 'admin'::user_role)) THEN
    RAISE EXCEPTION 'Access denied: Government or Admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    gfa.id,
    gfa.name,
    gfa.region,
    gfa.province,
    gfa.municipality,
    gfa.lgu_code,
    gfa.ffedis_id,
    gfa.validation_status,
    gfa.program_group,
    gfa.validated_at,
    gfa.is_program_participant,
    gfa.gps_lat,
    gfa.gps_lng,
    gfa.owner_id,
    gfa.animal_count,
    gfa.active_animal_count,
    gfa.health_events_7d,
    gfa.health_events_30d
  FROM gov_farm_analytics gfa
  WHERE (p_region IS NULL OR gfa.region = p_region)
    AND (p_province IS NULL OR gfa.province = p_province)
    AND (p_municipality IS NULL OR gfa.municipality = p_municipality);
END;
$$;

-- Grant execute to authenticated users (the function itself checks roles)
GRANT EXECUTE ON FUNCTION public.get_gov_farm_analytics TO authenticated;

-- Revoke direct access to the view from public/anon
REVOKE ALL ON public.gov_farm_analytics FROM anon;
REVOKE ALL ON public.gov_farm_analytics FROM public;