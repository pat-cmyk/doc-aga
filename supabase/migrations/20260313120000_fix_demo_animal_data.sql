-- Migration: Fix Demo Farm Animal Data
--
-- Audit of Estehanon Farm (demo) revealed pervasive data inconsistencies:
-- - 6 animals lactating with parity 0 (impossible — must have calved to lactate)
-- - 7 animals missing birth_date → life stages never recalculated by daily cron
-- - fertility_status stuck at 'not_eligible' because seed-demo-data creates
--   ai_records without breeding_events (so the update_animal_fertility_status
--   trigger never fires)
-- - Tsibato (goat G001) recorded as 10.5 months old but lactating
--
-- Strategy:
-- 1. Backfill birth_dates for 7 animals missing them
-- 2. Fix Tsibato's birth_date (was too young to have calved)
-- 3. Create phantom offspring for each lactating parity-0 mother
--    (offspring count drives life stage calculation)
-- 4. Insert calving + vwp_ended breeding_events for each lactating mother
--    (trigger auto-updates parity, fertility_status, last_calving_date)
-- 5. Fix remaining fertility_status issues
-- 6. Fix Mang Flora's life stage (28mo stuck at Yearling Heifer)

-- Use a DO block so we can use variables for the farm_id
DO $$
DECLARE
  v_farm_id uuid := '0ffc89c8-152d-42a3-a0f5-67cf772860cc';
  v_animal_id uuid;
  v_offspring_id uuid;
