
-- Drop the existing unsecured view
DROP VIEW IF EXISTS public.gov_farm_analytics;

-- Recreate with security barrier and access control
-- security_invoker = true means the view runs with the calling user's permissions
-- security_barrier = true prevents query optimization from leaking data
CREATE VIEW public.gov_farm_analytics 
WITH (security_barrier = true, security_invoker = true)
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
  count(a.id) AS animal_count,
  count(a.id) FILTER (WHERE a.is_deleted = false AND a.exit_date IS NULL) AS active_animal_count,
  count(DISTINCT hr.id) FILTER (WHERE hr.visit_date >= (CURRENT_DATE - '7 days'::interval)) AS health_events_7d,
  count(DISTINCT hr.id) FILTER (WHERE hr.visit_date >= (CURRENT_DATE - '30 days'::interval)) AS health_events_30d
FROM public.farms f
LEFT JOIN public.animals a ON a.farm_id = f.id
LEFT JOIN public.health_records hr ON hr.animal_id = a.id
WHERE 
  f.is_deleted = false
  AND (
    -- Government officials and admins can see all farms
    public.has_role(auth.uid(), 'government'::user_role)
    OR public.has_role(auth.uid(), 'admin'::user_role)
    -- Farm owners can see their own farm
    OR f.owner_id = auth.uid()
    -- Farm team members can see their assigned farm
    OR EXISTS (
      SELECT 1 FROM public.farm_memberships fm
      WHERE fm.farm_id = f.id
      AND fm.user_id = auth.uid()
      AND fm.invitation_status = 'accepted'
    )
  )
GROUP BY f.id, f.name, f.region, f.province, f.municipality, f.owner_id, 
         f.gps_lat, f.gps_lng, f.lgu_code, f.ffedis_id, f.validation_status, 
         f.validated_at, f.is_program_participant, f.program_group;

-- Add comment explaining security
COMMENT ON VIEW public.gov_farm_analytics IS 
'Secure view for government farm analytics with row-level access control.
Access: government/admin users see all farms; farm owners/members see only their farm.
Uses security_barrier to prevent data leakage through query optimization.';
