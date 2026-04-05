-- Fix: cooperative milk by_farm per-farm totals showing 0
--
-- The previous fix migration aliased the per-farm SUM as `liters` but the
-- frontend CooperativeMilkAnalytics.tsx reads `total_liters` (the original
-- field name). This migration restores the `total_liters` alias so the
-- Production by Farm list displays correctly.
--
-- SSOT: matches the original RPC's field contract. Frontend unchanged.

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
        SELECT a.farm_id, f.name AS farm_name, SUM(mr.liters) AS total_liters
        FROM public.milking_records mr
        JOIN public.animals a ON a.id = mr.animal_id
        JOIN public.farms f ON f.id = a.farm_id
        WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
          AND mr.record_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
        GROUP BY a.farm_id, f.name
        ORDER BY total_liters DESC
      ) bf
    )
  ) INTO _result;

  RETURN _result;
END;
$$;
