/**
 * TTS Audio Queue Manager
 * 
 * Manages sequential audio playback for TTS responses,
 * preventing overlap and providing playback controls.
 */

export interface AudioQueueItem {
  id: string;
  audioUrl: string;
  messageId?: string;
  createdAt: number;
}

export interface TTSAudioQueueCallbacks {
  onStart?: (item: AudioQueueItem) => void;
  onEnd?: (item: AudioQueueItem) => void;
  onQueueEmpty?: () => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: { isPlaying: boolean; isPaused: boolean; queueLength: number }) => void;
}

const MAX_QUEUE_SIZE = 10;

export class TTSAudioQueue {
  private queue: AudioQueueItem[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private currentItem: AudioQueueItem | null = null;
  private _isPaused: boolean = false;
  private _volume: number = 1;
  private callbacks: TTSAudioQueueCallbacks = {};
  private autoPlay: boolean = true;

  constructor(callbacks?: TTSAudioQueueCallbacks, autoPlay: boolean = true) {
    this.callbacks = callbacks || {};
    this.autoPlay = autoPlay;
  }

  /**
   * Add audio to the queue
   */
  enqueue(audioUrl: string, meta?: { messageId?: string }): void {
    const item: AudioQueueItem = {
      id: `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      audioUrl,
      messageId: meta?.messageId,
      createdAt: Date.now(),
    };

    // Limit queue size - drop oldest if exceeded
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      const dropped = this.queue.shift();
      if (dropped) {
        this.cleanupUrl(dropped.audioUrl);
      }
      console.warn('[TTSQueue] Queue full, dropped oldest item');
    }

    this.queue.push(item);
    console.log(`[TTSQueue] Enqueued audio, queue length: ${this.queue.length}`);
    this.notifyStateChange();

    // Auto-play if not currently playing and autoPlay is enabled
    if (this.autoPlay && !this.currentAudio && !this._isPaused) {
      this.playNext();
    }
  }

  /**
   * Start or resume playback
   */
  play(): void {
    if (this._isPaused && this.currentAudio) {
      this.resume();
    } else if (!this.currentAudio) {
      this.playNext();
    }
  }

  /**
   * Pause current audio
   */
  pause(): void {
    if (this.currentAudio && !this._isPaused) {
      this.currentAudio.pause();
      this._isPaused = true;
      console.log('[TTSQueue] Paused');
      this.notifyStateChange();
    }
  }

  /**
   * Resume paused audio
   */
  resume(): void {
    if (this.currentAudio && this._isPaused) {
      this.currentAudio.play().catch(e => {
        console.error('[TTSQueue] Resume failed:', e);
        this.callbacks.onError?.(new Error('Failed to resume playback'));
      });
      this._isPaused = false;
      console.log('[TTSQueue] Resumed');
      this.notifyStateChange();
    }
  }

  /**
   * Skip current audio and play next
   */
  skip(): void {
    console.log('[TTSQueue] Skip requested');
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    this.cleanupCurrent();
    this._isPaused = false;
    this.playNext();
  }

  /**
   * Stop playback and clear queue
   */
  stop(): void {
    console.log('[TTSQueue] Stop - clearing queue');
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }
    this.cleanupCurrent();
    
    // Cleanup all queued URLs
    this.queue.forEach(item => this.cleanupUrl(item.audioUrl));
    this.queue = [];
    this._isPaused = false;
    this.notifyStateChange();
    this.callbacks.onQueueEmpty?.();
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this._volume;
    }
  }

  /**
   * Get current volume
   */
  get volume(): number {
    return this._volume;
  }

  /**
   * Check if audio is currently playing
   */
  get isPlaying(): boolean {
    return this.currentAudio !== null && !this._isPaused;
  }

  /**
   * Check if audio is paused
   */
  get isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Get number of items in queue (including current)
   */
  get queueLength(): number {
    return this.queue.length + (this.currentItem ? 1 : 0);
  }

  /**
   * Get current message ID being played
   */
  get currentMessageId(): string | null {
    return this.currentItem?.messageId || null;
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: TTSAudioQueueCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Cleanup on unmount
   */
  destroy(): void {
    this.stop();
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      console.log('[TTSQueue] Queue empty');
      this.notifyStateChange();
      this.callbacks.onQueueEmpty?.();
      return;
    }

    const item = this.queue.shift()!;
    this.currentItem = item;
    
    const audio = new Audio(item.audioUrl);
    audio.volume = this._volume;
    
    audio.onended = () => {
      console.log('[TTSQueue] Audio ended');
      this.callbacks.onEnd?.(item);
      this.cleanupCurrent();
      this.playNext();
    };

    audio.onerror = (e) => {
      console.error('[TTSQueue] Audio error:', e);
      this.callbacks.onError?.(new Error('Audio playback failed'));
      this.cleanupCurrent();
      this.playNext();
    };

    audio.onloadedmetadata = () => {
      console.log(`[TTSQueue] Playing audio, duration: ${audio.duration}s`);
    };

    this.currentAudio = audio;
    this._isPaused = false;

    audio.play()
      .then(() => {
        this.callbacks.onStart?.(item);
        this.notifyStateChange();
      })
      .catch(e => {
        console.warn('[TTSQueue] Autoplay blocked:', e);
        // Autoplay blocked - set as paused so user can manually play
        this._isPaused = true;
        this.notifyStateChange();
      });
  }

  private cleanupCurrent(): void {
    if (this.currentItem) {
      this.cleanupUrl(this.currentItem.audioUrl);
    }
    this.currentAudio = null;
    this.currentItem = null;
  }

  private cleanupUrl(url: string): void {
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
        console.log('[TTSQueue] Revoked blob URL');
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private notifyStateChange(): void {
    this.callbacks.onStateChange?.({
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      queueLength: this.queueLength,
    });
  }
}

// Singleton instance for shared use
let sharedInstance: TTSAudioQueue | null = null;

export function getSharedTTSQueue(): TTSAudioQueue {
  if (!sharedInstance) {
    sharedInstance = new TTSAudioQueue();
  }
  return sharedInstance;
}
