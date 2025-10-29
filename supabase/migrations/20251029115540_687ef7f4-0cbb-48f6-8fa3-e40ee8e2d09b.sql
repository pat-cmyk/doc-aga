-- Fix signup failure: update handle_new_user to not insert into non-existent profiles.role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile without 'role' column (roles are managed in user_roles)
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  -- Assign default role via user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'farmer_owner'::user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Ensure RLS is enabled on profiles (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add self-insert policy for profiles if it doesn't exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_self_insert'
  ) THEN
    CREATE POLICY "profiles_self_insert"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;