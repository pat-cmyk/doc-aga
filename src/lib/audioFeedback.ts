/**
 * Audio feedback utilities for voice interactions
 * Uses Web Audio API for instant synthesized sounds (no file dependencies)
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export type SoundType = 'success' | 'error' | 'notification';

/**
 * Play a synthesized feedback sound
 * Works instantly without needing external files
 */
export async function playSound(type: SoundType): Promise<void> {
  try {
    const ctx = getAudioContext();
    
    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Configure sound based on type
    switch (type) {
      case 'success':
        // Pleasant ascending two-tone chime
        oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        break;
        
      case 'error':
        // Low descending tone
        oscillator.frequency.setValueAtTime(349.23, ctx.currentTime); // F4
        oscillator.frequency.setValueAtTime(261.63, ctx.currentTime + 0.15); // C4
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
        break;
        
      case 'notification':
        // Single gentle ping
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
        break;
    }
  } catch (error) {
    console.warn('[audioFeedback] Playback failed:', error);
  }
}

/**
 * Preload/initialize audio context
 * Call once after user interaction to avoid autoplay restrictions
 */
export function initAudioFeedback(): void {
  try {
    getAudioContext();
  } catch (error) {
    console.warn('[audioFeedback] Init failed:', error);
  }
}
