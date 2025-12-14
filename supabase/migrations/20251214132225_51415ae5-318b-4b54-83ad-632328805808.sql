-- Seed BCS sample data for testing government dashboard visualization
-- Distribution: ~15% underweight, ~70% optimal, ~15% overweight

INSERT INTO body_condition_scores (animal_id, farm_id, score, assessment_date, notes)
SELECT 
  a.id as animal_id,
  a.farm_id,
  CASE 
    -- 15% underweight (scores 1.5-2.0)
    WHEN random() < 0.15 THEN (1.5 + (random() * 0.5))::numeric(2,1)
    -- 15% overweight (scores 4.0-4.5)
    WHEN random() < 0.30 THEN (4.0 + (random() * 0.5))::numeric(2,1)
    -- 70% optimal (scores 2.5-3.5)
    ELSE (2.5 + (random() * 1.0))::numeric(2,1)
  END as score,
  (CURRENT_DATE - (random() * 90)::int) as assessment_date,
  CASE 
    WHEN random() < 0.3 THEN 'Regular monthly assessment'
    WHEN random() < 0.5 THEN 'Routine checkup'
    WHEN random() < 0.7 THEN 'Pre-breeding evaluation'
    ELSE NULL
  END as notes
FROM animals a
WHERE a.is_deleted = false
  AND a.exit_date IS NULL
ORDER BY random()
LIMIT 150;

-- Add some follow-up assessments for trend tracking (about 40 more records)
INSERT INTO body_condition_scores (animal_id, farm_id, score, assessment_date, notes)
SELECT 
  bcs.animal_id,
  bcs.farm_id,
  -- Slight variation from previous score (trending toward optimal)
  CASE 
    WHEN bcs.score < 2.5 THEN LEAST(bcs.score + (random() * 0.5)::numeric(2,1), 3.5)
    WHEN bcs.score > 3.5 THEN GREATEST(bcs.score - (random() * 0.5)::numeric(2,1), 2.5)
    ELSE bcs.score + ((random() - 0.5) * 0.3)::numeric(2,1)
  END as score,
  bcs.assessment_date + (14 + (random() * 30)::int) as assessment_date,
  'Follow-up assessment' as notes
FROM body_condition_scores bcs
WHERE bcs.assessment_date < CURRENT_DATE - 30
ORDER BY random()
LIMIT 40;