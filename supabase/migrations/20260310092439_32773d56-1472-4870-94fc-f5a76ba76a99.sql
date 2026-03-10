CREATE OR REPLACE FUNCTION public.get_grant_effectiveness(
  p_region text DEFAULT NULL,
  p_province text DEFAULT NULL,
  p_municipality text DEFAULT NULL,
  p_data_category text DEFAULT 'live'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH filtered_animals AS (
    SELECT
      a.id,
      COALESCE(a.acquisition_type, 'purchased') AS acquisition_type,
      COALESCE(a.grant_source, 'Unknown Source') AS grant_source,
      a.exit_date,
      a.exit_reason
    FROM animals a
    INNER JOIN farms f ON a.farm_id = f.id
    WHERE a.is_deleted = false
      AND f.is_deleted = false
      AND (p_data_category = 'all' OR COALESCE(f.data_category, 'live') = p_data_category)
      AND (p_region IS NULL OR f.region = p_region)
      AND (p_province IS NULL OR f.province = p_province)
      AND (p_municipality IS NULL OR f.municipality = p_municipality)
  ),
  health_per_animal AS (
    SELECT hr.animal_id, COUNT(*) AS cnt
    FROM health_records hr
    WHERE hr.animal_id IN (SELECT id FROM filtered_animals)
    GROUP BY hr.animal_id
  ),
  milk_per_animal AS (
    SELECT mr.animal_id, SUM(mr.liters) AS total_liters
    FROM milking_records mr
    WHERE mr.animal_id IN (SELECT id FROM filtered_animals)
    GROUP BY mr.animal_id
  ),
  ai_per_animal AS (
    SELECT
      ar.animal_id,
      COUNT(*) AS total_ai,
      COUNT(*) FILTER (WHERE ar.pregnancy_confirmed = true) AS confirmed
    FROM ai_records ar
    WHERE ar.animal_id IN (SELECT id FROM filtered_animals)
    GROUP BY ar.animal_id
  ),
  by_type AS (
    SELECT
      fa.acquisition_type,
      COUNT(fa.id) AS animal_count,
      ROUND(COALESCE(AVG(COALESCE(hpa.cnt, 0)), 0)::numeric, 1) AS avg_health_events,
      ROUND(
        CASE
          WHEN COUNT(mpa.animal_id) > 0
          THEN SUM(COALESCE(mpa.total_liters, 0)) / COUNT(mpa.animal_id)
          ELSE 0
        END::numeric, 1
      ) AS avg_milk_production,
      ROUND(
        CASE
          WHEN COUNT(fa.id) > 0
          THEN COUNT(fa.id) FILTER (
            WHERE fa.exit_date IS NOT NULL
              AND fa.exit_reason IN ('died', 'slaughtered_emergency')
          ) * 100.0 / COUNT(fa.id)
          ELSE 0
        END::numeric, 1
      ) AS mortality_rate,
      ROUND(
        CASE
          WHEN COALESCE(SUM(apa.total_ai), 0) > 0
          THEN COALESCE(SUM(apa.confirmed), 0) * 100.0 / SUM(apa.total_ai)
          ELSE 0
        END::numeric, 1
      ) AS breeding_success_rate
    FROM filtered_animals fa
    LEFT JOIN health_per_animal hpa ON hpa.animal_id = fa.id
    LEFT JOIN milk_per_animal mpa ON mpa.animal_id = fa.id
    LEFT JOIN ai_per_animal apa ON apa.animal_id = fa.id
    GROUP BY fa.acquisition_type
  ),
  by_source AS (
    SELECT
      fa.grant_source AS source,
      COUNT(fa.id) AS animal_count,
      ROUND(COALESCE(AVG(COALESCE(hpa.cnt, 0)), 0)::numeric, 1) AS avg_health_events,
      ROUND(
        CASE
          WHEN COUNT(mpa.animal_id) > 0
          THEN SUM(COALESCE(mpa.total_liters, 0)) / COUNT(mpa.animal_id)
          ELSE 0
        END::numeric, 1
      ) AS avg_milk_production,
      ROUND(
        CASE
          WHEN COUNT(fa.id) > 0
          THEN COUNT(fa.id) FILTER (
            WHERE fa.exit_date IS NOT NULL
              AND fa.exit_reason IN ('died', 'slaughtered_emergency')
          ) * 100.0 / COUNT(fa.id)
          ELSE 0
        END::numeric, 1
      ) AS mortality_rate,
      ROUND(
        CASE
          WHEN COALESCE(SUM(apa.total_ai), 0) > 0
          THEN COALESCE(SUM(apa.confirmed), 0) * 100.0 / SUM(apa.total_ai)
          ELSE 0
        END::numeric, 1
      ) AS breeding_success_rate
    FROM filtered_animals fa
    LEFT JOIN health_per_animal hpa ON hpa.animal_id = fa.id
    LEFT JOIN milk_per_animal mpa ON mpa.animal_id = fa.id
    LEFT JOIN ai_per_animal apa ON apa.animal_id = fa.id
    WHERE fa.acquisition_type = 'grant'
    GROUP BY fa.grant_source
    ORDER BY COUNT(fa.id) DESC
  )
  SELECT json_build_object(
    'grantAnimals', COALESCE(
      (SELECT json_build_object(
        'count', bt.animal_count,
        'avgHealthEvents', bt.avg_health_events,
        'avgMilkProduction', bt.avg_milk_production,
        'mortalityRate', bt.mortality_rate,
        'breedingSuccessRate', bt.breeding_success_rate
      ) FROM by_type bt WHERE bt.acquisition_type = 'grant'),
      json_build_object('count', 0, 'avgHealthEvents', 0, 'avgMilkProduction', 0, 'mortalityRate', 0, 'breedingSuccessRate', 0)
    ),
    'purchasedAnimals', COALESCE(
      (SELECT json_build_object(
        'count', bt.animal_count,
        'avgHealthEvents', bt.avg_health_events,
        'avgMilkProduction', bt.avg_milk_production,
        'mortalityRate', bt.mortality_rate,
        'breedingSuccessRate', bt.breeding_success_rate
      ) FROM by_type bt WHERE bt.acquisition_type = 'purchased'),
      json_build_object('count', 0, 'avgHealthEvents', 0, 'avgMilkProduction', 0, 'mortalityRate', 0, 'breedingSuccessRate', 0)
    ),
    'bornOnFarmAnimals', COALESCE(
      (SELECT json_build_object(
        'count', bt.animal_count,
        'avgHealthEvents', bt.avg_health_events,
        'avgMilkProduction', bt.avg_milk_production,
        'mortalityRate', bt.mortality_rate,
        'breedingSuccessRate', bt.breeding_success_rate
      ) FROM by_type bt WHERE bt.acquisition_type = 'born_on_farm'),
      json_build_object('count', 0, 'avgHealthEvents', 0, 'avgMilkProduction', 0, 'mortalityRate', 0, 'breedingSuccessRate', 0)
    ),
    'byGrantSource', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'source', bs.source,
          'count', bs.animal_count,
          'avgHealthEvents', bs.avg_health_events,
          'avgMilkProduction', bs.avg_milk_production,
          'mortalityRate', bs.mortality_rate,
          'breedingSuccessRate', bs.breeding_success_rate
        )
      ) FROM by_source bs),
      '[]'::json
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_grant_effectiveness(text, text, text, text) TO authenticated;