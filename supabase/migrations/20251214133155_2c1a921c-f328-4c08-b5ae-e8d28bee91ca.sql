
-- Seed recent daily_farm_stats for trend charts (Nov 21 - Dec 14, 2025)
-- First, get all active farms and create daily stats for each

INSERT INTO daily_farm_stats (farm_id, stat_date, total_milk_liters, stage_counts)
SELECT 
  f.id as farm_id,
  d.date as stat_date,
  -- Realistic milk production varying by day (base 20-80L per farm with some variance)
  ROUND((20 + (RANDOM() * 60) + (SIN(EXTRACT(DOY FROM d.date) * 0.1) * 10))::numeric, 1) as total_milk_liters,
  -- Stage counts JSON with realistic distribution
  jsonb_build_object(
    'Calf', FLOOR(1 + RANDOM() * 3)::int,
    'Heifer', FLOOR(1 + RANDOM() * 4)::int,
    'Lactating', FLOOR(2 + RANDOM() * 5)::int,
    'Dry', FLOOR(1 + RANDOM() * 3)::int,
    'Bull', FLOOR(0 + RANDOM() * 2)::int,
    'Pregnant', FLOOR(1 + RANDOM() * 4)::int
  ) as stage_counts
FROM farms f
CROSS JOIN generate_series('2025-11-21'::date, '2025-12-14'::date, '1 day'::interval) as d(date)
WHERE f.is_deleted = false
ON CONFLICT (farm_id, stat_date) DO UPDATE SET
  total_milk_liters = EXCLUDED.total_milk_liters,
  stage_counts = EXCLUDED.stage_counts;

-- Seed recent health_records for health events chart (Nov 5 - Dec 14, 2025)
INSERT INTO health_records (animal_id, visit_date, diagnosis, treatment, notes, created_by)
SELECT 
  a.id as animal_id,
  ('2025-11-05'::date + (RANDOM() * 39)::int) as visit_date,
  diagnosis_options[(1 + FLOOR(RANDOM() * 12))::int] as diagnosis,
  treatment_options[(1 + FLOOR(RANDOM() * 10))::int] as treatment,
  notes_options[(1 + FLOOR(RANDOM() * 8))::int] as notes,
  NULL as created_by
FROM animals a
CROSS JOIN (SELECT 1 as n UNION SELECT 2 UNION SELECT 3) as multiplier
CROSS JOIN (
  SELECT ARRAY[
    'Respiratory infection', 'Mastitis', 'Hoof rot', 'Bloat', 
    'Parasitic infection', 'Eye infection', 'Skin lesion', 'Diarrhea',
    'Lameness', 'Fever', 'Poor appetite', 'Reproductive issue'
  ] as diagnosis_options
) d
CROSS JOIN (
  SELECT ARRAY[
    'Antibiotic injection', 'Oral medication', 'Topical treatment', 'Deworming',
    'Anti-inflammatory', 'Vitamin supplement', 'Fluid therapy', 'Hoof trimming',
    'Isolation and monitoring', 'Supportive care'
  ] as treatment_options
) t
CROSS JOIN (
  SELECT ARRAY[
    'Animal responding well to treatment', 'Follow-up needed in 7 days',
    'Continue monitoring', 'Condition improving', 'Mild case, recovery expected',
    'Recommend dietary adjustment', 'Keep dry and warm', 'Check again next week'
  ] as notes_options
) no
WHERE a.is_deleted = false
  AND RANDOM() < 0.15
LIMIT 120;

-- Seed recent milking_records for milk production chart (Nov 29 - Dec 14, 2025)
INSERT INTO milking_records (animal_id, record_date, liters, created_by)
SELECT 
  a.id as animal_id,
  d.date as record_date,
  -- Realistic milk production (5-15L per animal per day with variance)
  ROUND((5 + (RANDOM() * 10) + (SIN(EXTRACT(DOY FROM d.date) * 0.2) * 2))::numeric, 1) as liters,
  NULL as created_by
FROM animals a
CROSS JOIN generate_series('2025-11-29'::date, '2025-12-14'::date, '1 day'::interval) as d(date)
WHERE a.is_deleted = false
  AND LOWER(a.gender) = 'female'
  AND (a.life_stage IN ('Lactating', 'Milking', 'Adult') OR a.milking_stage IS NOT NULL)
  AND RANDOM() < 0.7
