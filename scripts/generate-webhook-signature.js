#!/usr/bin/env node

/**
 * Generate webhook signature for test results reporting
 * 
 * This script generates an HMAC-SHA256 signature for the test results payload
 * to securely authenticate requests to the report-test-results edge function.
 * 
 * Usage in GitHub Actions:
 * 1. Add WEBHOOK_SECRET to GitHub Secrets
 * 2. Add WEBHOOK_SECRET to Supabase Secrets
 * 3. Use this script to sign the payload before sending
 */

const crypto = require('crypto');

function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

module.exports = { generateSignature };

// CLI usage
if (require.main === module) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.error('Error: WEBHOOK_SECRET environment variable not set');
    process.exit(1);
  }

  const payload = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
  const signature = generateSignature(payload, secret);
  console.log(signature);
}
