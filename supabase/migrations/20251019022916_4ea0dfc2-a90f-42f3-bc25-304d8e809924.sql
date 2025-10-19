-- Create test_runs table to store test execution sessions
CREATE TABLE IF NOT EXISTS public.test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  branch TEXT NOT NULL,
  commit_hash TEXT,
  total_tests INTEGER NOT NULL,
  passed_tests INTEGER NOT NULL,
  failed_tests INTEGER NOT NULL,
  skipped_tests INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  coverage_percentage NUMERIC(5,2),
  triggered_by TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'passed', 'failed', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_runs_date ON public.test_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON public.test_runs(status);

-- Enable RLS
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view test runs
CREATE POLICY "Admins can view test runs"
  ON public.test_runs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Create test_results table to store individual test case results
CREATE TABLE IF NOT EXISTS public.test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  suite_name TEXT NOT NULL,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped')),
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_results_run ON public.test_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON public.test_results(status);
CREATE INDEX IF NOT EXISTS idx_test_results_suite ON public.test_results(suite_name);

-- Enable RLS
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view test results
CREATE POLICY "Admins can view test results"
  ON public.test_results FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Create coverage_reports table to store code coverage metrics
CREATE TABLE IF NOT EXISTS public.coverage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  lines_covered INTEGER NOT NULL,
  lines_total INTEGER NOT NULL,
  branches_covered INTEGER NOT NULL,
  branches_total INTEGER NOT NULL,
  functions_covered INTEGER NOT NULL,
  functions_total INTEGER NOT NULL,
  coverage_percentage NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coverage_run ON public.coverage_reports(test_run_id);
CREATE INDEX IF NOT EXISTS idx_coverage_file ON public.coverage_reports(file_path);

-- Enable RLS
ALTER TABLE public.coverage_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view coverage reports
CREATE POLICY "Admins can view coverage"
  ON public.coverage_reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow system (service role) to insert data into all tables
CREATE POLICY "System can insert test runs"
  ON public.test_runs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can insert test results"
  ON public.test_results FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can insert coverage"
  ON public.coverage_reports FOR INSERT
  WITH CHECK (true);