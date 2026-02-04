-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS public.get_gov_farm_analytics_with_audit(text, jsonb);

-- Recreate with fixed implementation: no profiles.role dependency, explicit casting
CREATE OR REPLACE FUNCTION public.get_gov_farm_analytics_with_audit(
  _access_type text DEFAULT 'view',
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  name text,
  region text,
  province text,
  municipality text,
  gps_lat double precision,
  gps_lng double precision,
  livestock_type text,
  created_at timestamptz,
  is_deleted boolean,
  is_program_participant boolean,
  program_group text,
  data_category text,
  active_animal_count bigint,
  cattle_count bigint,
  goat_count bigint,
  carabao_count bigint,
  sheep_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _user_role_text text;
  _is_admin boolean;
  _is_government boolean;
  _record_count int;
  _regions text[];
BEGIN
  -- Get current user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check roles using the established has_role pattern (avoids profiles.role issue)
  _is_admin := public.has_role(_user_id, 'admin'::user_role);
  _is_government := public.has_role(_user_id, 'government'::user_role);
  
  -- Must be admin or government to access
  IF NOT (_is_admin OR _is_government) THEN
    RAISE EXCEPTION 'Unauthorized: requires admin or government role';
  END IF;
  
  -- Determine role text for audit log
  IF _is_admin THEN
    _user_role_text := 'admin';
  ELSE
    _user_role_text := 'government';
  END IF;
  
  -- Get record count and regions for audit
  SELECT 
    COUNT(*)::int,
    ARRAY_AGG(DISTINCT g.region) FILTER (WHERE g.region IS NOT NULL)
  INTO _record_count, _regions
  FROM gov_farm_analytics g
  WHERE g.is_deleted = false;
  
  -- Log the access
  INSERT INTO gov_analytics_access_audit_log (
    user_id,
    access_type,
    records_accessed,
    regions_accessed,
    user_role,
    metadata
  ) VALUES (
    _user_id,
    _access_type,
    COALESCE(_record_count, 0),
    COALESCE(_regions, ARRAY[]::text[]),
    _user_role_text,
    _metadata
  );
  
  -- Return data with explicit column list and type casting
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.region,
    g.province,
    g.municipality,
    g.gps_lat::double precision,
    g.gps_lng::double precision,
    g.livestock_type,
    g.created_at,
    g.is_deleted,
    g.is_program_participant,
    g.program_group,
    g.data_category,
    g.active_animal_count::bigint,
    g.cattle_count::bigint,
    g.goat_count::bigint,
    g.carabao_count::bigint,
    g.sheep_count::bigint
  FROM gov_farm_analytics g
  WHERE g.is_deleted = false;
END;
$$;