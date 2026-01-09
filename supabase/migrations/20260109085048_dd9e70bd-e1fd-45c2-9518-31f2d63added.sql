-- Create RPC function with audit logging (using unique name to avoid conflict)
CREATE OR REPLACE FUNCTION public.get_gov_farm_analytics_with_audit(
  _access_type TEXT DEFAULT 'view',
  _metadata JSONB DEFAULT '{}'
)
RETURNS SETOF public.gov_farm_analytics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _user_role TEXT;
  _record_count INTEGER;
  _regions TEXT[];
BEGIN
  -- Get current user
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Determine user's role for audit record
  SELECT 
    CASE 
      WHEN public.has_role(_user_id, 'admin'::public.user_role) THEN 'admin'
      WHEN public.has_role(_user_id, 'government'::public.user_role) THEN 'government'
      ELSE 'user'
    END INTO _user_role;

  -- Count records and get distinct regions that will be returned
  SELECT COUNT(*), array_agg(DISTINCT region) FILTER (WHERE region IS NOT NULL)
  INTO _record_count, _regions
  FROM public.gov_farm_analytics;

  -- Log the access
  INSERT INTO public.gov_analytics_access_audit_log (
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
    COALESCE(_regions, '{}'),
    _user_role,
    _metadata
  );

  -- Return the data from the view
  RETURN QUERY SELECT * FROM public.gov_farm_analytics;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.get_gov_farm_analytics_with_audit IS 
'Secure function to access gov_farm_analytics with automatic audit logging.
Logs user_id, role, access type, record count, and regions accessed.';