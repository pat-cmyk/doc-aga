-- Add animal_id column to farm_expenses for tracking individual animal costs
ALTER TABLE public.farm_expenses 
ADD COLUMN IF NOT EXISTS animal_id UUID REFERENCES public.animals(id) ON DELETE SET NULL;

-- Create index for efficient animal expense queries
CREATE INDEX IF NOT EXISTS idx_farm_expenses_animal_id 
ON public.farm_expenses(animal_id) WHERE animal_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.farm_expenses.animal_id IS 'Optional link to specific animal for tracking individual animal costs';