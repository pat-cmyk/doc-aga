/**
 * Centralized currency formatting utilities for Philippine Peso (PHP/₱)
 * All financial displays in the app should use these functions for consistency.
 */

/**
 * Format a number as Philippine Peso currency.
 * @param value - The numeric value to format
 * @param decimals - Whether to show decimal places (default: false)
 * @returns Formatted currency string (e.g., "₱12,500" or "₱12,500.00")
 */
export function formatPHP(value: number, decimals = false): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(value);
}

/**
 * Format a number as compact Philippine Peso for dashboards.
 * @param value - The numeric value to format
 * @returns Compact formatted string (e.g., "₱1.2M", "₱500K", "₱100")
 */
export function formatPHPCompact(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  
  if (absValue >= 1000000) {
    return `${sign}₱${(absValue / 1000000).toFixed(1)}M`;
  }
  if (absValue >= 1000) {
    return `${sign}₱${Math.round(absValue / 1000)}K`;
  }
  return formatPHP(value);
}

/**
 * Format a number with peso symbol for inline display.
 * Uses locale-aware thousand separators.
 * @param value - The numeric value to format
 * @returns Simple formatted string (e.g., "₱12,500")
 */
export function formatPesoSimple(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}
