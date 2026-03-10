-- ============================================================================
-- Fix: Cooperative Aggregation RPCs — Column Reference Bugs
--
-- Bug 1: get_cooperative_health_overview referenced hr.farm_id which does NOT
--         exist on health_records. Fixed: JOIN through animals to get farm_id.
-- Bug 2: get_cooperative_milk_production referenced volume_liters which does
--         NOT exist on milking_records. The actual column is liters.
--
-- All 4 aggregation RPCs are re-declared here for auditability.
-- No signature changes — CREATE OR REPLACE overwrites in place.
-- ============================================================================

-- 1. FIX: get_cooperative_health_overview
--    health_records has animal_id, NOT farm_id.
--    Must JOIN through animals to reach farm_id.
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
      WHERE a.farm_id = ANY(_farm_ids)
        AND a.is_deleted = false
        AND hr.visit_date >= (CURRENT_DATE - INTERVAL '30 days')
    ),
    'by_diagnosis', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::JSON)
      FROM (
        SELECT COALESCE(hr.diagnosis, 'No Diagnosis') AS diagnosis, COUNT(*) AS count
        FROM public.health_records hr
        JOIN public.animals a ON a.id = hr.animal_id
        WHERE a.farm_id = ANY(_farm_ids)
          AND a.is_deleted = false
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
        AND a.exit_reason = 'death'
        AND a.exit_date >= (CURRENT_DATE - INTERVAL '30 days')
    )
  ) INTO _result;

  RETURN _result;
END;
$$;


-- 2. FIX: get_cooperative_milk_production
--    milking_records column is "liters", NOT "volume_liters".
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
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::JSON)
      FROM (
        SELECT mr.record_date::DATE AS date, SUM(mr.liters) AS liters
        FROM public.milking_records mr
        JOIN public.animals a ON a.id = mr.animal_id
        WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
          AND mr.record_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
        GROUP BY mr.record_date::DATE
        ORDER BY date
      ) d
    ),
    'by_farm', (
      SELECT COALESCE(json_agg(row_to_json(f)), '[]'::JSON)
      FROM (
        SELECT a.farm_id, fa.name AS farm_name, SUM(mr.liters) AS total_liters
        FROM public.milking_records mr
        JOIN public.animals a ON a.id = mr.animal_id
        JOIN public.farms fa ON fa.id = a.farm_id
        WHERE a.farm_id = ANY(_farm_ids) AND a.is_deleted = false
          AND mr.record_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
        GROUP BY a.farm_id, fa.name
        ORDER BY total_liters DESC
      ) f
    )
  ) INTO _result;

  RETURN _result;
END;
$$;


-- 3. Re-declare get_cooperative_herd_summary (no changes, for auditability)
CREATE OR REPLACE FUNCTION public.get_cooperative_herd_summary(_cooperative_id UUID)
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
    RETURN '{"total_animals":0,"by_species":[],"by_breed":[],"by_gender":[]}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_animals', (SELECT COUNT(*) FROM public.animals WHERE farm_id = ANY(_farm_ids) AND is_deleted = false),
    'by_species', (
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::JSON)
      FROM (
        SELECT livestock_type AS species, COUNT(*) AS count
        FROM public.animals
        WHERE farm_id = ANY(_farm_ids) AND is_deleted = false
        GROUP BY livestock_type
        ORDER BY count DESC
      ) s
    ),
    'by_breed', (
      SELECT COALESCE(json_agg(row_to_json(b)), '[]'::JSON)
      FROM (
        SELECT COALESCE(breed, 'Unknown') AS breed, COUNT(*) AS count
        FROM public.animals
        WHERE farm_id = ANY(_farm_ids) AND is_deleted = false
        GROUP BY breed
        ORDER BY count DESC
        LIMIT 20
      ) b
    ),
    'by_gender', (
      SELECT COALESCE(json_agg(row_to_json(g)), '[]'::JSON)
      FROM (
        SELECT COALESCE(gender, 'Unknown') AS gender, COUNT(*) AS count
        FROM public.animals
        WHERE farm_id = ANY(_farm_ids) AND is_deleted = false
        GROUP BY gender
      ) g
    )
  ) INTO _result;

  RETURN _result;
END;
$$;


-- 4. Re-declare get_cooperative_financial_summary (no changes, for auditability)
CREATE OR REPLACE FUNCTION public.get_cooperative_financial_summary(
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
    RETURN '{"total_revenue":0,"total_expenses":0,"revenue_by_farm":[]}'::JSON;
  END IF;

  SELECT json_build_object(
    'total_revenue', (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.farm_revenues
      WHERE farm_id = ANY(_farm_ids) AND (is_deleted IS NULL OR is_deleted = false)
        AND transaction_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
    ),
    'total_expenses', (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.farm_expenses
      WHERE farm_id = ANY(_farm_ids) AND (is_deleted IS NULL OR is_deleted = false)
        AND expense_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
    ),
    'revenue_by_farm', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
      FROM (
        SELECT fr.farm_id, f.name AS farm_name, SUM(fr.amount) AS total
        FROM public.farm_revenues fr
        JOIN public.farms f ON f.id = fr.farm_id
        WHERE fr.farm_id = ANY(_farm_ids) AND (fr.is_deleted IS NULL OR fr.is_deleted = false)
          AND fr.transaction_date >= (CURRENT_DATE - (_days || ' days')::INTERVAL)
        GROUP BY fr.farm_id, f.name
        ORDER BY total DESC
      ) r
    )
  ) INTO _result;

  RETURN _result;
END;
$$;
