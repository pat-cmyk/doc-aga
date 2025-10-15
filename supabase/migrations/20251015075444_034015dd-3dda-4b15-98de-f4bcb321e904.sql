-- Add weight_per_unit column to feed_inventory table
ALTER TABLE public.feed_inventory
ADD COLUMN weight_per_unit NUMERIC;