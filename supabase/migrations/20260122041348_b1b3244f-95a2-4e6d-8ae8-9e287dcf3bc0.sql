-- Step 1: Drop existing RPC function that depends on the view
DROP FUNCTION IF EXISTS public.get_gov_farm_analytics_with_audit(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.get_gov_farm_analytics();

-- Step 2: Drop and recreate gov_farm_analytics view WITHOUT owner_id
DROP VIEW IF EXISTS public.gov_farm_analytics;

CREATE VIEW public.gov_farm_analytics 
WITH (security_barrier = true, security_invoker = true) AS
SELECT 
    f.id,
    f.name,
    f.region,
    f.province,
    f.municipality,
    f.gps_lat,
    f.gps_lng,
    f.lgu_code,
    f.ffedis_id,
    f.validation_status,
    f.validated_at,
    f.is_program_participant,
    f.program_group,
    count(a.id) AS animal_count,
    count(a.id) FILTER (WHERE a.is_deleted = false AND a.exit_date IS NULL) AS active_animal_count,
    count(DISTINCT hr.id) FILTER (WHERE hr.visit_date >= CURRENT_DATE - INTERVAL '7 days') AS health_events_7d,
    count(DISTINCT hr.id) FILTER (WHERE hr.visit_date >= CURRENT_DATE - INTERVAL '30 days') AS health_events_30d
FROM farms f
LEFT JOIN animals a ON a.farm_id = f.id
LEFT JOIN health_records hr ON hr.animal_id = a.id
WHERE f.is_deleted = false
  AND (
    has_role(auth.uid(), 'government'::user_role) OR
    has_role(auth.uid(), 'admin'::user_role) OR
    f.owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM farm_memberships fm
      WHERE fm.farm_id = f.id 
        AND fm.user_id = auth.uid() 
        AND fm.invitation_status = 'accepted'
    )
  )
GROUP BY f.id, f.name, f.region, f.province, f.municipality, 
         f.gps_lat, f.gps_lng, f.lgu_code, f.ffedis_id, 
         f.validation_status, f.validated_at, 
         f.is_program_participant, f.program_group;

-- Step 3: Create audit log table for government analytics access
CREATE TABLE IF NOT EXISTS public.gov_analytics_access_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    access_type TEXT NOT NULL DEFAULT 'view',
    records_accessed INTEGER NOT NULL DEFAULT 0,
    regions_accessed TEXT[] DEFAULT '{}',
    user_role TEXT,
    metadata JSONB DEFAULT '{}',
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE public.gov_analytics_access_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "admins_view_gov_analytics_audit"
ON public.gov_analytics_access_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Service role can insert (for RPC function)
CREATE POLICY "service_insert_gov_analytics_audit"
ON public.gov_analytics_access_audit_log
FOR INSERT
WITH CHECK (true);

-- Step 4: Create audited access RPC function
CREATE OR REPLACE FUNCTION public.get_gov_farm_analytics_with_audit(
    _access_type TEXT DEFAULT 'view',
    _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    region TEXT,
    province TEXT,
    municipality TEXT,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    lgu_code TEXT,
    ffedis_id TEXT,
    validation_status TEXT,
    validated_at TIMESTAMPTZ,
    is_program_participant BOOLEAN,
    program_group TEXT,
    animal_count BIGINT,
    active_animal_count BIGINT,
    health_events_7d BIGINT,
    health_events_30d BIGINT
)
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
    _user_id := auth.uid();
    
    -- Verify government or admin access
    IF NOT (has_role(_user_id, 'government'::user_role) OR has_role(_user_id, 'admin'::user_role)) THEN
        RAISE EXCEPTION 'Unauthorized: Government or admin role required';
    END IF;
    
    -- Get user role for audit
    SELECT r.role::TEXT INTO _user_role
    FROM user_roles r
    WHERE r.user_id = _user_id
    LIMIT 1;
    
    -- Get record count and regions for audit
    SELECT COUNT(*)::INTEGER, ARRAY_AGG(DISTINCT gfa.region)
    INTO _record_count, _regions
    FROM gov_farm_analytics gfa;
    
    -- Log access for audit trail
    INSERT INTO gov_analytics_access_audit_log (
        user_id, 
        access_type, 
        records_accessed, 
        regions_accessed, 
        user_role, 
        metadata
    )
    VALUES (
        _user_id,
        _access_type,
        _record_count,
        COALESCE(_regions, '{}'),
        _user_role,
        _metadata
    );
    
    -- Return data from view
    RETURN QUERY SELECT * FROM gov_farm_analytics;
END;
$$;

-- Grant execute to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION public.get_gov_farm_analytics_with_audit TO authenticated;