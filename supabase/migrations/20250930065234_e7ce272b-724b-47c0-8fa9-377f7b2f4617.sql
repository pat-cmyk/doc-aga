-- Fix search_path for existing security definer functions

-- Update can_access_farm function
CREATE OR REPLACE FUNCTION public.can_access_farm(fid uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  select exists(
    select 1
    from public.farms f
    left join public.farm_memberships fm on fm.farm_id = f.id and fm.user_id = auth.uid()
    where f.id = fid and (f.owner_id = auth.uid() or fm.user_id = auth.uid())
  );
$$;

-- Update handle_timestamp function
CREATE OR REPLACE FUNCTION public.handle_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'farmer_owner', coalesce(new.raw_user_meta_data->>'full_name', 'New User'));
  return new;
end $$;