
-- =====================================================
-- GOVERNMENT DASHBOARD DATA SEEDING FOR PRESENTATION
-- =====================================================

-- 1. PREVENTIVE HEALTH SCHEDULES (~200 records)
-- Mix of vaccination and deworming with completed, scheduled, and overdue status

-- Philippine vaccination protocols
INSERT INTO preventive_health_schedules (animal_id, farm_id, schedule_type, treatment_name, scheduled_date, status, notes)
SELECT 
  a.id as animal_id,
  a.farm_id,
  'vaccination' as schedule_type,
  (ARRAY['FMD Vaccine', 'Hemorrhagic Septicemia', 'Blackleg Vaccine', 'PPR Vaccine', 'Rabies Vaccine', 'Brucellosis Vaccine'])[floor(random() * 6 + 1)] as treatment_name,
  (CURRENT_DATE - (random() * 60)::int) as scheduled_date,
  'completed' as status,
  'Completed as scheduled' as notes
FROM animals a
WHERE a.is_deleted = false AND a.exit_date IS NULL
ORDER BY random()
LIMIT 80;

-- Upcoming scheduled vaccinations
INSERT INTO preventive_health_schedules (animal_id, farm_id, schedule_type, treatment_name, scheduled_date, status, notes)
SELECT 
  a.id as animal_id,
  a.farm_id,
  'vaccination' as schedule_type,
  (ARRAY['FMD Vaccine', 'Hemorrhagic Septicemia', 'Blackleg Vaccine', 'PPR Vaccine'])[floor(random() * 4 + 1)] as treatment_name,
  (CURRENT_DATE + (random() * 30 + 7)::int) as scheduled_date,
  'scheduled' as status,
  'Annual booster due' as notes
FROM animals a
WHERE a.is_deleted = false AND a.exit_date IS NULL
ORDER BY random()
LIMIT 40;

-- Overdue vaccinations (for realistic compliance metrics)
INSERT INTO preventive_health_schedules (animal_id, farm_id, schedule_type, treatment_name, scheduled_date, status, notes)
SELECT 
  a.id as animal_id,
  a.farm_id,
  'vaccination' as schedule_type,
  (ARRAY['FMD Vaccine', 'Hemorrhagic Septicemia', 'Blackleg Vaccine'])[floor(random() * 3 + 1)] as treatment_name,
  (CURRENT_DATE - (random() * 30 + 5)::int) as scheduled_date,
  'scheduled' as status,
  'Pending - awaiting supplies' as notes
FROM animals a
WHERE a.is_deleted = false AND a.exit_date IS NULL
ORDER BY random()
LIMIT 20;

-- Deworming schedules (completed)
INSERT INTO preventive_health_schedules (animal_id, farm_id, schedule_type, treatment_name, scheduled_date, status, notes)
SELECT 
  a.id as animal_id,
  a.farm_id,
  'deworming' as schedule_type,
  (ARRAY['Albendazole', 'Ivermectin', 'Fenbendazole', 'Levamisole'])[floor(random() * 4 + 1)] as treatment_name,
  (CURRENT_DATE - (random() * 90)::int) as scheduled_date,
  'completed' as status,
  'Quarterly deworming completed' as notes
FROM animals a
WHERE a.is_deleted = false AND a.exit_date IS NULL
ORDER BY random()
LIMIT 50;

-- Upcoming deworming
INSERT INTO preventive_health_schedules (animal_id, farm_id, schedule_type, treatment_name, scheduled_date, status, notes)
SELECT 
  a.id as animal_id,
  a.farm_id,
  'deworming' as schedule_type,
  (ARRAY['Albendazole', 'Ivermectin', 'Fenbendazole'])[floor(random() * 3 + 1)] as treatment_name,
  (CURRENT_DATE + (random() * 45 + 7)::int) as scheduled_date,
  'scheduled' as status,
  'Next quarterly treatment' as notes
FROM animals a
WHERE a.is_deleted = false AND a.exit_date IS NULL
ORDER BY random()
LIMIT 25;

