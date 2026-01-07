-- =====================================================
-- FIX 15 RLS SECURITY WARNINGS
-- Remove overly permissive INSERT/UPDATE policies
-- =====================================================

-- 1. ad_impressions: Remove both permissive INSERT policies
--    (Edge functions use service_role which bypasses RLS)
DROP POLICY IF EXISTS "System can insert impressions" ON public.ad_impressions;
DROP POLICY IF EXISTS "System insert impressions" ON public.ad_impressions;

-- 2. admin_actions: Remove permissive INSERT policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_actions;

-- 3. coverage_reports: Remove permissive INSERT policy
DROP POLICY IF EXISTS "System can insert coverage" ON public.coverage_reports;

-- 4. daily_farm_stats: Remove permissive INSERT and UPDATE policies
DROP POLICY IF EXISTS "System can insert stats" ON public.daily_farm_stats;
DROP POLICY IF EXISTS "System can update stats" ON public.daily_farm_stats;

-- 5. monthly_farm_stats: Remove permissive INSERT and UPDATE policies
DROP POLICY IF EXISTS "System can insert stats" ON public.monthly_farm_stats;
DROP POLICY IF EXISTS "System can update stats" ON public.monthly_farm_stats;

-- 6. stt_analytics: Remove permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert STT analytics" ON public.stt_analytics;

-- 7. test_results: Remove both permissive INSERT policies (duplicates)
DROP POLICY IF EXISTS "System can insert test results" ON public.test_results;
DROP POLICY IF EXISTS "system_insert_test_results" ON public.test_results;

-- 8. test_runs: Remove both permissive INSERT policies (duplicates)
DROP POLICY IF EXISTS "System can insert test runs" ON public.test_runs;
DROP POLICY IF EXISTS "system_insert_test_runs" ON public.test_runs;

-- 9. user_activity_logs: Remove permissive INSERT policy
DROP POLICY IF EXISTS "System can insert activity logs" ON public.user_activity_logs;

-- 10. notifications: Replace permissive INSERT with user-scoped INSERT
DROP POLICY IF EXISTS "system_insert_notifications" ON public.notifications;

-- Create secure INSERT policy for notifications
-- Users can only insert notifications for themselves
CREATE POLICY "users_insert_own_notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);