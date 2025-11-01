/**
 * Translate database and application errors to user-friendly Tagalog messages
 * 
 * Converts technical error messages from Supabase, PostgreSQL, and the application
 * into clear, actionable messages in Tagalog that Filipino farmers can understand.
 * Handles network errors, database constraints, authentication issues, and
 * farm-specific errors like duplicate ear tags and voice transcription failures.
 * 
 * @param error - Error object or message from any source (Supabase, network, app)
 * @returns User-friendly error message in Tagalog
 * 
 * @example
 * ```typescript
 * // Handle duplicate ear tag error
 * try {
 *   await supabase.from('animals').insert({ ear_tag: '001', ... });
 * } catch (error) {
 *   const message = translateError(error);
 *   toast({ title: message }); // "May gumamit na ng ear tag na ito..."
 * }
 * 
 * // Handle network errors
 * try {
 *   await fetch('/api/data');
 * } catch (error) {
 *   const message = translateError(error);
 *   console.log(message); // "Walang internet connection. Na-save ang data offline."
 * }
 * ```
 */
export function translateError(error: any): string {
  const message = error?.message || error?.toString() || '';

  // Network errors
  if (message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch')) {
    return "Walang internet connection. Na-save ang data offline.";
  }

  // Offline/connection errors
  if (message.includes('PGRST') || message.includes('timeout')) {
    return "Walang koneksyon. Automatic na mag-sync kapag may internet na.";
  }

  // Duplicate ear tag
  if (message.includes('23505') || message.includes('duplicate') || message.includes('unique constraint')) {
    return "May gumamit na ng ear tag na ito. Gumamit ng iba.";
  }

  // Permission/RLS errors
  if (message.includes('permission') || message.includes('policy')) {
    return "Walang permiso. I-check ang iyong account.";
  }

  // Validation errors
  if (message.includes('violates')) {
    return "May mali sa data. I-check ang lahat ng fields.";
  }

  // Voice activity specific errors
  if (message.includes('Transcription and farmId are required')) {
    return "May problema sa offline recording. Paki-try ulit mag-record o i-sync ulit.";
  }

  if (message.includes('AUDIO_MISSING')) {
    return "Walang audio na na-save sa offline item. Paki-record ulit.";
  }

  if (message.includes('FARM_ID_MISSING')) {
    return "Walang farm na naka-select. Paki piliin ang farm at subukan muli.";
  }

  if (message.includes('TRANSCRIPTION_EMPTY') || message.includes('TRANSCRIPTION_FAILED')) {
    return "Hindi matranscribe ang boses. Paki-try ulit mag-record nang mas malinaw.";
  }

  if (message.includes('NEEDS_CLARIFICATION')) {
    return "Kailangan ng linaw sa feed type. Paki-specify ang type ng feed para sa unit na ginamit.";
  }

  if (message.includes('NO_INVENTORY')) {
    return "Walang feeds para sa unit na ito. Mag-add muna ng feed o gamitin ang tamang unit.";
  }

  // Authentication errors
  if (message.includes('Not authenticated') || 
      message.includes('Unauthorized') || 
      message.includes('JWT') || 
      message.includes('token') || 
      message.includes('expired') || 
      message.includes('Auth session missing')) {
    return "Kailangan mong mag-login ulit bago mag-sync.";
  }

  // Default fallback
  return "May error. Subukan ulit.";
}

/**
 * Generate success messages for completed operations
 * 
 * Creates positive, action-specific messages to confirm successful operations
 * like adding animals or recording voice activities.
 * 
 * @param type - Type of operation ('animal' or 'voice_activity')
 * @param details - Optional specific details about the operation (e.g., animal name)
 * @returns Success message in Tagalog with checkmark emoji
 * 
 * @example
 * ```typescript
 * // Animal added successfully
 * const message = getSuccessMessage('animal', 'Bessie (Tag #042)');
 * toast({ title: message }); // "Na-add na ang Bessie (Tag #042) sa farm mo ✅"
 * 
 * // Voice activity recorded
 * const message = getSuccessMessage('voice_activity', 'Milking - 10L');
 * toast({ title: message }); // "Na-record: Milking - 10L ✅"
 * ```
 */
export function getSuccessMessage(type: 'animal' | 'voice_activity', details?: string): string {
  switch (type) {
    case 'animal':
      return details 
        ? `Na-add na ang ${details} sa farm mo ✅`
        : "Na-add na ang animal ✅";
    case 'voice_activity':
      return details
        ? `Na-record: ${details} ✅`
        : "Na-record ang activity ✅";
    default:
      return "Success ✅";
  }
}

/**
 * Generate offline queue messages
 * 
 * Informs users that their data has been saved locally and will sync
 * automatically when internet connection is restored.
 * 
 * @param type - Type of operation ('animal' or 'voice_activity')
 * @returns Offline save confirmation message in Tagalog
 * 
 * @example
 * ```typescript
 * // Save animal offline
 * const message = getOfflineMessage('animal');
 * toast({ title: message }); // "Na-save offline. Automatic sync kapag may internet."
 * 
 * // Save voice recording offline
 * const message = getOfflineMessage('voice_activity');
 * toast({ title: message }); // "Na-save ang recording. I-process kapag may internet."
 * ```
 */
export function getOfflineMessage(type: 'animal' | 'voice_activity'): string {
  switch (type) {
    case 'animal':
      return "Na-save offline. Automatic sync kapag may internet.";
    case 'voice_activity':
      return "Na-save ang recording. I-process kapag may internet.";
    default:
      return "Na-save offline.";
  }
}

/**
 * Generate sync status messages based on pending item count
 * 
 * Creates context-aware messages about offline queue synchronization status,
 * with proper Tagalog pluralization.
 * 
 * @param itemCount - Number of items waiting to be synchronized
 * @returns Status message in Tagalog indicating sync progress
 * 
 * @example
 * ```typescript
 * // All synced
 * const message = getSyncMessage(0);
 * console.log(message); // "Lahat ay na-sync na ✅"
 * 
 * // One item pending
 * const message = getSyncMessage(1);
 * console.log(message); // "May 1 item pa na isasync"
 * 
 * // Multiple items pending
 * const message = getSyncMessage(5);
 * console.log(message); // "May 5 items pa na isasync"
 * ```
 */
export function getSyncMessage(itemCount: number): string {
  if (itemCount === 0) return "Lahat ay na-sync na ✅";
  if (itemCount === 1) return "May 1 item pa na isasync";
  return `May ${itemCount} items pa na isasync`;
}
