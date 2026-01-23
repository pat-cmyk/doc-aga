-- Drop the duplicate function with TEXT parameters (old signature)
-- Keep only the DATE parameter version
DROP FUNCTION IF EXISTS public.get_combined_dashboard_data(uuid, text, text, text, text);