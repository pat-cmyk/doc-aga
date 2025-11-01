-- Allow admins to view all farms
CREATE POLICY "admins_view_all_farms" ON public.farms
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));