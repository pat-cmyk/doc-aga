-- Create dedicated milk inventory table for offline-first partial sales
CREATE TABLE public.milk_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  milking_record_id UUID NOT NULL UNIQUE REFERENCES public.milking_records(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  liters_original NUMERIC(10,2) NOT NULL,
  liters_remaining NUMERIC(10,2) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  client_generated_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_milk_inventory_farm_available ON public.milk_inventory(farm_id, is_available);
CREATE INDEX idx_milk_inventory_record_date ON public.milk_inventory(record_date);
CREATE INDEX idx_milk_inventory_client_id ON public.milk_inventory(client_generated_id) WHERE client_generated_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.milk_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policy using existing can_access_farm function
CREATE POLICY "Users can access their farm's inventory"
  ON public.milk_inventory
  FOR ALL
  TO authenticated
  USING (can_access_farm(farm_id));

-- Auto-update updated_at trigger
CREATE TRIGGER update_milk_inventory_updated_at
  BEFORE UPDATE ON public.milk_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to sync inventory on milking record insert
CREATE OR REPLACE FUNCTION sync_milk_inventory_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.milk_inventory (
    farm_id, animal_id, milking_record_id, record_date,
    liters_original, liters_remaining, is_available, client_generated_id
  )
  SELECT 
    a.farm_id,
    NEW.animal_id,
    NEW.id,
    NEW.record_date,
    NEW.liters,
    NEW.liters,
    NOT COALESCE(NEW.is_sold, false),
    NEW.client_generated_id
  FROM animals a WHERE a.id = NEW.animal_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_milk_inventory_insert
  AFTER INSERT ON public.milking_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_milk_inventory_on_insert();

-- Function to sync inventory on milking record update
CREATE OR REPLACE FUNCTION sync_milk_inventory_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If is_sold changed to true, mark inventory unavailable
  IF NEW.is_sold = true AND (OLD.is_sold = false OR OLD.is_sold IS NULL) THEN
    UPDATE public.milk_inventory
    SET is_available = false, 
        liters_remaining = 0,
        updated_at = now()
    WHERE milking_record_id = NEW.id;
  END IF;
  
  -- If liters changed, update inventory
  IF NEW.liters != OLD.liters THEN
    UPDATE public.milk_inventory
    SET liters_original = NEW.liters,
        liters_remaining = GREATEST(0, liters_remaining + (NEW.liters - OLD.liters)),
        updated_at = now()
    WHERE milking_record_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_milk_inventory_update
  AFTER UPDATE ON public.milking_records
  FOR EACH ROW
  EXECUTE FUNCTION sync_milk_inventory_on_update();

-- Backfill existing unsold milk records into inventory
INSERT INTO public.milk_inventory (
  farm_id, animal_id, milking_record_id, record_date,
  liters_original, liters_remaining, is_available, client_generated_id
)
SELECT 
  a.farm_id,
  mr.animal_id,
  mr.id,
  mr.record_date,
  mr.liters,
  mr.liters,
  true,
  mr.client_generated_id
FROM milking_records mr
JOIN animals a ON a.id = mr.animal_id
WHERE mr.is_sold = false OR mr.is_sold IS NULL;