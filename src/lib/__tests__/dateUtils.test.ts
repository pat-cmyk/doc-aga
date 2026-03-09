import { describe, it, expect } from 'vitest';
import { toTimestamptz, formatPHTime, formatPHDate, formatPHDateAndTime } from '../dateUtils';

describe('dateUtils', () => {
  describe('toTimestamptz', () => {
    it('returns ISO 8601 string with Z suffix', () => {
      // 7:58 PM PHT on March 9 = 11:58 AM UTC
      const date = new Date('2026-03-09T19:58:00+08:00');
      const result = toTimestamptz(date);
      expect(result).toBe('2026-03-09T11:58:00.000Z');
    });

    it('always includes UTC timezone marker', () => {
      const result = toTimestamptz(new Date());
      expect(result).toMatch(/Z$/);
    });

    it('never produces a naive timestamp string', () => {
      const result = toTimestamptz(new Date());
      // Must end with Z (UTC marker)
      expect(result.endsWith('Z')).toBe(true);
      // Must not look like a naive string (no T without Z)
      expect(result).not.toMatch(/T\d{2}:\d{2}:\d{2}$/);
    });

    it('defaults to current time when no argument', () => {
      const before = Date.now();
      const result = toTimestamptz();
      const after = Date.now();
      const resultMs = new Date(result).getTime();
      expect(resultMs).toBeGreaterThanOrEqual(before);
      expect(resultMs).toBeLessThanOrEqual(after);
    });
  });

  describe('formatPHTime', () => {
    it('formats UTC timestamp as Philippine time', () => {
      // UTC 11:58 = PHT 19:58 (7:58 PM)
      const result = formatPHTime('2026-03-09T11:58:00.000Z');
      expect(result).toMatch(/7:58\s*PM/i);
    });

    it('handles Date objects', () => {
      const date = new Date('2026-03-09T11:58:00.000Z');
      const result = formatPHTime(date);
      expect(result).toMatch(/7:58\s*PM/i);
    });

    it('handles midnight boundary correctly', () => {
      // UTC 16:00 = PHT 00:00 (midnight, next day)
      const result = formatPHTime('2026-03-09T16:00:00.000Z');
      expect(result).toMatch(/12:00\s*AM/i);
    });
  });

  describe('formatPHDate', () => {
    it('formats date in Philippine timezone', () => {
      // UTC 11:58 on Mar 9 = PHT 19:58 on Mar 9
      const result = formatPHDate('2026-03-09T11:58:00.000Z');
      expect(result).toContain('Mar');
      expect(result).toContain('9');
      expect(result).toContain('2026');
    });

    it('handles midnight boundary — UTC late night becomes next day in PHT', () => {
      // UTC 23:30 on Mar 9 = PHT 07:30 on Mar 10
      const result = formatPHDate('2026-03-09T23:30:00.000Z');
      expect(result).toContain('Mar');
      expect(result).toContain('10');
    });
  });

  describe('formatPHDateAndTime', () => {
    it('formats both date and time in Philippine timezone', () => {
      const result = formatPHDateAndTime('2026-03-09T11:58:00.000Z');
      expect(result).toContain('Mar');
      expect(result).toContain('9');
      expect(result).toMatch(/7:58\s*PM/i);
    });
  });
});
