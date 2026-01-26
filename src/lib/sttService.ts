/**
 * STT Service - Unified Speech-to-Text with Fallback Chain
 * 
 * SSOT for all transcription logic with:
 * - ElevenLabs Scribe (primary, low latency)
 * - Gemini 3 Pro (fallback, batch processing)
 * - Offline queue (last resort)
 */

import { supabase } from "@/integrations/supabase/client";

// ==================== TYPES ====================

export type STTProvider = 'elevenlabs' | 'gemini' | 'offline';

export interface STTResult {
  text: string;
  provider: STTProvider;
  latencyMs: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface STTOptions {
  /** Prefer realtime transcription (ElevenLabs) */
  preferRealtime?: boolean;
  /** Farm-specific terms to boost recognition */
  keyterms?: string[];
  /** Callback for partial transcripts (realtime only) */
  onPartialTranscript?: (text: string) => void;
  /** Skip analytics logging */
  skipAnalytics?: boolean;
}

// ==================== PROVIDER FUNCTIONS ====================

/**
 * Transcribe audio using Gemini 3 Pro via voice-to-text edge function
 */
async function transcribeWithGemini(audioBlob: Blob): Promise<string> {
  // Convert blob to base64
  const base64Audio = await blobToBase64(audioBlob);
  
  const { data, error } = await supabase.functions.invoke('voice-to-text', {
    body: { audio: base64Audio }
  });
  
  if (error) {
    console.error('[STT] Gemini transcription error:', error);
    throw new Error(error.message || 'Gemini transcription failed');
  }
  
  if (!data?.text) {
    throw new Error('No transcription returned from Gemini');
  }
  
  return data.text;
}

/**
 * Get ElevenLabs Scribe token for realtime transcription
 */
export async function getScribeToken(keyterms?: string[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('elevenlabs-scribe-token', {
    body: { keyterms }
  });
  
  if (error) {
    console.error('[STT] Failed to get Scribe token:', error);
    throw new Error('Failed to get transcription token');
  }
  
  if (!data?.token) {
    throw new Error('No token returned from server');
  }
  
  return data.token;
}

// ==================== MAIN TRANSCRIPTION FUNCTION ====================

/**
 * Transcribe audio with automatic fallback
 * 
 * Fallback chain:
 * 1. ElevenLabs Scribe (if preferRealtime and connected)
 * 2. Gemini 3 Pro (batch processing)
 * 3. Throw error (caller handles offline queuing)
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options: STTOptions = {}
): Promise<STTResult> {
  const startTime = Date.now();
  const { preferRealtime = false, keyterms, onPartialTranscript } = options;
  
  // For now, we skip ElevenLabs realtime in this function
  // The useRealtimeTranscription hook handles the WebSocket connection directly
  // This function is for batch transcription with fallback
  
  console.log('[STT] Starting batch transcription with Gemini');
  
  try {
    const text = await transcribeWithGemini(audioBlob);
    const latencyMs = Date.now() - startTime;
    
    console.log(`[STT] Gemini transcription complete in ${latencyMs}ms`);
    
    return {
      text,
      provider: 'gemini',
      latencyMs,
    };
  } catch (geminiError) {
    console.error('[STT] Gemini failed:', geminiError);
    
    // Both providers failed - throw for caller to handle
    throw new Error('All transcription providers failed. Please try again.');
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Convert Blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Generate keyterms from context for improved transcription
 */
export function generateKeytermsFromContext(context: {
  animals?: Array<{ name?: string; ear_tag?: string }>;
  feedInventory?: Array<{ feed_type?: string }>;
  customTerms?: string[];
}): string[] {
  const keyterms: string[] = [];
  
  // Add animal names and ear tags
  if (context.animals) {
    context.animals.forEach(animal => {
      if (animal.name) keyterms.push(animal.name);
      if (animal.ear_tag) keyterms.push(animal.ear_tag);
    });
  }
  
  // Add feed types
  if (context.feedInventory) {
    context.feedInventory.forEach(feed => {
      if (feed.feed_type) keyterms.push(feed.feed_type);
    });
  }
  
  // Add custom terms
  if (context.customTerms) {
    keyterms.push(...context.customTerms);
  }
  
  // Add common agricultural terms
  keyterms.push(
    'litro', 'liters', 'kilo', 'kilograms',
    'bales', 'bags', 'sako', 'bigkis',
    'napier', 'concentrates', 'hay', 'dayami',
    'AM', 'PM', 'umaga', 'gabi', 'hapon',
    'nagpapagatas', 'buntis', 'guya'
  );
  
  // Remove duplicates and empty values
  return [...new Set(keyterms.filter(Boolean))];
}

/**
 * Check if we can use realtime transcription
 */
export function canUseRealtimeSTT(): boolean {
  // Check if browser supports WebSocket and required APIs
  return (
    typeof WebSocket !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined'
  );
}
