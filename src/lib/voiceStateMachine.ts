/**
 * Voice State Machine
 * 
 * A finite state machine for managing voice recording lifecycle.
 * Provides explicit state transitions to prevent state desync bugs.
 */

export type VoiceState = 
  | 'idle'              // Ready to start recording
  | 'requesting_mic'    // Waiting for microphone permission
  | 'connecting'        // Connecting to realtime provider (WebSocket handshake)
  | 'recording'         // Actively recording/streaming audio
  | 'stopping'          // User pressed stop, waiting for cleanup
  | 'processing'        // Transcription in progress
  | 'preview'           // Showing transcription for verification
  | 'error';            // Error state with retry option

export interface VoiceStateData {
  state: VoiceState;
  partialTranscript: string;
  finalTranscript: string;
  error: Error | null;
  provider: 'elevenlabs' | 'gemini' | null;
}

export type VoiceAction =
  | { type: 'REQUEST_MIC' }
  | { type: 'MIC_GRANTED' }
  | { type: 'MIC_DENIED'; error: Error }
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS' }
  | { type: 'CONNECT_FAIL'; error: Error }
  | { type: 'RECORDING_START' }
  | { type: 'STOP_REQUESTED' }
  | { type: 'PROCESSING_START' }
  | { type: 'PROCESSING_COMPLETE'; transcript: string }
  | { type: 'PARTIAL_TRANSCRIPT'; text: string }
  | { type: 'PREVIEW_CONFIRM' }
  | { type: 'PREVIEW_CANCEL' }
  | { type: 'RETRY' }
  | { type: 'RESET' }
  | { type: 'ERROR'; error: Error }
  | { type: 'SET_PROVIDER'; provider: 'elevenlabs' | 'gemini' };

// Valid state transitions
const validTransitions: Record<VoiceState, VoiceState[]> = {
  idle: ['requesting_mic', 'error'],
  requesting_mic: ['connecting', 'recording', 'error', 'idle'],
  connecting: ['recording', 'error', 'idle', 'stopping'],
  recording: ['stopping', 'error', 'idle'],
  stopping: ['processing', 'preview', 'error', 'idle'],
  processing: ['preview', 'error', 'idle'],
  preview: ['idle', 'error'],
  error: ['idle', 'requesting_mic'],
};

export function createInitialState(): VoiceStateData {
  return {
    state: 'idle',
    partialTranscript: '',
    finalTranscript: '',
    error: null,
    provider: null,
  };
}

/**
 * Validate if a state transition is allowed
 */
export function canTransition(from: VoiceState, to: VoiceState): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Voice state reducer - handles all state transitions
 */
