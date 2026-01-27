import { useState, useCallback, useEffect, useRef } from 'react';
import { TTSAudioQueue, type AudioQueueItem } from '@/lib/ttsAudioQueue';

export interface UseTTSQueueOptions {
  autoPlay?: boolean;
  onQueueEmpty?: () => void;
  onStart?: (item: AudioQueueItem) => void;
  onEnd?: (item: AudioQueueItem) => void;
  onError?: (error: Error) => void;
}

export interface UseTTSQueueReturn {
  // Actions
  enqueue: (audioUrl: string, meta?: { messageId?: string }) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
  
  // State
  isPlaying: boolean;
  isPaused: boolean;
  queueLength: number;
  currentMessageId: string | null;
  volume: number;
}

/**
 * React hook for managing TTS audio queue
 */
export function useTTSQueue(options: UseTTSQueueOptions = {}): UseTTSQueueReturn {
  const { autoPlay = true, onQueueEmpty, onStart, onEnd, onError } = options;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(1);
  
  const queueRef = useRef<TTSAudioQueue | null>(null);
  
  // Store callbacks in ref to avoid effect re-runs (callback ref pattern)
  const callbacksRef = useRef({ onQueueEmpty, onStart, onEnd, onError });
  
  // Keep ref updated with latest callbacks (no deps = runs every render, no cleanup needed)
  useEffect(() => {
    callbacksRef.current = { onQueueEmpty, onStart, onEnd, onError };
  });

  // Initialize queue on mount - only depends on autoPlay
  useEffect(() => {
    const queue = new TTSAudioQueue({
      onStart: (item) => {
        setCurrentMessageId(item.messageId || null);
        callbacksRef.current.onStart?.(item);
      },
      onEnd: (item) => {
        callbacksRef.current.onEnd?.(item);
      },
      onQueueEmpty: () => {
        setCurrentMessageId(null);
        callbacksRef.current.onQueueEmpty?.();
      },
      onError: (error) => {
        callbacksRef.current.onError?.(error);
      },
      onStateChange: (state) => {
        setIsPlaying(state.isPlaying);
        setIsPaused(state.isPaused);
        setQueueLength(state.queueLength);
      },
    }, autoPlay);

    queueRef.current = queue;

    return () => {
      queue.destroy();
      queueRef.current = null;
    };
  }, [autoPlay]); // Only autoPlay as dependency - callbacks accessed via ref

  const enqueue = useCallback((audioUrl: string, meta?: { messageId?: string }) => {
    queueRef.current?.enqueue(audioUrl, meta);
  }, []);

  const play = useCallback(() => {
    queueRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    queueRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    queueRef.current?.resume();
  }, []);

  const skip = useCallback(() => {
    queueRef.current?.skip();
  }, []);

  const stop = useCallback(() => {
    queueRef.current?.stop();
  }, []);

  const setVolume = useCallback((v: number) => {
    queueRef.current?.setVolume(v);
    setVolumeState(v);
  }, []);

  return {
    enqueue,
    play,
    pause,
    resume,
    skip,
    stop,
    setVolume,
    isPlaying,
    isPaused,
    queueLength,
    currentMessageId,
    volume,
  };
}
