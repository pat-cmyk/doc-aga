-- Drop and recreate gov_farm_analytics view with security_invoker = true
-- This ensures RLS policies on underlying tables (farms, animals) are enforced

DROP VIEW IF EXISTS public.gov_farm_analytics;

CREATE VIEW public.gov_farm_analytics
WITH (security_invoker = true)
AS
SELECT 
  f.id,
  f.name,
  f.region,
  f.province,
  f.municipality,
  f.owner_id,
  f.gps_lat,
  f.gps_lng,
  f.lgu_code,
  f.ffedis_id,
  f.validation_status,
  f.validated_at,
  f.is_program_participant,
  f.program_group,
  COUNT(a.id) as animal_count,
  COUNT(a.id) FILTER (WHERE a.is_deleted = false AND a.exit_date IS NULL) as active_animal_count,
  COUNT(DISTINCT hr.id) FILTER (WHERE hr.visit_date >= CURRENT_DATE - INTERVAL '7 days') as health_events_7d,
  COUNT(DISTINCT hr.id) FILTER (WHERE hr.visit_date >= CURRENT_DATE - INTERVAL '30 days') as health_events_30d
FROM public.farms f
LEFT JOIN public.animals a ON a.farm_id = f.id
LEFT JOIN public.health_records hr ON hr.animal_id = a.id
WHERE f.is_deleted = false
GROUP BY f.id, f.name, f.region, f.province, f.municipality, f.owner_id, 
         f.gps_lat, f.gps_lng, f.lgu_code, f.ffedis_id, f.validation_status, 
         f.validated_at, f.is_program_participant, f.program_group;

-- Add comment explaining security model
COMMENT ON VIEW public.gov_farm_analytics IS 'Government analytics view. Uses security_invoker=true so RLS policies on farms/animals tables are enforced based on the querying user.';