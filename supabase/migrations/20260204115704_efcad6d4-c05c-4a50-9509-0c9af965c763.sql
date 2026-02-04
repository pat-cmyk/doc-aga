-- Drop existing function and recreate with correct return type matching gov_farm_analytics view
DROP FUNCTION IF EXISTS public.get_gov_farm_analytics_with_audit(TEXT, JSONB);

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
    gps_lat NUMERIC(9,6),
    gps_lng NUMERIC(9,6),
    livestock_type TEXT,
    created_at TIMESTAMPTZ,
    is_deleted BOOLEAN,
    is_program_participant BOOLEAN,
    program_group TEXT,
    data_category TEXT,
    active_animal_count BIGINT,
    cattle_count BIGINT,
    goat_count BIGINT,
    carabao_count BIGINT,
    sheep_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role_val user_role;
    records_count INTEGER;
    regions_list TEXT[];
BEGIN
    -- Get user role for audit
    SELECT role INTO user_role_val FROM profiles WHERE id = auth.uid();
    
    -- Check authorization
    IF user_role_val IS NULL OR user_role_val NOT IN ('government', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Government or admin role required';
    END IF;
    
    -- Get data and count for audit
    SELECT COUNT(*), array_agg(DISTINCT v.region)
    INTO records_count, regions_list
    FROM gov_farm_analytics v;
    
    -- Log access
    INSERT INTO gov_analytics_access_audit_log (
        user_id,
        user_role,
        access_type,
        records_accessed,
        regions_accessed,
        metadata
    ) VALUES (
        auth.uid(),
        user_role_val::TEXT,
        _access_type,
        records_count,
        regions_list,
        _metadata
    );
    
    -- Return the view data
    RETURN QUERY SELECT * FROM gov_farm_analytics;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_gov_farm_analytics_with_audit(TEXT, JSONB) TO authenticated;