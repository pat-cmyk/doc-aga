#!/usr/bin/env node

/**
 * Test Results Reporter
 * Sends Vitest test results and coverage to the QA Dashboard
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const BRANCH = process.env.GITHUB_REF?.replace('refs/heads/', '') || 'local';
const COMMIT_HASH = process.env.GITHUB_SHA || 'local';
const TRIGGERED_BY = process.env.GITHUB_ACTOR || 'manual';

function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

async function parseTestResults() {
  const resultsPath = path.join(__dirname, '../coverage/test-results.json');
  
  // Check if results file exists
  if (!fs.existsSync(resultsPath)) {
    console.log('No test results file found. Tests may not have run.');
    return null;
  }

  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  
  const testResults = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;
  let totalDuration = 0;

  // Parse test results
  for (const testFile of results.testResults || []) {
    for (const assertionResult of testFile.assertionResults || []) {
      totalTests++;
      const status = assertionResult.status === 'passed' ? 'passed' 
                   : assertionResult.status === 'failed' ? 'failed' 
                   : 'skipped';
      
      if (status === 'passed') passedTests++;
      else if (status === 'failed') failedTests++;
      else skippedTests++;

      totalDuration += assertionResult.duration || 0;

      testResults.push({
        suite_name: testFile.name,
        test_name: assertionResult.title,
        status: status,
        duration_ms: Math.round(assertionResult.duration || 0),
        error_message: assertionResult.failureMessages?.[0]?.substring(0, 500),
        stack_trace: assertionResult.failureMessages?.[0],
        file_path: testFile.name.replace(process.cwd(), ''),
      });
    }
  }

  return {
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    totalDuration: Math.round(totalDuration),
    testResults,
  };
}

async function parseCoverage() {
  const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
  
  if (!fs.existsSync(coveragePath)) {
    console.log('No coverage summary found.');
    return { percentage: null, reports: [] };
  }

  const coverageSummary = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const reports = [];

  for (const [filePath, metrics] of Object.entries(coverageSummary)) {
    if (filePath === 'total') continue;

    reports.push({
      file_path: filePath.replace(process.cwd(), ''),
      lines_covered: metrics.lines.covered,
      lines_total: metrics.lines.total,
      branches_covered: metrics.branches.covered,
      branches_total: metrics.branches.total,
      functions_covered: metrics.functions.covered,
      functions_total: metrics.functions.total,
      coverage_percentage: metrics.lines.pct,
    });
  }

  return {
    percentage: coverageSummary.total?.lines?.pct || null,
    reports,
  };
}

async function sendToQADashboard(payload) {
  const url = `${SUPABASE_URL}/functions/v1/report-test-results`;
  
  // Generate webhook signature for authentication
  const signature = generateSignature(payload, WEBHOOK_SECRET);
  
  console.log('Sending test results to QA Dashboard...');
  console.log(`Branch: ${payload.branch}`);
  console.log(`Total Tests: ${payload.total_tests}`);
  console.log(`Passed: ${payload.passed_tests}`);
  console.log(`Failed: ${payload.failed_tests}`);
  console.log(`Coverage: ${payload.coverage_percentage}%`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'x-webhook-signature': signature
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Test results reported successfully!');
    console.log(`Test Run ID: ${result.test_run_id}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to report test results:', error.message);
    throw error;
  }
}

async function main() {
  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !WEBHOOK_SECRET) {
    console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, WEBHOOK_SECRET');
    process.exit(1);
  }

  // Parse test results
  const testData = await parseTestResults();
  if (!testData) {
    console.log('Skipping report - no test data available');
    process.exit(0);
  }

  // Parse coverage
  const { percentage: coveragePercentage, reports: coverageReports } = await parseCoverage();

  // Build payload
  const payload = {
    branch: BRANCH,
    commit_hash: COMMIT_HASH,
    total_tests: testData.totalTests,
    passed_tests: testData.passedTests,
    failed_tests: testData.failedTests,
    skipped_tests: testData.skippedTests,
    duration_ms: testData.totalDuration,
    coverage_percentage: coveragePercentage,
    triggered_by: TRIGGERED_BY,
    test_results: testData.testResults,
    coverage: coverageReports,
  };

  // Send to dashboard
  await sendToQADashboard(payload);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
