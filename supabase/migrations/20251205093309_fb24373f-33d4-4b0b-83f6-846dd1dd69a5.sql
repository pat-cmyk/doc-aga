-- Add RLS policies for government users to view analytics data

-- Policy: Government users can view all farms for analytics
CREATE POLICY "government_view_farms" ON public.farms
FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- Policy: Government users can view all animals for aggregate statistics
CREATE POLICY "government_view_animals" ON public.animals
FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));

-- Policy: Government users can view health records for health event analytics
CREATE POLICY "government_view_health_records" ON public.health_records
FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));