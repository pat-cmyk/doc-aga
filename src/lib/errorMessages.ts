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