ON CONFLICT DO NOTHING;

-- Seed diverse doc_aga_queries for farmer queries topics chart
INSERT INTO doc_aga_queries (farm_id, user_id, question, answer, created_at)
SELECT 
  f.id as farm_id,
  f.owner_id as user_id,
  questions[(1 + FLOOR(RANDOM() * array_length(questions, 1)))::int] as question,
  'Doc Aga provided detailed guidance on this topic.' as answer,
  ('2025-11-01'::timestamp + (RANDOM() * 43 * 24 * 60 * 60) * INTERVAL '1 second') as created_at
FROM farms f
CROSS JOIN generate_series(1, 8) as n
CROSS JOIN (
  SELECT ARRAY[
    -- Mastitis topic
    'Paano ko malalaman kung may mastitis ang baka ko?',
    'What are the signs of mastitis in dairy cattle?',
    'Ano ang gamot sa mastitis?',
    'My cow has swollen udder, is this mastitis?',
    
    -- Pregnancy/Breeding topic
    'Kailan dapat i-breed ang baka pagkatapos manganak?',
    'How do I know if my goat is pregnant?',
    'What are signs of heat in carabao?',
    'Ilang buwan ang pregnancy ng baka?',
    'When is the best time for AI after heat detection?',
    
    -- Feeding/Nutrition topic
    'Magkano dapat ang feeds per day ng baka?',
    'What is the best feed for lactating cows?',
    'Ano ang magandang dagdag sa damo para sa baka?',
    'How much water should a goat drink daily?',
    'What supplements help milk production?',
    
    -- Digestive issues topic
    'May diarrhea ang baka ko, ano ang gagawin?',
    'My calf has bloat, how to treat?',
    'Ano ang sanhi ng pagtatae sa kambing?',
    'How to prevent bloat in cattle?',
    
    -- Vaccination topic
    'Kailan dapat bakunahan ang baka para sa FMD?',
    'What vaccines do calves need?',
    'Schedule ng bakuna para sa kambing?',
    'Is hemorrhagic septicemia vaccine required?',
    
    -- Lameness/Hoof care topic
    'Bakit pumipinkalay ang baka ko?',
    'How to trim goat hooves properly?',
    'My cow has hoof rot, what treatment?',
    'Signs of foot and mouth disease?',
    
    -- Milk production topic
    'Bakit bumaba ang gatas ng baka ko?',
    'How to increase milk yield?',
    'What affects milk quality?',
    'Normal ba ang 8 liters per day?',
    
    -- Deworming topic
    'Gaano kadalas mag-deworm ng kambing?',
    'Best dewormer for cattle?',
    'Signs of parasites in goats?',
    'When to deworm pregnant cows?',
    
    -- Calf care topic
    'Paano alagaan ang bagong silang na guya?',
    'When to wean calves?',
    'My calf is not drinking milk, what to do?',
    'How to prevent scours in calves?',
    
    -- General health topic
    'May lagnat ang kambing ko, ano gagawin?',
    'How to check if cow is sick?',
    'Normal temperature range for cattle?',
    'Emergency first aid for livestock?'
  ] as questions
) q
WHERE f.is_deleted = false;

-- Add more queries to ensure good distribution across topics
INSERT INTO doc_aga_queries (farm_id, user_id, question, answer, created_at)
SELECT 
  f.id as farm_id,
  f.owner_id as user_id,
  topic_questions[(1 + FLOOR(RANDOM() * array_length(topic_questions, 1)))::int] as question,
  'Detailed veterinary advice was provided by Doc Aga.' as answer,
  ('2025-12-01'::timestamp + (RANDOM() * 13 * 24 * 60 * 60) * INTERVAL '1 second') as created_at
FROM farms f
CROSS JOIN generate_series(1, 5) as n
CROSS JOIN (
  SELECT ARRAY[
    'Mastitis treatment options for dairy cows',
    'Pregnancy confirmation methods for goats',
    'Feeding schedule for growing calves',
    'Bloat prevention in cattle',
    'FMD vaccination schedule Philippines',
    'Hoof trimming frequency for goats',
    'Increasing milk production naturally',
    'Deworming calendar for livestock',
    'Newborn calf care tips',
    'Fever management in livestock'
  ] as topic_questions
) tq
WHERE f.is_deleted = false
  AND RANDOM() < 0.4;
