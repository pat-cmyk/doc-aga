/**
 * Centralized date/time utilities for Doc Aga — SSOT for timestamp handling.
 *
 * RULES:
 * 1. CREATION: Always use toTimestamptz() when sending timestamps to Supabase
 *    timestamptz columns. This preserves the UTC offset. NEVER use
 *    format(date, "yyyy-MM-dd'T'HH:mm:ss") — it strips timezone info and
 *    Supabase interprets it as UTC, causing an 8-hour offset for PH users.
 *
 * 2. DISPLAY: date-fns format() is acceptable for display since it uses the
 *    browser's local timezone. For guaranteed PH timezone display (e.g., on
 *    non-PH test devices), use the formatPH* functions below.
 *
 * 3. DATE-ONLY columns (record_date, visit_date, etc.): Use
 *    format(date, 'yyyy-MM-dd'). These are DATE columns, not timestamptz,
 *    so timezone is irrelevant.
 */

const PH_TIMEZONE = 'Asia/Manila';
const PH_LOCALE = 'en-PH';

/**
 * Convert a Date to an ISO 8601 string for Supabase timestamptz columns.
 * This is the ONLY acceptable way to create timestamps for DB storage.
 *
 * @example
 * // User at 7:58 PM PHT on March 9:
 * toTimestamptz(new Date()) // → "2026-03-09T11:58:00.000Z" (correct UTC)
 *
 * // WRONG: format(date, "yyyy-MM-dd'T'HH:mm:ss")
 * // → "2026-03-09T19:58:00" (naive, Supabase treats as UTC → 8h offset)
 */
export function toTimestamptz(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Format a date for display in Philippine Time (UTC+8).
 * Use this instead of date-fns format() when PH timezone must be guaranteed
 * regardless of the user's browser timezone.
 */
export function formatPHDateTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(PH_LOCALE, {
    timeZone: PH_TIMEZONE,
    ...options,
  }).format(d);
}

/**
 * Format time in Philippine timezone (e.g., "7:58 PM").
 * Equivalent to date-fns format(date, 'h:mm a') but timezone-safe.
 */
export function formatPHTime(date: Date | string): string {
  return formatPHDateTime(date, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date in Philippine timezone (e.g., "Mar 9, 2026").
 * Equivalent to date-fns format(date, 'MMM d, yyyy') but timezone-safe.
 */
export function formatPHDate(date: Date | string): string {
  return formatPHDateTime(date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date + time in Philippine timezone (e.g., "Mar 9, 2026, 7:58 PM").
 * Equivalent to date-fns format(date, 'PPp') but timezone-safe.
 */
export function formatPHDateAndTime(date: Date | string): string {
  return formatPHDateTime(date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
