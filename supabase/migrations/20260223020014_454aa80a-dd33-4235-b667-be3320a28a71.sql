
CREATE OR REPLACE FUNCTION public.get_faq_usage_stats()
RETURNS TABLE(
  id uuid,
  question text,
  category text,
  is_active boolean,
  created_at timestamptz,
  total_matches bigint,
  matches_last_30d bigint,
  matches_last_7d bigint,
  last_matched_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.question,
    f.category,
    f.is_active,
    f.created_at,
    COUNT(q.id) AS total_matches,
    COUNT(q.id) FILTER (WHERE q.created_at >= now() - interval '30 days') AS matches_last_30d,
    COUNT(q.id) FILTER (WHERE q.created_at >= now() - interval '7 days') AS matches_last_7d,
    MAX(q.created_at) AS last_matched_at
  FROM doc_aga_faqs f
  LEFT JOIN doc_aga_queries q ON q.matched_faq_id = f.id
  GROUP BY f.id, f.question, f.category, f.is_active, f.created_at
  ORDER BY total_matches DESC;
$$;

-- Also create a small RPC for the daily timeline data
CREATE OR REPLACE FUNCTION public.get_faq_match_timeline(p_days integer DEFAULT 30)
RETURNS TABLE(
  match_date date,
  match_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.dt::date AS match_date,
    COUNT(q.id) AS match_count
  FROM generate_series(
    (now() - (p_days || ' days')::interval)::date,
    now()::date,
    '1 day'::interval
  ) AS d(dt)
  LEFT JOIN doc_aga_queries q
    ON q.matched_faq_id IS NOT NULL
    AND q.created_at::date = d.dt::date
  GROUP BY d.dt::date
  ORDER BY d.dt::date;
$$;
