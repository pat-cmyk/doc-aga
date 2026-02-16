/**
 * Error Handling SSOT
 * 
 * Single source of truth for all user-facing error messages.
 * Pattern-matches raw Supabase/PostgreSQL errors and returns
 * farmer-friendly bilingual (English + Filipino) messages.
 * 
 * Usage:
 *   import { showErrorToast } from "@/lib/errorHandling";
 *   showErrorToast(error, "saving milk record");
 * 
 * For legacy shadcn useToast:
 *   import { showErrorToastLegacy } from "@/lib/errorHandling";
 *   showErrorToastLegacy(toast, error, "Error Title");
 */

import { toast as sonnerToast } from "sonner";

// ─── Bilingual Error Messages ─────────────────────────────────────────

export const ERROR_MESSAGES = {
  DUPLICATE: {
    title: "Duplicate Entry",
    description: "This record already exists. (May dobleng entry. Naka-record na ito.)",
  },
  INVALID_CREDENTIALS: {
    title: "Login Failed",
    description: "Wrong email or password. Please check and try again. (Mali ang email o password. Subukan ulit.)",
  },
  ALREADY_REGISTERED: {
    title: "Already Registered",
    description: "This email is already registered. Please log in instead. (Naka-rehistro na ang email na ito. Mag-log in na lang.)",
  },
  LEAKED_PASSWORD: {
    title: "Weak Password",
    description: "This password was found in a data breach. Please choose a different, stronger password. (Ang password na ito ay nakita sa data breach. Pumili ng ibang mas malakas na password.)",
  },
  EMAIL_NOT_CONFIRMED: {
    title: "Email Not Confirmed",
    description: "Please check your email and click the confirmation link first. (I-check ang email at i-click ang confirmation link.)",
  },
  PERMISSION_DENIED: {
    title: "Permission Denied",
    description: "You don't have permission to do this. Contact your farm owner. (Wala kang permiso dito. Kontakin ang may-ari ng farm.)",
  },
  FOREIGN_KEY: {
    title: "Cannot Delete",
    description: "This record is linked to other data. Remove linked records first. (Hindi mabura — may konektadong data. Alisin muna ang mga naka-link.)",
  },
  NOT_FOUND: {
    title: "Not Found",
    description: "Record not found. It may have been deleted. (Hindi mahanap ang record. Baka na-delete na.)",
  },
  NETWORK: {
    title: "No Connection",
    description: "No internet connection. Check your signal and try again. (Walang internet. Suriin ang signal at subukan ulit.)",
  },
  RATE_LIMIT: {
    title: "Too Many Attempts",
    description: "Please wait a moment and try again. (Masyadong maraming pagsubok. Maghintay at subukan ulit.)",
  },
  STORAGE: {
    title: "Upload Failed",
    description: "File upload failed. Make sure the file is under 5MB. (Hindi na-upload. Siguraduhin na wala pang 5MB ang file.)",
  },
  FALLBACK: {
    title: "Something Went Wrong",
    description: "Please try again. (May problema. Subukan ulit.)",
  },
};

// ─── Pattern Matching ─────────────────────────────────────────────────

interface TranslatedError {
  title: string;
  description: string;
}

/**
 * Core translation engine.
 * Pattern-matches raw error strings to farmer-friendly bilingual messages.
 */
export function translateError(error: unknown, context?: string): TranslatedError {
  // Always log raw error for debugging
  console.error("[translateError]", context || "", error);

  const message = extractErrorMessage(error).toLowerCase();
  const code = extractErrorCode(error);

  // 1. Duplicate key / unique constraint
  if (message.includes("duplicate key") || message.includes("unique constraint") || message.includes("23505") || code === "23505") {
    return ERROR_MESSAGES.DUPLICATE;
  }

  // 2. Invalid login credentials
  if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
    return ERROR_MESSAGES.INVALID_CREDENTIALS;
  }

  // 3. User already registered
  if (message.includes("already registered") || message.includes("already been registered")) {
    return ERROR_MESSAGES.ALREADY_REGISTERED;
  }

  // 4. Leaked/breached password
  if (message.includes("password has been exposed") || message.includes("breached") || message.includes("leaked")) {
    return ERROR_MESSAGES.LEAKED_PASSWORD;
  }

  // 5. Email not confirmed
  if (message.includes("email not confirmed") || message.includes("email_not_confirmed")) {
    return ERROR_MESSAGES.EMAIL_NOT_CONFIRMED;
  }

  // 6. Permission / RLS / 403
  if (
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("policy") ||
    message.includes("403") ||
    message.includes("forbidden") ||
    message.includes("unauthorized") ||
    message.includes("401")
  ) {
    return ERROR_MESSAGES.PERMISSION_DENIED;
  }

  // 7. Foreign key violation
  if (message.includes("foreign key") || message.includes("23503") || code === "23503") {
    return ERROR_MESSAGES.FOREIGN_KEY;
  }

  // 8. Not found / PGRST116
  if (message.includes("pgrst116") || message.includes("no rows returned") || (message.includes("not found") && !message.includes("not found in"))) {
    return ERROR_MESSAGES.NOT_FOUND;
  }

  // 9. Network errors
  if (isNetworkError(error)) {
    return ERROR_MESSAGES.NETWORK;
  }

  // 10. Rate limiting
  if (message.includes("rate limit") || message.includes("429") || message.includes("too many requests") || message.includes("too many attempts")) {
    return ERROR_MESSAGES.RATE_LIMIT;
  }

  // 11. Storage / file upload
  if (message.includes("storage") || message.includes("file too large") || message.includes("bucket") || message.includes("payload too large")) {
    return ERROR_MESSAGES.STORAGE;
  }

  // Fallback with optional context
  if (context) {
    return {
      title: ERROR_MESSAGES.FALLBACK.title,
      description: `Error ${context}. ${ERROR_MESSAGES.FALLBACK.description}`,
    };
  }

  return ERROR_MESSAGES.FALLBACK;
}

// ─── Toast Helpers ────────────────────────────────────────────────────

/**
 * Show error toast using sonner (preferred).
 * One-liner for any file — no hook needed.
 */
export function showErrorToast(error: unknown, context?: string): void {
  const { title, description } = translateError(error, context);
  sonnerToast.error(title, { description });
}

/**
 * Show error toast using shadcn useToast (legacy).
 * For files still using the hook-based toast system.
 */
export function showErrorToastLegacy(
  toastFn: (opts: { title: string; description: string; variant: "destructive" }) => void,
  error: unknown,
  context?: string
): void {
  const { title, description } = translateError(error, context);
  toastFn({ title, description, variant: "destructive" });
}

// ─── Utility Helpers ──────────────────────────────────────────────────

function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as any).message);
  if (typeof error === "object" && "error_description" in error) return String((error as any).error_description);
  return String(error);
}

function extractErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  if ("code" in error) return String((error as any).code);
  return "";
}

/**
 * Check if an error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  const networkPatterns = [
    "failed to fetch",
    "network",
    "timeout",
    "aborted",
    "net::err",
    "econnrefused",
    "enotfound",
    "socket",
    "connection refused",
    "no internet",
    "offline",
  ];

  return networkPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Check if an error is retryable (not permanent like auth or validation errors)
 */
export function getRetryableError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  const nonRetryablePatterns = [
    "unauthorized",
    "forbidden",
    "invalid",
    "validation",
    "permission denied",
    "not found",
    "401",
    "403",
    "404",
  ];

  if (nonRetryablePatterns.some((pattern) => message.includes(pattern))) {
    return false;
  }

  return isNetworkError(error);
}
