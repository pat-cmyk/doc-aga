-- Fix doc_aga_queries RLS: Remove overly permissive farm_access_queries policy
-- Users should only see their own queries, admins and government can see all

-- Drop the overly permissive policy that allows all farm members to see queries
DROP POLICY IF EXISTS "farm_access_queries" ON public.doc_aga_queries;

-- Add government access policy (admins already have access via admins_view_all_queries)
CREATE POLICY "government_view_all_queries" ON public.doc_aga_queries
FOR SELECT USING (has_role(auth.uid(), 'government'::user_role));