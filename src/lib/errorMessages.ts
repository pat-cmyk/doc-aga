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

  // Default fallback
  return "May error. Subukan ulit.";
}

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

export function getSyncMessage(itemCount: number): string {
  if (itemCount === 0) return "Lahat ay na-sync na ✅";
  if (itemCount === 1) return "May 1 item pa na isasync";
  return `May ${itemCount} items pa na isasync`;
}
