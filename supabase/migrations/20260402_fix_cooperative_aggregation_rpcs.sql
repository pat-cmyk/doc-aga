-- Migration: Fix cooperative aggregation RPCs returning zeros
--
-- Root cause: get_cooperative_farm_ids used RETURNS SETOF UUID which produces
-- an unnamed column, so SELECT farm_id FROM get_cooperative_farm_ids(...) in
-- the aggregation RPCs was failing/NULL silently, triggering the "no farms"
-- fallback and returning 0 for all totals.
--
-- Additional bugs found:
-- 1. get_cooperative_milk_production: mr.volume_liters -> mr.liters (actual column name)
-- 2. get_cooperative_health_overview: hr.farm_id doesn't exist -> must join via animals

-- ============================================================================
-- 1. Fix get_cooperative_farm_ids to return a TABLE with named column
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_cooperative_farm_ids(UUID);

CREATE OR REPLACE FUNCTION public.get_cooperative_farm_ids(_cooperative_id UUID)
RETURNS TABLE(farm_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.farm_id
  FROM public.cooperative_memberships cm
  WHERE cm.cooperative_id = _cooperative_id
    AND cm.invitation_status = 'accepted'
$$;

-- ============================================================================
-- 2. Fix get_cooperative_milk_production: volume_liters -> liters
--    Also: milking_records has no farm_id, must join via animals (was already correct)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_cooperative_milk_production(
  _cooperative_id UUID,
  _days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSON;
  _farm_ids UUID[];
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN '{"error":"not_authorized"}'::JSON;
  END IF;

  SELECT ARRAY_AGG(farm_id) INTO _farm_ids
  FROM public.get_cooperative_farm_ids(_cooperative_id);

  IF _farm_ids IS NULL OR array_length(_farm_ids, 1) IS NULL THEN
    RETURN '{"total_liters":0,"daily":[],"by_farm":[]}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_liters', (
      SELECT COALESCE(SUM(mr.liters), 0)
      FROM public.milking_records mr
      JOIN public.animals a ON a.id = mr.animal_id
      WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
        AND mr.record_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
    ),
    'daily', (
      SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.date), '[]'::JSON)
      FROM (
        SELECT mr.record_date::DATE AS date, SUM(mr.liters) AS liters
        FROM public.milking_records mr
        JOIN public.animals a ON a.id = mr.animal_id
        WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
          AND mr.record_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
        GROUP BY mr.record_date
        ORDER BY mr.record_date
      ) d
    ),
    'by_farm', (
      SELECT COALESCE(json_agg(row_to_json(bf)), '[]'::JSON)
      FROM (
        SELECT a.farm_id, f.name AS farm_name, SUM(mr.liters) AS liters
        FROM public.milking_records mr
        JOIN public.animals a ON a.id = mr.animal_id
        JOIN public.farms f ON f.id = a.farm_id
        WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
          AND mr.record_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
        GROUP BY a.farm_id, f.name
        ORDER BY liters DESC
      ) bf
    )
  ) INTO _result;

  RETURN _result;
END;
$$;

-- ============================================================================
-- 3. Fix get_cooperative_health_overview: join through animals to get farm_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_cooperative_health_overview(_cooperative_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSON;
  _farm_ids UUID[];
BEGIN
  IF NOT public.is_cooperative_admin(auth.uid(), _cooperative_id) THEN
    RETURN '{"error":"not_authorized"}'::JSON;
  END IF;

  SELECT ARRAY_AGG(farm_id) INTO _farm_ids
  FROM public.get_cooperative_farm_ids(_cooperative_id);

  IF _farm_ids IS NULL OR array_length(_farm_ids, 1) IS NULL THEN
    RETURN '{"total_records_30d":0,"by_diagnosis":[],"mortality_30d":0}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_records_30d', (
      SELECT COUNT(*)
      FROM public.health_records hr
      JOIN public.animals a ON a.id = hr.animal_id
      WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
        AND hr.visit_date >= (CURRENT_DATE - INTERVAL '30 days')
    ),
    'by_diagnosis', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::JSON)
      FROM (
        SELECT COALESCE(hr.diagnosis, 'No Diagnosis') AS diagnosis, COUNT(*) AS count
        FROM public.health_records hr
        JOIN public.animals a ON a.id = hr.animal_id
        WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
          AND hr.visit_date >= (CURRENT_DATE - INTERVAL '90 days')
        GROUP BY hr.diagnosis
        ORDER BY count DESC
        LIMIT 10
      ) d
    ),
    'mortality_30d', (
      SELECT COUNT(*)
      FROM public.animals a
      WHERE a.farm_id = ANY(_farm_ids)
        AND a.exit_reason = 'died'
        AND a.exit_date >= (CURRENT_DATE - INTERVAL '30 days')
    )
  ) INTO _result;

  RETURN _result;
END;
$$;
