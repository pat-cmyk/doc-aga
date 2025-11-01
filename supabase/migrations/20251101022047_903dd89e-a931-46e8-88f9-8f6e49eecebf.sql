-- Step 1: Create admin actions audit table
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on admin_actions
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_actions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- System/backends can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.admin_actions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 2: Create trigger function to prevent multi-row DELETE on farms
CREATE OR REPLACE FUNCTION public.prevent_multirow_farms_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Count how many rows were deleted
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  IF deleted_count > 1 THEN
    RAISE EXCEPTION 'Bulk deletion of farms is not allowed. Only one farm can be deleted at a time. Attempted to delete % farms.', deleted_count;
  END IF;
  
  RETURN NULL; -- For AFTER trigger
END;
$$;

-- Create AFTER DELETE trigger on farms
DROP TRIGGER IF EXISTS trg_prevent_multirow_farms_delete ON public.farms;
CREATE TRIGGER trg_prevent_multirow_farms_delete
AFTER DELETE ON public.farms
REFERENCING OLD TABLE AS deleted
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_multirow_farms_delete();

-- Step 3: Create trigger function to prevent multi-row soft-delete (is_deleted update)
CREATE OR REPLACE FUNCTION public.prevent_multirow_farms_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count integer;
BEGIN
  -- Count how many rows had is_deleted changed
  SELECT COUNT(*) INTO changed_count
  FROM new_rows n
  JOIN old_rows o ON n.id = o.id
  WHERE n.is_deleted IS DISTINCT FROM o.is_deleted;
  
  -- Only raise exception if is_deleted was actually changed for multiple rows
  IF changed_count > 1 THEN
    RAISE EXCEPTION 'Bulk soft-deletion of farms is not allowed. Only one farm can be deactivated at a time. Attempted to change % farms.', changed_count;
  END IF;
  
  RETURN NULL; -- For AFTER trigger
END;
$$;

-- Create AFTER UPDATE trigger on farms (without column list to allow transition tables)
DROP TRIGGER IF EXISTS trg_prevent_multirow_farms_update_is_deleted ON public.farms;
CREATE TRIGGER trg_prevent_multirow_farms_update_is_deleted
AFTER UPDATE ON public.farms
REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_multirow_farms_soft_delete();

-- Step 4: Update RLS policies - Remove direct DELETE, keep UPDATE for soft-delete
DROP POLICY IF EXISTS "farms_delete" ON public.farms;

-- Ensure farms_update policy allows owners and admins to update (including is_deleted)
DROP POLICY IF EXISTS "farms_update" ON public.farms;
CREATE POLICY "farms_update"
ON public.farms
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid() 
  OR is_farm_manager_only(auth.uid(), id)
  OR has_role(auth.uid(), 'admin'::user_role)
);