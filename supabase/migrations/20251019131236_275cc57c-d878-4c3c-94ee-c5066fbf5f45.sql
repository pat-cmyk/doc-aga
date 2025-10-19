-- Step 1: Add missing role for existing user (farmer@example.com)
INSERT INTO public.user_roles (user_id, role)
VALUES ('c8514ae7-f603-415e-8603-039515f7189e', 'farmer_owner')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 2: Fix the handle_new_user() trigger to insert into both tables
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (
    new.id, 
    'farmer_owner', 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email
  );
  
  -- Insert into user_roles table with the default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'farmer_owner')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN new;
END;
$$;