-- 2. HEAT DETECTION RECORDS (~100 records for female animals)
INSERT INTO heat_records (animal_id, farm_id, detected_at, detection_method, intensity, standing_heat, optimal_breeding_start, optimal_breeding_end, notes)
SELECT 
  a.id as animal_id,
  a.farm_id,
  (CURRENT_TIMESTAMP - (random() * 90 * interval '1 day')) as detected_at,
  (ARRAY['visual_observation', 'activity_monitoring', 'mucus_discharge', 'mounting_behavior'])[floor(random() * 4 + 1)] as detection_method,
  (ARRAY['mild', 'moderate', 'strong'])[floor(random() * 3 + 1)] as intensity,
  random() > 0.3 as standing_heat,
  (CURRENT_TIMESTAMP - (random() * 90 * interval '1 day')) as optimal_breeding_start,
  (CURRENT_TIMESTAMP - (random() * 90 * interval '1 day') + interval '18 hours') as optimal_breeding_end,
  CASE 
    WHEN random() < 0.3 THEN 'Clear signs of estrus observed'
    WHEN random() < 0.5 THEN 'Increased activity and vocalization'
    WHEN random() < 0.7 THEN 'Standing heat confirmed'
    ELSE 'Routine monitoring detection'
  END as notes
FROM animals a
WHERE a.is_deleted = false 
  AND a.exit_date IS NULL
  AND LOWER(a.gender) = 'female'
ORDER BY random()
LIMIT 100;

-- 3. ANIMAL EXIT RECORDS (~30 animals marked as exited)
-- First, let's update some animals with exit data

-- Sold animals (60% - ~18 animals)
UPDATE animals
SET 
  exit_date = (CURRENT_DATE - (random() * 90)::int),
  exit_reason = 'sold',
  sale_price = (15000 + random() * 85000)::numeric(10,2),
  buyer_info = (ARRAY['Local trader', 'Auction buyer', 'Direct farm sale', 'Cooperative purchase', 'Export dealer'])[floor(random() * 5 + 1)],
  exit_notes = 'Sold at market price'
WHERE id IN (
  SELECT id FROM animals 
  WHERE is_deleted = false AND exit_date IS NULL
  ORDER BY random()
  LIMIT 18
);

-- Died animals (25% - ~8 animals)
UPDATE animals
SET 
  exit_date = (CURRENT_DATE - (random() * 90)::int),
  exit_reason = 'died',
  exit_reason_details = (ARRAY['Natural causes', 'Disease - respiratory', 'Disease - digestive', 'Accident', 'Unknown cause'])[floor(random() * 5 + 1)],
  exit_notes = 'Veterinary report filed'
WHERE id IN (
  SELECT id FROM animals 
  WHERE is_deleted = false AND exit_date IS NULL
  ORDER BY random()
  LIMIT 8
);

-- Culled animals (15% - ~4 animals)
UPDATE animals
SET 
  exit_date = (CURRENT_DATE - (random() * 90)::int),
  exit_reason = 'culled',
  exit_reason_details = (ARRAY['Low productivity', 'Chronic health issues', 'Reproductive failure', 'Age-related decline'])[floor(random() * 4 + 1)],
  exit_notes = 'Management decision based on performance'
WHERE id IN (
  SELECT id FROM animals 
  WHERE is_deleted = false AND exit_date IS NULL
  ORDER BY random()
  LIMIT 4
);

-- 4. SEMEN CODES ON AI RECORDS (update existing records with genetic source info)
-- Philippine DA-approved semen sources
UPDATE ai_records
SET semen_code = (ARRAY[
  'PCC-BULL-001', 'PCC-BULL-002', 'PCC-BULL-003',
  'DA-CAR-2024-A', 'DA-CAR-2024-B',
  'NAIC-ELITE-01', 'NAIC-ELITE-02',
  'BAI-BRAHMAN-01', 'BAI-BRAHMAN-02',
  'IMPORT-AUS-2024', 'IMPORT-NZ-2024'
])[floor(random() * 11 + 1)]
WHERE performed_date IS NOT NULL
  AND semen_code IS NULL;

-- Also add semen codes to scheduled AI records
UPDATE ai_records
SET semen_code = (ARRAY[
  'PCC-BULL-001', 'PCC-BULL-002',
  'DA-CAR-2024-A', 'DA-CAR-2024-B',
  'NAIC-ELITE-01', 'BAI-BRAHMAN-01'
])[floor(random() * 6 + 1)]
WHERE scheduled_date IS NOT NULL
  AND semen_code IS NULL
  AND random() < 0.7;
