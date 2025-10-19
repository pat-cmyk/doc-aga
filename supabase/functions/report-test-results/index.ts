import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  suite_name: string;
  test_name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration_ms: number;
  error_message?: string;
  stack_trace?: string;
  file_path?: string;
}

interface CoverageReport {
  file_path: string;
  lines_covered: number;
  lines_total: number;
  branches_covered?: number;
  branches_total?: number;
  functions_covered?: number;
  functions_total?: number;
  coverage_percentage: number;
}

interface TestReportPayload {
  branch: string;
  commit_hash?: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  duration_ms: number;
  coverage_percentage?: number;
  triggered_by?: string;
  test_results: TestResult[];
  coverage?: CoverageReport[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const payload: TestReportPayload = await req.json();

    console.log('Received test report:', {
      branch: payload.branch,
      total_tests: payload.total_tests,
      passed: payload.passed_tests,
      failed: payload.failed_tests,
    });

    // Determine status
    let status: 'passed' | 'failed' | 'error' = 'passed';
    if (payload.failed_tests > 0) {
      status = 'failed';
    }

    // Insert test run
    const { data: testRun, error: runError } = await supabase
      .from('test_runs')
      .insert({
        branch: payload.branch,
        commit_hash: payload.commit_hash,
        total_tests: payload.total_tests,
        passed_tests: payload.passed_tests,
        failed_tests: payload.failed_tests,
        skipped_tests: payload.skipped_tests,
        duration_ms: payload.duration_ms,
        coverage_percentage: payload.coverage_percentage,
        triggered_by: payload.triggered_by || 'manual',
        status,
      })
      .select()
      .single();

    if (runError) {
      console.error('Error inserting test run:', runError);
      throw runError;
    }

    console.log('Created test run:', testRun.id);

    // Insert test results
    if (payload.test_results && payload.test_results.length > 0) {
      const testResultsData = payload.test_results.map(result => ({
        test_run_id: testRun.id,
        suite_name: result.suite_name,
        test_name: result.test_name,
        status: result.status,
        duration_ms: result.duration_ms,
        error_message: result.error_message,
        stack_trace: result.stack_trace,
        file_path: result.file_path,
      }));

      const { error: resultsError } = await supabase
        .from('test_results')
        .insert(testResultsData);

      if (resultsError) {
        console.error('Error inserting test results:', resultsError);
        throw resultsError;
      }

      console.log(`Inserted ${testResultsData.length} test results`);
    }

    // Insert coverage reports
    if (payload.coverage && payload.coverage.length > 0) {
      const coverageData = payload.coverage.map(report => ({
        test_run_id: testRun.id,
        file_path: report.file_path,
        lines_covered: report.lines_covered,
        lines_total: report.lines_total,
        branches_covered: report.branches_covered || 0,
        branches_total: report.branches_total || 0,
        functions_covered: report.functions_covered || 0,
        functions_total: report.functions_total || 0,
        coverage_percentage: report.coverage_percentage,
      }));

      const { error: coverageError } = await supabase
        .from('coverage_reports')
        .insert(coverageData);

      if (coverageError) {
        console.error('Error inserting coverage:', coverageError);
        throw coverageError;
      }

      console.log(`Inserted ${coverageData.length} coverage reports`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        test_run_id: testRun.id,
        message: 'Test results recorded successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error processing test report:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
