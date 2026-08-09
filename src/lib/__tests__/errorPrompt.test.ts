import { describe, it, expect } from 'vitest';
import { buildClaudeDebugPrompt } from '@/lib/errorPrompt';
import type { ErrorLogGroup } from '@/hooks/useErrorLogs';

const baseLog: ErrorLogGroup = {
  id: 'err-1',
  fingerprint: 'crash|/admin|5321b151',
  severity: 'crash',
  message: 'A <Select.Item /> must have a value prop that is not an empty string.',
  stack: 'Error: A <Select.Item />...\n    at SelectItem (select.tsx:198:12)',
  translated_title: 'Something Went Wrong',
  context: { route: '/admin', user_agent: 'Mozilla/5.0 (Linux; Android 13)', online: true },
  user_id: 'user-1',
  farm_id: 'farm-1',
  farm_name: 'Sample Farm',
  affected_user_count: 3,
  occurrence_count: 7,
  first_seen_at: '2026-08-09T10:47:00Z',
  last_seen_at: '2026-08-09T10:55:00Z',
  status: 'new',
  linked_ticket_id: 'tkt-uuid',
  linked_ticket_number: 'TKT-2608-0002',
};

describe('buildClaudeDebugPrompt', () => {
  it('includes the key debugging fields', () => {
    const prompt = buildClaudeDebugPrompt(baseLog);
    expect(prompt).toContain('Severity: crash');
    expect(prompt).toContain('Route: /admin');
    expect(prompt).toContain('Occurrences: 7');
    expect(prompt).toContain('affected users: 3');
    expect(prompt).toContain('must have a value prop');
    expect(prompt).toContain('Stack trace:');
    expect(prompt).toContain('at SelectItem (select.tsx:198:12)');
    expect(prompt).toContain('TKT-2608-0002');
    expect(prompt).toContain('Mozilla/5.0');
    expect(prompt).toContain('regression test');
  });

  it('omits the stack section when there is no stack', () => {
    const prompt = buildClaudeDebugPrompt({ ...baseLog, stack: null });
    expect(prompt).not.toContain('Stack trace:');
  });

  it('omits ticket and farm lines when absent', () => {
    const prompt = buildClaudeDebugPrompt({
      ...baseLog,
      linked_ticket_number: null,
      farm_name: null,
    });
    expect(prompt).not.toContain('Ticket:');
    expect(prompt).not.toContain('Farm:');
  });
});
