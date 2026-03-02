/**
 * Shared prompt injection guard for AI edge functions.
 * Strips common injection patterns while preserving normal message content.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /\[SYSTEM\]/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|system\|>/gi,
  /<\|user\|>/gi,
  /<\|assistant\|>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /ignore\s+previous\s+instructions/gi,
  /ignore\s+all\s+previous/gi,
  /you\s+are\s+now\b/gi,
  /pretend\s+you\s+are\b/gi,
  /act\s+as\s+if\s+you\s+are\b/gi,
  /disregard\s+(all\s+)?previous/gi,
  /forget\s+(all\s+)?previous/gi,
];

export function sanitizeUserMessage(content: string): string {
  let sanitized = content;
  let wasModified = false;

  for (const pattern of INJECTION_PATTERNS) {
    const before = sanitized;
    sanitized = sanitized.replace(pattern, '');
    if (sanitized !== before) wasModified = true;
  }

  if (wasModified) {
    console.warn('[SANITIZE] Injection patterns stripped from user message');
  }

  return sanitized.trim();
}
