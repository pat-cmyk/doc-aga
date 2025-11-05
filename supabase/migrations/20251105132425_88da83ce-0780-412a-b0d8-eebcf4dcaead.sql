-- Add municipality/LGU tracking to farms
ALTER TABLE farms 
  ADD COLUMN IF NOT EXISTS municipality text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS lgu_code text,
  ADD COLUMN IF NOT EXISTS ffedis_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS validation_status text CHECK (validation_status IN ('validated', 'pending', 'rejected')),
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_program_participant boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS program_group text CHECK (program_group IN ('control', 'pilot', 'none'));

-- Create health symptom categorization table
CREATE TABLE IF NOT EXISTS health_symptom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  health_record_id uuid REFERENCES health_records(id) ON DELETE CASCADE,
  symptom_type text NOT NULL,
  severity text CHECK (severity IN ('mild', 'moderate', 'severe')),
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE health_symptom_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for health_symptom_categories
CREATE POLICY "Farm members can view symptom categories"
  ON health_symptom_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM health_records hr
      JOIN animals a ON a.id = hr.animal_id
      WHERE hr.id = health_symptom_categories.health_record_id
      AND can_access_farm(a.farm_id)
    )
  );

CREATE POLICY "Farm members can insert symptom categories"
  ON health_symptom_categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM health_records hr
      JOIN animals a ON a.id = hr.animal_id
      WHERE hr.id = health_symptom_categories.health_record_id
      AND (is_farm_owner(auth.uid(), a.farm_id) OR is_farm_manager(auth.uid(), a.farm_id) OR is_farmhand(auth.uid(), a.farm_id))
    )
  );

-- Create government analytics view
CREATE OR REPLACE VIEW gov_farm_analytics AS
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
  COUNT(DISTINCT a.id) as animal_count,
  COUNT(DISTINCT CASE WHEN a.is_deleted = false THEN a.id END) as active_animal_count,
  COUNT(DISTINCT h.id) FILTER (WHERE h.visit_date >= CURRENT_DATE - 7) as health_events_7d,
  COUNT(DISTINCT h.id) FILTER (WHERE h.visit_date >= CURRENT_DATE - 30) as health_events_30d
FROM farms f
LEFT JOIN animals a ON a.farm_id = f.id
LEFT JOIN health_records h ON h.animal_id = a.id
WHERE f.is_deleted = false
GROUP BY f.id, f.name, f.region, f.municipality, f.province, f.lgu_code, f.ffedis_id, 
         f.validation_status, f.validated_at, f.is_program_participant, f.program_group,
         f.gps_lat, f.gps_lng, f.owner_id;

-- Create function to get government dashboard stats
CREATE OR REPLACE FUNCTION get_government_stats(
  start_date date,
  end_date date,
  region_filter text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Verify caller is admin
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can access government stats';
  END IF;

  SELECT jsonb_build_object(
    'farm_count', COUNT(DISTINCT f.id),
    'active_animal_count', COUNT(DISTINCT CASE WHEN a.is_deleted = false THEN a.id END),
    'daily_log_count', COUNT(DISTINCT dq.id) + COUNT(DISTINCT h.id),
    'health_event_count', COUNT(DISTINCT h.id),
    'avg_milk_liters', COALESCE(AVG(mr.liters), 0),
    'doc_aga_query_count', COUNT(DISTINCT dq.id)
  ) INTO result
  FROM farms f
  LEFT JOIN animals a ON a.farm_id = f.id
  LEFT JOIN health_records h ON h.animal_id = a.id 
    AND h.visit_date BETWEEN start_date AND end_date
  LEFT JOIN doc_aga_queries dq ON dq.farm_id = f.id 
    AND dq.created_at::date BETWEEN start_date AND end_date
  LEFT JOIN milking_records mr ON mr.animal_id = a.id 
    AND mr.record_date BETWEEN start_date AND end_date
  WHERE f.is_deleted = false
    AND (region_filter IS NULL OR f.region = region_filter);

  RETURN result;
END;
$$;

-- Create function to get health symptom aggregates by municipality
CREATE OR REPLACE FUNCTION get_health_heatmap_data(
  days_back integer DEFAULT 7,
  region_filter text DEFAULT NULL
)
RETURNS TABLE (
  municipality text,
  region text,
  health_event_count bigint,
  total_animals bigint,
  prevalence_rate numeric,
  symptom_types text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can access health heatmap data';
  END IF;

  RETURN QUERY
  SELECT 
    f.municipality,
    f.region,
    COUNT(DISTINCT h.id) as health_event_count,
    COUNT(DISTINCT a.id) as total_animals,
    ROUND((COUNT(DISTINCT h.id)::numeric / NULLIF(COUNT(DISTINCT a.id), 0) * 100), 2) as prevalence_rate,
    array_agg(DISTINCT hsc.symptom_type) FILTER (WHERE hsc.symptom_type IS NOT NULL) as symptom_types
  FROM farms f
  JOIN animals a ON a.farm_id = f.id
  LEFT JOIN health_records h ON h.animal_id = a.id 
    AND h.visit_date >= CURRENT_DATE - days_back
  LEFT JOIN health_symptom_categories hsc ON hsc.health_record_id = h.id
  WHERE f.is_deleted = false 
    AND f.municipality IS NOT NULL
    AND (region_filter IS NULL OR f.region = region_filter)
  GROUP BY f.municipality, f.region
  HAVING COUNT(DISTINCT a.id) > 0
  ORDER BY prevalence_rate DESC;
END;
$$;