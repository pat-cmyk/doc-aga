-- Create function to safely create a default farm for the authenticated user
create or replace function public.create_default_farm(
  _name text default 'My Farm',
  _region text default 'Not specified'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _farm_id uuid;
begin
  -- Ensure user is authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Create farm owned by the current user
  insert into public.farms (name, owner_id, gps_lat, gps_lng, region)
  values (_name, auth.uid(), 0, 0, _region)
  returning id into _farm_id;

  -- Also add farm membership for owner (idempotent behavior handled by unique constraints if any)
  insert into public.farm_memberships (farm_id, user_id, role_in_farm)
  values (_farm_id, auth.uid(), 'farmer_owner')
  on conflict do nothing;

  return _farm_id;
end;
$$;

-- Allow authenticated users to execute the function
grant execute on function public.create_default_farm(text, text) to authenticated;