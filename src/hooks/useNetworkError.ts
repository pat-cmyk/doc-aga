import { useState, useCallback } from "react";
import { isNetworkError, getRetryableError } from "@/lib/errorHandling";

interface UseNetworkErrorReturn {
  error: Error | null;
  isRetrying: boolean;
  setError: (error: unknown) => void;
  clearError: () => void;
  retry: (callback: () => Promise<void>) => Promise<void>;
  shouldShowRetry: boolean;
}

/**
 * Hook for managing network error state with retry functionality
 */
export function useNetworkError(): UseNetworkErrorReturn {
  const [error, setErrorState] = useState<Error | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const setError = useCallback((err: unknown) => {
    if (err instanceof Error) {
      setErrorState(err);
    } else if (err && typeof err === "object" && "message" in err) {
      setErrorState(new Error(String(err.message)));
    } else if (err) {
      setErrorState(new Error("An unexpected error occurred"));
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const retry = useCallback(async (callback: () => Promise<void>) => {
    setIsRetrying(true);
    try {
      await callback();
      clearError();
    } catch (err) {
      setError(err);
    } finally {
      setIsRetrying(false);
    }
  }, [clearError, setError]);

  const shouldShowRetry = error ? isNetworkError(error) || getRetryableError(error) : false;

  return {
    error,
    isRetrying,
    setError,
    clearError,
    retry,
    shouldShowRetry,
  };
}
