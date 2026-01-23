-- Phase 1: Add missing columns to feed_inventory
ALTER TABLE public.feed_inventory 
ADD COLUMN IF NOT EXISTS purchase_date DATE,
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add check constraint for category
ALTER TABLE public.feed_inventory 
ADD CONSTRAINT feed_inventory_category_check 
CHECK (category IS NULL OR category IN ('concentrates', 'roughage', 'minerals', 'supplements'));

-- Phase 2: Add foreign key and cost tracking to feeding_records
ALTER TABLE public.feeding_records 
ADD COLUMN IF NOT EXISTS feed_inventory_id UUID REFERENCES public.feed_inventory(id),
ADD COLUMN IF NOT EXISTS cost_per_kg_at_time NUMERIC;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_feeding_records_feed_inventory_id 
ON public.feeding_records(feed_inventory_id);

CREATE INDEX IF NOT EXISTS idx_feed_inventory_expiry_date 
ON public.feed_inventory(expiry_date) 
WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feed_inventory_category 
ON public.feed_inventory(category);

-- Phase 3: Backfill category column for existing data
UPDATE public.feed_inventory SET category = 
  CASE 
    WHEN LOWER(feed_type) SIMILAR TO '%(mineral|vitamin|premix|salt|dicalcium|calcium)%' 
      THEN 'minerals'
    WHEN LOWER(feed_type) SIMILAR TO '%(concentrate|bran|corn|pellet|grower|urea|molasses|dairy meal|maize germ|cotton seed|sunflower|soya|wheat|barley|oat)%' 
      THEN 'concentrates'
    WHEN LOWER(feed_type) SIMILAR TO '%(supplement|additive|probiotic|enzyme)%' 
      THEN 'supplements'
    ELSE 'roughage'
  END
WHERE category IS NULL;