BEGIN

  -- ============================================
  -- STEP 1: Backfill / fix birth_dates
  -- ============================================

  -- Tsibato (G001, goat): Was 2025-04-30 (10.5mo, too young to calve)
  -- Change to 2023-09-01 (~30 months, realistic for a lactating doe)
  UPDATE animals SET birth_date = '2023-09-01'
  WHERE unique_code = 'G001' AND farm_id = v_farm_id;

  -- Tita Barbecue (C0001, cattle): No birth_date → set ~44mo (mature cow)
  UPDATE animals SET birth_date = '2022-07-15'
  WHERE unique_code = 'C0001' AND farm_id = v_farm_id;

  -- G002 (goat): No birth_date → set ~29mo (mature doe)
  UPDATE animals SET birth_date = '2023-10-01'
  WHERE unique_code = 'G002' AND farm_id = v_farm_id;

  -- Bessie (A002, cattle): No birth_date → set ~48mo (mature cow)
  UPDATE animals SET birth_date = '2022-03-15'
  WHERE unique_code = 'A002' AND farm_id = v_farm_id;

  -- 0029 (cattle): No birth_date → set ~21mo (breeding heifer, no offspring)
  UPDATE animals SET birth_date = '2024-06-01'
  WHERE unique_code = '0029' AND farm_id = v_farm_id;

  -- 2722 (cattle): No birth_date → set ~42mo (mature cow)
  UPDATE animals SET birth_date = '2022-09-15'
  WHERE unique_code = '2722' AND farm_id = v_farm_id;

  -- Bibingka (C0004, cattle): No birth_date → set ~44mo (mature cow)
  UPDATE animals SET birth_date = '2022-07-01'
  WHERE unique_code = 'C0004' AND farm_id = v_farm_id;

  -- ============================================
  -- STEP 2: Create phantom offspring for lactating parity-0 mothers
  -- Each lactating animal must have at least 1 offspring for life stage calc.
  -- Offspring birth_date = the calving date (3-4 months ago).
  -- ============================================

  -- Tsibato (G001, goat) → offspring born Dec 1 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'G001' AND farm_id = v_farm_id;
  INSERT INTO animals (farm_id, livestock_type, gender, birth_date, mother_id, name, breed)
  VALUES (v_farm_id, 'goat', 'Female', '2025-12-01', v_animal_id, 'Kid of Tsibato', null)
  RETURNING id INTO v_offspring_id;

  -- Tita Barbecue (C0001, cattle) → offspring born Dec 15 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'C0001' AND farm_id = v_farm_id;
  INSERT INTO animals (farm_id, livestock_type, gender, birth_date, mother_id, name, breed)
  VALUES (v_farm_id, 'cattle', 'Female', '2025-12-15', v_animal_id, 'Calf of Tita Barbecue', null)
  RETURNING id INTO v_offspring_id;

  -- G002 (goat) → offspring born Nov 20 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'G002' AND farm_id = v_farm_id;
  INSERT INTO animals (farm_id, livestock_type, gender, birth_date, mother_id, name, breed)
  VALUES (v_farm_id, 'goat', 'Female', '2025-11-20', v_animal_id, 'Kid of G002', null)
  RETURNING id INTO v_offspring_id;

  -- Bessie (A002, cattle) → offspring born Dec 10 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'A002' AND farm_id = v_farm_id;
  INSERT INTO animals (farm_id, livestock_type, gender, birth_date, mother_id, name, breed)
  VALUES (v_farm_id, 'cattle', 'Female', '2025-12-10', v_animal_id, 'Calf of Bessie', null)
  RETURNING id INTO v_offspring_id;

  -- 2722 (cattle) → offspring born Dec 5 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = '2722' AND farm_id = v_farm_id;
  INSERT INTO animals (farm_id, livestock_type, gender, birth_date, mother_id, name, breed)
  VALUES (v_farm_id, 'cattle', 'Female', '2025-12-05', v_animal_id, 'Calf of 2722', null)
  RETURNING id INTO v_offspring_id;

  -- Bibingka (C0004, cattle) → offspring born Nov 15 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'C0004' AND farm_id = v_farm_id;
  INSERT INTO animals (farm_id, livestock_type, gender, birth_date, mother_id, name, breed)
  VALUES (v_farm_id, 'cattle', 'Female', '2025-11-15', v_animal_id, 'Calf of Bibingka', null)
  RETURNING id INTO v_offspring_id;

  -- ============================================
  -- STEP 3: Insert calving breeding_events for each lactating mother
  -- Trigger auto-sets: fertility_status → fresh_postpartum, parity += 1,
  --   last_calving_date, voluntary_waiting_end_date
  -- ============================================

  -- Tsibato (G001, goat): calving Dec 1 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'G001' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'calving', '2025-12-01T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- Tita Barbecue (C0001, cattle): calving Dec 15 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'C0001' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'calving', '2025-12-15T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- G002 (goat): calving Nov 20 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'G002' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'calving', '2025-11-20T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- Bessie (A002, cattle): calving Dec 10 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'A002' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'calving', '2025-12-10T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- 2722 (cattle): calving Dec 5 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = '2722' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'calving', '2025-12-05T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- Bibingka (C0004, cattle): calving Nov 15 2025
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'C0004' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'calving', '2025-11-15T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- ============================================
  -- STEP 4: Insert vwp_ended breeding_events to transition to open_cycling
  -- VWP: cattle = 60 days, goat = 45 days (from species_specific_vwp migration)
  -- ============================================

  -- Tsibato (G001, goat): VWP ended = Dec 1 + 45 days = Jan 15 2026
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'G001' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'vwp_ended', '2026-01-15T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- Tita Barbecue (C0001, cattle): VWP ended = Dec 15 + 60 = Feb 13 2026
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'C0001' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'vwp_ended', '2026-02-13T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- G002 (goat): VWP ended = Nov 20 + 45 = Jan 4 2026
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'G002' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'vwp_ended', '2026-01-04T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- Bessie (A002, cattle): VWP ended = Dec 10 + 60 = Feb 8 2026
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'A002' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'vwp_ended', '2026-02-08T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- 2722 (cattle): VWP ended = Dec 5 + 60 = Feb 3 2026
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = '2722' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'vwp_ended', '2026-02-03T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- Bibingka (C0004, cattle): VWP ended = Nov 15 + 60 = Jan 14 2026
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'C0004' AND farm_id = v_farm_id;
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'vwp_ended', '2026-01-14T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- ============================================
  -- STEP 5: Fix remaining animals
  -- ============================================

  -- 0029 (cattle): fertility_status stuck at in_heat but has no breeding history.
  -- She's a 21-month Breeding Heifer ready for breeding. Set to open_cycling.
  UPDATE animals SET fertility_status = 'open_cycling'
  WHERE unique_code = '0029' AND farm_id = v_farm_id;

  -- NDA 123 (cattle, 25.5mo): fertility_status stuck at not_eligible.
  -- She's well past breeding age (15mo for cattle). Set to open_cycling.
  UPDATE animals SET fertility_status = 'open_cycling'
  WHERE unique_code = 'NDA 123' AND farm_id = v_farm_id;

  -- Mang Flora (C0002, cattle, 28mo): life_stage stuck at Yearling Heifer.
  -- She's confirmed_pregnant with active AI. Correct life_stage = Pregnant Heifer.
  -- The daily cron will recalculate this from birth_date, but let's fix it now.
  UPDATE animals SET life_stage = 'Pregnant Heifer'
  WHERE unique_code = 'C0002' AND farm_id = v_farm_id;

  -- Also insert breeding_events for Mang Flora's confirmed pregnancy
  -- (AI record exists with pregnancy_confirmed=true but no breeding_events)
  SELECT id INTO v_animal_id FROM animals WHERE unique_code = 'C0002' AND farm_id = v_farm_id;

  -- Heat detected ~70 days before now (late Jan 2026)
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'heat_detected', '2026-01-02T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- AI performed a few days later
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'ai_performed', '2026-01-04T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- Non-return at 21 days
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'non_return', '2026-01-25T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

  -- Pregnancy confirmed at 60 days
  INSERT INTO breeding_events (animal_id, farm_id, event_type, event_date, notes)
  VALUES (v_animal_id, v_farm_id, 'pregnancy_confirmed', '2026-03-05T08:00:00+08:00',
          'Backfilled: data consistency fix for demo farm');

END $$;