export function voiceReducer(state: VoiceStateData, action: VoiceAction): VoiceStateData {
  const log = (msg: string, newState: VoiceState) => {
    console.log(`[VoiceStateMachine] ${msg}: ${state.state} → ${newState}`);
  };

  switch (action.type) {
    case 'REQUEST_MIC': {
      if (!canTransition(state.state, 'requesting_mic')) {
        console.warn(`[VoiceStateMachine] Invalid transition: ${state.state} → requesting_mic`);
        return state;
      }
      log('Requesting microphone', 'requesting_mic');
      return { ...state, state: 'requesting_mic', error: null };
    }

    case 'MIC_GRANTED': {
      // Can go to connecting (realtime) or recording (batch)
      // The actual next state depends on the mode
      return state;
    }

    case 'MIC_DENIED': {
      log('Microphone denied', 'error');
      return { ...state, state: 'error', error: action.error };
    }

    case 'CONNECT_START': {
      if (!canTransition(state.state, 'connecting')) {
        console.warn(`[VoiceStateMachine] Invalid transition: ${state.state} → connecting`);
        return state;
      }
      log('Starting connection', 'connecting');
      return { ...state, state: 'connecting', error: null, partialTranscript: '' };
    }

    case 'CONNECT_SUCCESS': {
      if (!canTransition(state.state, 'recording')) {
        console.warn(`[VoiceStateMachine] Invalid transition: ${state.state} → recording`);
        return state;
      }
      log('Connected, now recording', 'recording');
      return { ...state, state: 'recording' };
    }

    case 'CONNECT_FAIL': {
      log('Connection failed', 'error');
      return { ...state, state: 'error', error: action.error };
    }

    case 'RECORDING_START': {
      if (!canTransition(state.state, 'recording')) {
        console.warn(`[VoiceStateMachine] Invalid transition: ${state.state} → recording`);
        return state;
      }
      log('Recording started', 'recording');
      return { ...state, state: 'recording', partialTranscript: '' };
    }

    case 'PARTIAL_TRANSCRIPT': {
      if (state.state !== 'recording' && state.state !== 'connecting') {
        return state;
      }
      return { ...state, partialTranscript: action.text };
    }

    case 'STOP_REQUESTED': {
      // Can stop from connecting OR recording
      if (state.state !== 'connecting' && state.state !== 'recording') {
        console.warn(`[VoiceStateMachine] Cannot stop from state: ${state.state}`);
        return state;
      }
      log('Stop requested', 'stopping');
      return { ...state, state: 'stopping' };
    }

    case 'PROCESSING_START': {
      if (!canTransition(state.state, 'processing')) {
        console.warn(`[VoiceStateMachine] Invalid transition: ${state.state} → processing`);
        return state;
      }
      log('Processing started', 'processing');
      return { ...state, state: 'processing' };
    }

    case 'PROCESSING_COMPLETE': {
      // Can come from stopping (realtime) or processing (batch)
      log('Processing complete', 'preview');
      return {
        ...state,
        state: 'preview',
        finalTranscript: action.transcript,
        partialTranscript: '',
      };
    }

    case 'PREVIEW_CONFIRM':
    case 'PREVIEW_CANCEL': {
      log(action.type === 'PREVIEW_CONFIRM' ? 'Preview confirmed' : 'Preview cancelled', 'idle');
      return {
        ...state,
        state: 'idle',
        partialTranscript: '',
        finalTranscript: action.type === 'PREVIEW_CANCEL' ? '' : state.finalTranscript,
      };
    }

    case 'RETRY': {
      if (!canTransition(state.state, 'requesting_mic')) {
        return { ...createInitialState(), provider: state.provider };
      }
      log('Retrying', 'requesting_mic');
      return { ...createInitialState(), provider: state.provider, state: 'requesting_mic' };
    }

    case 'RESET': {
      log('Reset', 'idle');
      return createInitialState();
    }

    case 'ERROR': {
      log('Error occurred', 'error');
      return { ...state, state: 'error', error: action.error };
    }

    case 'SET_PROVIDER': {
      return { ...state, provider: action.provider };
    }

    default:
      return state;
  }
}

/**
 * Helper to check if we can stop recording
 */
export function canStop(state: VoiceState): boolean {
  return state === 'connecting' || state === 'recording';
}

/**
 * Helper to check if we're in an active recording session
 */
export function isActiveSession(state: VoiceState): boolean {
  return ['connecting', 'recording', 'stopping'].includes(state);
}

/**
 * Helper to check if we're processing audio
 */
export function isProcessing(state: VoiceState): boolean {
  return ['stopping', 'processing'].includes(state);
}

/**
 * Get human-readable status label
 */
export function getStateLabel(state: VoiceState, isRealtime: boolean = false): string {
  switch (state) {
    case 'idle': return 'Ready';
    case 'requesting_mic': return 'Requesting microphone...';
    case 'connecting': return isRealtime ? 'Connecting...' : 'Starting...';
    case 'recording': return isRealtime ? 'Listening...' : 'Recording...';
    case 'stopping': return 'Stopping...';
    case 'processing': return 'Processing...';
    case 'preview': return 'Preview';
    case 'error': return 'Error';
    default: return 'Unknown';
  }
}

/**
 * Get status indicator color
 */
export function getStateColor(state: VoiceState): string {
  switch (state) {
    case 'connecting': return 'bg-yellow-500';
    case 'recording': return 'bg-destructive';
    case 'processing':
    case 'stopping': return 'bg-blue-500';
    case 'error': return 'bg-red-500';
    default: return 'bg-muted';
  }
}
