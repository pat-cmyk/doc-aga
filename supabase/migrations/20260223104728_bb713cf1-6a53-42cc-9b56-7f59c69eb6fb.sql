
-- =============================================
-- Barn / Paddock Grouping System
-- =============================================

-- 1. Create barns table
CREATE TABLE public.barns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  barn_type TEXT NOT NULL DEFAULT 'barn',
  capacity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create barn_assignments table
CREATE TABLE public.barn_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barn_id UUID NOT NULL REFERENCES public.barns(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES public.animals(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  assigned_by UUID,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE
);

-- Unique constraint: one active assignment per animal
CREATE UNIQUE INDEX idx_barn_assignments_active_animal
  ON public.barn_assignments (animal_id)
  WHERE removed_at IS NULL;

-- Index for querying barn members
CREATE INDEX idx_barn_assignments_barn_active
  ON public.barn_assignments (barn_id)
  WHERE removed_at IS NULL;

-- Index for farm-scoped queries
CREATE INDEX idx_barns_farm_id ON public.barns (farm_id);
CREATE INDEX idx_barn_assignments_farm_id ON public.barn_assignments (farm_id);

-- 3. Add current_barn_id to animals
ALTER TABLE public.animals
  ADD COLUMN current_barn_id UUID REFERENCES public.barns(id) ON DELETE SET NULL;

CREATE INDEX idx_animals_current_barn ON public.animals (current_barn_id) WHERE current_barn_id IS NOT NULL;

-- 4. Trigger: auto-close old assignment when inserting a new one for same animal
CREATE OR REPLACE FUNCTION public.handle_barn_assignment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Close any existing active assignment for this animal
  UPDATE public.barn_assignments
  SET removed_at = now()
  WHERE animal_id = NEW.animal_id
    AND removed_at IS NULL
    AND id != NEW.id;

  -- Update denormalized current_barn_id on animals
  UPDATE public.animals
  SET current_barn_id = NEW.barn_id
  WHERE id = NEW.animal_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_barn_assignment_insert
  AFTER INSERT ON public.barn_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_barn_assignment_insert();

-- 5. Trigger: clear current_barn_id when assignment is removed (removed_at set)
CREATE OR REPLACE FUNCTION public.handle_barn_assignment_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when removed_at changes from NULL to a value
  IF OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL THEN
    -- Check if there's still an active assignment (from reassignment trigger)
    IF NOT EXISTS (
      SELECT 1 FROM public.barn_assignments
      WHERE animal_id = NEW.animal_id AND removed_at IS NULL
    ) THEN
      UPDATE public.animals
      SET current_barn_id = NULL
      WHERE id = NEW.animal_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_barn_assignment_removal
  AFTER UPDATE ON public.barn_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_barn_assignment_removal();

-- 6. Security definer function to check farm membership (reuse existing pattern)
-- Using existing is_farm_member pattern for RLS

-- 7. RLS for barns
ALTER TABLE public.barns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm members can view barns"
  ON public.barns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.farm_memberships
      WHERE farm_memberships.farm_id = barns.farm_id
        AND farm_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Farm members can create barns"
  ON public.barns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farm_memberships
      WHERE farm_memberships.farm_id = barns.farm_id
        AND farm_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Farm members can update barns"
  ON public.barns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.farm_memberships
      WHERE farm_memberships.farm_id = barns.farm_id
        AND farm_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Farm members can delete barns"
  ON public.barns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.farm_memberships
      WHERE farm_memberships.farm_id = barns.farm_id
        AND farm_memberships.user_id = auth.uid()
    )
  );

-- 8. RLS for barn_assignments
ALTER TABLE public.barn_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farm members can view barn assignments"
  ON public.barn_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.farm_memberships
      WHERE farm_memberships.farm_id = barn_assignments.farm_id
        AND farm_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Farm members can create barn assignments"
  ON public.barn_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.farm_memberships
      WHERE farm_memberships.farm_id = barn_assignments.farm_id
        AND farm_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Farm members can update barn assignments"
  ON public.barn_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.farm_memberships
      WHERE farm_memberships.farm_id = barn_assignments.farm_id
        AND farm_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Farm members can delete barn assignments"
  ON public.barn_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.farm_memberships
      WHERE farm_memberships.farm_id = barn_assignments.farm_id
        AND farm_memberships.user_id = auth.uid()
    )
  );
