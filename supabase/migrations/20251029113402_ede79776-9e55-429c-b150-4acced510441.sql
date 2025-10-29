-- Allow new users to receive their default role during signup
CREATE POLICY "system_insert_default_role" 
ON public.user_roles 
FOR INSERT
WITH CHECK (auth.uid() = user_id);