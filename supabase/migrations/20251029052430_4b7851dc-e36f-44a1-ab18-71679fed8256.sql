-- Comprehensive RLS Security Implementation (Fixed)
-- Adds Row-Level Security policies to profiles, notifications, doc_aga tables, and QA testing tables
-- Only includes tables that exist in the database

-- =====================================================
-- 1. PROFILES TABLE SECURITY
-- =====================================================

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "users_select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admins_select_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins_update_profiles" ON public.profiles;

-- Users can read their own profile
CREATE POLICY "users_select_own_profile" 
ON public.profiles 
FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_update_own_profile" 
ON public.profiles 
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "admins_select_all_profiles" 
ON public.profiles 
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can update any profile
CREATE POLICY "admins_update_profiles" 
ON public.profiles 
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

-- =====================================================
-- 2. NOTIFICATIONS TABLE SECURITY
-- =====================================================

-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
DROP POLICY IF EXISTS "users_select_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "system_insert_notifications" ON public.notifications;

-- Users can only see their own notifications
CREATE POLICY "users_select_own_notifications" 
ON public.notifications 
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "users_update_own_notifications" 
ON public.notifications 
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- System can insert notifications for any user (via service role)
CREATE POLICY "system_insert_notifications" 
ON public.notifications 
FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 3. DOC AGA TABLES SECURITY
-- =====================================================

-- Enable RLS on doc_aga_faqs table
ALTER TABLE public.doc_aga_faqs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "authenticated_read_faqs" ON public.doc_aga_faqs;
DROP POLICY IF EXISTS "admins_manage_faqs" ON public.doc_aga_faqs;

-- Authenticated users can read active FAQs
CREATE POLICY "authenticated_read_faqs" 
ON public.doc_aga_faqs 
FOR SELECT
USING (is_active = true);

-- Admins can manage all FAQs
CREATE POLICY "admins_manage_faqs" 
ON public.doc_aga_faqs 
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Enable RLS on doc_aga_queries table
ALTER TABLE public.doc_aga_queries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "queries_select" ON public.doc_aga_queries;
DROP POLICY IF EXISTS "queries_insert" ON public.doc_aga_queries;
DROP POLICY IF EXISTS "admins_view_all_queries" ON public.doc_aga_queries;
DROP POLICY IF EXISTS "users_view_own_queries" ON public.doc_aga_queries;
DROP POLICY IF EXISTS "farm_access_queries" ON public.doc_aga_queries;
DROP POLICY IF EXISTS "system_insert_queries" ON public.doc_aga_queries;

-- Users can view their own queries
CREATE POLICY "users_view_own_queries" 
ON public.doc_aga_queries 
FOR SELECT
USING (auth.uid() = user_id);

-- Farm members can view queries for their farms
CREATE POLICY "farm_access_queries" 
ON public.doc_aga_queries 
FOR SELECT
USING (
  farm_id IS NULL OR 
  can_access_farm(farm_id)
);

-- System can insert queries for authenticated users
CREATE POLICY "system_insert_queries" 
ON public.doc_aga_queries 
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all queries for oversight
CREATE POLICY "admins_view_all_queries" 
ON public.doc_aga_queries 
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- =====================================================
-- 4. QA TESTING TABLES SECURITY (test_runs and test_results only)
-- =====================================================

-- Enable RLS on test_runs table
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "admins_view_test_runs" ON public.test_runs;
DROP POLICY IF EXISTS "system_insert_test_runs" ON public.test_runs;

-- Only admins can view test runs
CREATE POLICY "admins_view_test_runs" 
ON public.test_runs 
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- System can insert test runs (via service role)
CREATE POLICY "system_insert_test_runs" 
ON public.test_runs 
FOR INSERT
WITH CHECK (true);

-- Enable RLS on test_results table
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "admins_view_test_results" ON public.test_results;
DROP POLICY IF EXISTS "system_insert_test_results" ON public.test_results;

-- Only admins can view test results
CREATE POLICY "admins_view_test_results" 
ON public.test_results 
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- System can insert test results (via service role)
CREATE POLICY "system_insert_test_results" 
ON public.test_results 
FOR INSERT
WITH CHECK (true);