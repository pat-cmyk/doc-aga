-- Remove duplicate foreign keys pointing to auth.users
-- This fixes the PostgREST relationship resolution issue
ALTER TABLE public.pending_activities 
DROP CONSTRAINT IF EXISTS pending_activities_submitted_by_fkey;

ALTER TABLE public.pending_activities 
DROP CONSTRAINT IF EXISTS pending_activities_reviewed_by_fkey;