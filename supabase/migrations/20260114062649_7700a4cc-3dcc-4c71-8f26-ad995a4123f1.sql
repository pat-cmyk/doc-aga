-- Create daily farm checklists table
CREATE TABLE public.daily_farm_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  checklist_date DATE NOT NULL,
  completed_items JSONB NOT NULL DEFAULT '{}',
  completed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(farm_id, checklist_date)
);

-- Enable Row Level Security
ALTER TABLE public.daily_farm_checklists ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Farm members can view checklists"
  ON public.daily_farm_checklists
  FOR SELECT
  USING (can_access_farm(farm_id));

CREATE POLICY "Farm members can insert checklists"
  ON public.daily_farm_checklists
  FOR INSERT
  WITH CHECK (
    is_farm_owner(auth.uid(), farm_id) OR 
    is_farm_manager(auth.uid(), farm_id) OR 
    is_farmhand(auth.uid(), farm_id)
  );

CREATE POLICY "Farm members can update checklists"
  ON public.daily_farm_checklists
  FOR UPDATE
  USING (
    is_farm_owner(auth.uid(), farm_id) OR 
    is_farm_manager(auth.uid(), farm_id) OR 
    is_farmhand(auth.uid(), farm_id)
  );

-- Government can view all checklists
CREATE POLICY "Government can view all checklists"
  ON public.daily_farm_checklists
  FOR SELECT
  USING (has_role(auth.uid(), 'government'::user_role));

-- Create updated_at trigger
CREATE TRIGGER update_daily_farm_checklists_updated_at
  BEFORE UPDATE ON public.daily_farm_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();