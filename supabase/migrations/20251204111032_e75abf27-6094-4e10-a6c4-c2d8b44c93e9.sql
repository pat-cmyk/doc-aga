-- Fix gov_farm_analytics view to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures the view respects RLS policies of the querying user

-- Drop the existing view
DROP VIEW IF EXISTS public.gov_farm_analytics;

-- Recreate with security_invoker = true
CREATE VIEW public.gov_farm_analytics
WITH (security_invoker = true)
AS
SELECT 
    f.id,
    f.name,
    f.region,
    f.municipality,
    f.province,
    f.lgu_code,
    f.ffedis_id,
    f.validation_status,
    f.validated_at,
    f.is_program_participant,
    f.program_group,
    f.gps_lat,
    f.gps_lng,
    f.owner_id,
    count(DISTINCT a.id) AS animal_count,
    count(DISTINCT CASE WHEN a.is_deleted = false THEN a.id ELSE NULL END) AS active_animal_count,
    count(DISTINCT h.id) FILTER (WHERE h.visit_date >= CURRENT_DATE - 7) AS health_events_7d,
    count(DISTINCT h.id) FILTER (WHERE h.visit_date >= CURRENT_DATE - 30) AS health_events_30d
FROM farms f
LEFT JOIN animals a ON a.farm_id = f.id
LEFT JOIN health_records h ON h.animal_id = a.id
WHERE f.is_deleted = false
GROUP BY f.id, f.name, f.region, f.municipality, f.province, f.lgu_code, 
         f.ffedis_id, f.validation_status, f.validated_at, f.is_program_participant, 
         f.program_group, f.gps_lat, f.gps_lng, f.owner_id;

-- Grant select to authenticated users (access will be controlled by underlying RLS)
GRANT SELECT ON public.gov_farm_analytics TO authenticated;