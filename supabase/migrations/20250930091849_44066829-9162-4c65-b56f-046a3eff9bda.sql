-- Add parent relationship columns to animals table
ALTER TABLE public.animals 
ADD COLUMN mother_id uuid REFERENCES public.animals(id) ON DELETE SET NULL,
ADD COLUMN father_id uuid REFERENCES public.animals(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX idx_animals_mother_id ON public.animals(mother_id);
CREATE INDEX idx_animals_father_id ON public.animals(father_id);

-- Add a comment to document the relationships
COMMENT ON COLUMN public.animals.mother_id IS 'References the mother animal';
COMMENT ON COLUMN public.animals.father_id IS 'References the father animal';