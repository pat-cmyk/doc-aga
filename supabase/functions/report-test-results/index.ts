import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(id: string, max: number, window: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(id);
  if (rateLimitMap.size > 10000) {
    const cutoff = now - window;
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.resetAt < cutoff) rateLimitMap.delete(key);
    }
  }
  if (!record || now > record.resetAt) {
    rateLimitMap.set(id, { count: 1, resetAt: now + window });
    return { allowed: true };
  }
  if (record.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  record.count++;
  return { allowed: true };
}

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

// Webhook signature verification
async function verifyWebhookSignature(body: string, signature: string | null): Promise<boolean> {
  if (!signature) {
    return false;
  }

  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret) {
    console.warn('[report-test-results] WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === expectedSignature;
  } catch (error) {
    console.error('[report-test-results] Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check rate limit
  const identifier = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'ci-cd';
  const rateCheck = checkRateLimit(identifier, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
  if (!rateCheck.allowed) {
    console.warn(`[report-test-results] Rate limit exceeded for: ${identifier}`);
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter || 60) }
    });
  }

  // Verify webhook signature
  const signature = req.headers.get('x-webhook-signature');
  const rawBody = await req.text();
  
  const isValid = await verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    console.error('[report-test-results] Invalid webhook signature');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TestReportPayload = JSON.parse(rawBody);
    
    console.log(`[report-test-results] Processing test results: ${payload.passed_tests}/${payload.total_tests} passed`)

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
      console.error('[report-test-results] Error inserting test run:', runError);
      throw runError;
    }

    console.log('[report-test-results] Created test run:', testRun.id);

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
        console.error('[report-test-results] Error inserting test results:', resultsError);
        throw resultsError;
      }

      console.log(`[report-test-results] Inserted ${testResultsData.length} test results`);
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
        console.error('[report-test-results] Error inserting coverage:', coverageError);
        throw coverageError;
      }

      console.log(`[report-test-results] Inserted ${coverageData.length} coverage reports`);
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
    console.error('[report-test-results] Error:', error);
    
    // Sanitize error - don't expose internal details
    let errorMessage = 'Failed to process test results';
    let statusCode = 500;
    
    if (error instanceof SyntaxError) {
      errorMessage = 'Invalid request format';
      statusCode = 400;
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
