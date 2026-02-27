-- Step 1: Add feed columns as nullable with defaults
-- Use DO block to handle IF NOT EXISTS properly
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_farm_stats' AND column_name = 'total_feed_kg') THEN
    ALTER TABLE public.daily_farm_stats ADD COLUMN total_feed_kg NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_farm_stats' AND column_name = 'feed_animal_count') THEN
    ALTER TABLE public.daily_farm_stats ADD COLUMN feed_animal_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Ensure all existing rows have non-null values
UPDATE public.daily_farm_stats SET total_feed_kg = 0 WHERE total_feed_kg IS NULL;
UPDATE public.daily_farm_stats SET feed_animal_count = 0 WHERE feed_animal_count IS NULL;

-- Now enforce NOT NULL
ALTER TABLE public.daily_farm_stats ALTER COLUMN total_feed_kg SET NOT NULL;
ALTER TABLE public.daily_farm_stats ALTER COLUMN total_feed_kg SET DEFAULT 0;
ALTER TABLE public.daily_farm_stats ALTER COLUMN feed_animal_count SET NOT NULL;
ALTER TABLE public.daily_farm_stats ALTER COLUMN feed_animal_count SET DEFAULT 0;