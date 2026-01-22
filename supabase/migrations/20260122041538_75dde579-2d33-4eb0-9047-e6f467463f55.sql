-- Fix the overly permissive INSERT policy on audit log table
-- The RPC function uses SECURITY DEFINER so inserts happen as the function owner
-- We need to restrict inserts to only service-level operations

DROP POLICY IF EXISTS "service_insert_gov_analytics_audit" ON public.gov_analytics_access_audit_log;

-- Only allow inserts from authenticated users (the RPC function handles role verification)
CREATE POLICY "authenticated_insert_gov_analytics_audit"
ON public.gov_analytics_access_audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);