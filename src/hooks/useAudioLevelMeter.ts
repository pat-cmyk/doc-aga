/**
 * useAudioLevelMeter - Web Audio API hook for real-time audio visualization
 * 
 * Connects to a MediaStream and extracts audio level and frequency data
 * for visualization purposes. Uses AnalyserNode for FFT analysis.
 */

import { useCallback, useRef, useState, useEffect } from 'react';

export interface UseAudioLevelMeterReturn {
  /** Normalized audio level (0-100) */
  audioLevel: number;
  /** Frequency data array for bar/waveform visualization */
  frequencyData: Uint8Array;
  /** Whether analysis is currently active */
  isActive: boolean;
  /** Start analyzing audio from a MediaStream */
  startAnalysis: (stream: MediaStream) => void;
  /** Stop analysis and cleanup */
  stopAnalysis: () => void;
}

// Frequency band ranges for bar visualization (based on 256 FFT size)
const BAND_RANGES = [
  { start: 0, end: 4 },    // Sub-bass (20-60Hz)
  { start: 4, end: 8 },    // Bass (60-250Hz)
  { start: 8, end: 20 },   // Low-mid (250-500Hz)
  { start: 20, end: 40 },  // Mid (500-2kHz)
  { start: 40, end: 80 },  // High-mid (2-4kHz)
];

/**
 * Calculate RMS (Root Mean Square) for overall audio level
 */
function calculateRMS(dataArray: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    // Convert from 0-255 to -1 to 1
    const value = (dataArray[i] - 128) / 128;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / dataArray.length);
  // Normalize to 0-100 with amplification for better visual feedback
  return Math.min(100, rms * 300);
}

/**
 * Extract frequency band levels for bar visualization
 */
function extractBandLevels(frequencyData: Uint8Array): number[] {
  return BAND_RANGES.map(({ start, end }) => {
    let sum = 0;
    for (let i = start; i < end && i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    const avg = sum / (end - start);
    // Normalize to 0-100
    return Math.min(100, (avg / 255) * 150);
  });
}

export function useAudioLevelMeter(): UseAudioLevelMeterReturn {
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(128));
  const [isActive, setIsActive] = useState(false);

  // Refs for Web Audio API objects
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Throttle state updates to ~30fps for performance
  const UPDATE_INTERVAL_MS = 33; // ~30fps

  /**
   * Animation loop that reads audio data and updates state
   */
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !isActive) return;

    const analyser = analyserRef.current;
    const timeDomainData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!analyserRef.current) return;

      analyser.getByteTimeDomainData(timeDomainData);
      analyser.getByteFrequencyData(freqData);

      const now = performance.now();
      if (now - lastUpdateRef.current >= UPDATE_INTERVAL_MS) {
        lastUpdateRef.current = now;
        
        // Calculate RMS level
        const level = calculateRMS(timeDomainData);
        setAudioLevel(level);
        
        // Update frequency data for visualization
        setFrequencyData(new Uint8Array(freqData));
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [isActive]);

  /**
   * Start analyzing audio from a MediaStream
   */
  const startAnalysis = useCallback((stream: MediaStream) => {
    // Cleanup any existing analysis
    if (audioContextRef.current) {
      stopAnalysis();
    }

    try {
      // Create AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create AnalyserNode
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Connect MediaStream
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      // Don't connect to destination (we don't want to hear feedback)
      // analyser.connect(audioContext.destination);

      setIsActive(true);
      console.log('[useAudioLevelMeter] Analysis started');
    } catch (error) {
      console.error('[useAudioLevelMeter] Failed to start analysis:', error);
    }
  }, []);

  /**
   * Stop analysis and cleanup resources
   */
  const stopAnalysis = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Disconnect and cleanup nodes
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      analyserRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Ignore close errors
      }
      audioContextRef.current = null;
    }

    setIsActive(false);
    setAudioLevel(0);
    setFrequencyData(new Uint8Array(128));
    console.log('[useAudioLevelMeter] Analysis stopped');
  }, []);

  // Start/stop analysis loop based on isActive state
  useEffect(() => {
    if (isActive && analyserRef.current) {
      analyzeAudio();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, analyzeAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnalysis();
    };
  }, [stopAnalysis]);

  return {
    audioLevel,
    frequencyData,
    isActive,
    startAnalysis,
    stopAnalysis,
  };
}

// Export band extraction utility for components
export { extractBandLevels, BAND_RANGES };
