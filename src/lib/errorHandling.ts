/**
 * Generic error messages for client-side display
 * Never expose internal database structure or API details
 */

export const ERROR_MESSAGES = {
  AUTH: {
    FAILED: 'Authentication failed. Please try logging in again.',
    REQUIRED: 'You must be logged in to perform this action.',
    UNAUTHORIZED: 'You do not have permission to perform this action.',
  },
  DATABASE: {
    LOAD_FAILED: 'Unable to load data. Please try again.',
    SAVE_FAILED: 'Unable to save changes. Please try again.',
    DELETE_FAILED: 'Unable to delete item. Please try again.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
  },
  VALIDATION: {
    INVALID_INPUT: 'Please check your input and try again.',
    REQUIRED_FIELD: 'This field is required.',
  },
  GENERIC: {
    UNEXPECTED: 'An unexpected error occurred. Please try again.',
    TRY_AGAIN: 'Something went wrong. Please try again later.',
  },
};

/**
 * Sanitizes error messages for client display
 * Logs detailed error server-side, returns generic message for client
 */
export function sanitizeError(error: unknown): string {
  // Log full error for debugging
  console.error('Detailed error:', error);

  // Return generic message to client
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message).toLowerCase();
    
    // Map known safe error patterns to friendly messages
    if (message.includes('authentication') || message.includes('auth')) {
      return ERROR_MESSAGES.AUTH.FAILED;
    }
    if (message.includes('permission') || message.includes('policy')) {
      return ERROR_MESSAGES.AUTH.UNAUTHORIZED;
    }
    if (message.includes('network') || message.includes('fetch')) {
      return ERROR_MESSAGES.DATABASE.NETWORK_ERROR;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ERROR_MESSAGES.VALIDATION.INVALID_INPUT;
    }
  }

  return ERROR_MESSAGES.GENERIC.UNEXPECTED;
}

/**
 * Type-safe error handler for database operations
 */
export function handleDatabaseError(error: unknown, operation: 'load' | 'save' | 'delete'): string {
  console.error(`Database ${operation} error:`, error);
  
  switch (operation) {
    case 'load':
      return ERROR_MESSAGES.DATABASE.LOAD_FAILED;
    case 'save':
      return ERROR_MESSAGES.DATABASE.SAVE_FAILED;
    case 'delete':
      return ERROR_MESSAGES.DATABASE.DELETE_FAILED;
  }
}
