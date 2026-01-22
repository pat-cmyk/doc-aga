-- Add bank-required fields to farms table
ALTER TABLE farms 
ADD COLUMN IF NOT EXISTS biosecurity_level text,
ADD COLUMN IF NOT EXISTS water_source text,
ADD COLUMN IF NOT EXISTS distance_to_market_km numeric,
ADD COLUMN IF NOT EXISTS pcic_enrolled boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN farms.biosecurity_level IS 'Biosecurity level: basic, standard, or advanced';
COMMENT ON COLUMN farms.water_source IS 'Primary water source: deep_well, spring, municipal, rainwater, river';
COMMENT ON COLUMN farms.distance_to_market_km IS 'Distance to nearest livestock market in kilometers';
COMMENT ON COLUMN farms.pcic_enrolled IS 'Whether farm is enrolled in PCIC livestock insurance';