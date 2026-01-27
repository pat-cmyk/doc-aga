/**
 * VoiceRecordButton - Unified Voice Recording UI Component
 * 
 * A single, reusable component for all voice input across the app.
 * Replaces VoiceInterface, VoiceFormInput, and VoiceQuickAdd.
 * 
 * Features:
 * - State machine-driven UI (no state desync bugs)
 * - ElevenLabs Scribe (realtime) with Gemini fallback
 * - Live partial transcripts
 * - Transcription preview with cancel option
 * - Auto-submit with countdown
 * - Consistent UX across all voice inputs
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Loader2, X, Check, AlertCircle, Radio, WifiOff, CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVoiceRecording, type UseVoiceRecordingOptions } from '@/hooks/useVoiceRecording';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePendingAudioCount } from '@/hooks/usePendingAudioCount';
import { useAudioLevelMeter } from '@/hooks/useAudioLevelMeter';
import { MicrophonePermissionDialog } from '@/components/MicrophonePermissionDialog';
import { AudioLevelMeter } from '@/components/ui/AudioLevelMeter';
import { playSound } from '@/lib/audioFeedback';
import { hapticNotification } from '@/lib/haptics';
import type { AudioQueueMetadata } from '@/lib/offlineAudioQueue';

export interface VoiceRecordButtonProps {
  /** Callback when transcription is complete */
  onTranscription?: (text: string) => void;
  
  /** Callback for partial transcripts (live feedback) */
  onPartialTranscript?: (text: string) => void;
  
  /** Prefer realtime transcription (ElevenLabs). Default: true */
  preferRealtime?: boolean;
  
  /** Auto-submit configuration */
  autoSubmit?: {
    enabled: boolean;
    delayMs?: number;
    onSubmit: () => void;
  };
  
  /** Show preview toast before completing. Default: true */
  showPreview?: boolean;
  
  /** Preview duration in ms. Default: 2500 */
  previewDurationMs?: number;
  
  // UI Props
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline' | 'secondary';
  showLabel?: boolean;
  showLiveTranscript?: boolean;
  showOfflineIndicator?: boolean;
  showPendingBadge?: boolean;
  showAudioLevel?: boolean;
  audioLevelVariant?: 'bars' | 'simple' | 'circle';
  disabled?: boolean;
  className?: string;
  
  /** Label text when idle */
  idleLabel?: string;
  
  /** Label text when recording */
  recordingLabel?: string;
  
  /** Offline queue metadata for form-specific recordings */
  offlineMetadata?: Partial<AudioQueueMetadata>;
}

const sizeConfig = {
  sm: { button: 'h-8 w-8', icon: 'h-4 w-4', text: 'text-xs' },
  md: { button: 'h-10 w-10', icon: 'h-5 w-5', text: 'text-sm' },
  lg: { button: 'h-12 w-12', icon: 'h-6 w-6', text: 'text-base' },
};

export function VoiceRecordButton({
  onTranscription,
  onPartialTranscript,
  preferRealtime = true,
  autoSubmit,
  showPreview = true,
  previewDurationMs = 2500,
  size = 'md',
  variant = 'secondary',
  showLabel = false,
  showLiveTranscript = false,
  showOfflineIndicator = true,
  showPendingBadge = false,
  showAudioLevel = true,
  audioLevelVariant = 'bars',
  disabled = false,
  className = '',
  idleLabel = 'Voice',
  recordingLabel = 'Stop',
  offlineMetadata,
}: VoiceRecordButtonProps) {
  const isOnline = useOnlineStatus();
  const { stats: pendingStats } = usePendingAudioCount();
  const { audioLevel, frequencyData, isActive: isAnalyzing, startAnalysis, stopAnalysis } = useAudioLevelMeter();
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const config = sizeConfig[size];

  // Handle transcription completion with preview/auto-submit logic
  const handleTranscription = useCallback((text: string) => {
    console.log('[VoiceRecordButton] Transcription received:', text);
    
    if (!text.trim()) {
      toast.info('No speech detected. Try again.');
      return;
    }

    // Always call the callback first
    onTranscription?.(text);

    if (showPreview) {
      const previewText = text.length > 60 ? text.substring(0, 60) + '...' : text;
      
      if (autoSubmit?.enabled) {
        // Start auto-submit countdown
        const delayMs = autoSubmit.delayMs || previewDurationMs;
        const countdownSeconds = Math.ceil(delayMs / 1000);
        setAutoSubmitCountdown(countdownSeconds);
        
        // Countdown interval
        let remaining = countdownSeconds;
        countdownIntervalRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining > 0) {
            setAutoSubmitCountdown(remaining);
          }
        }, 1000);
        
        // Auto-submit timer
        autoSubmitTimerRef.current = setTimeout(() => {
          clearAutoSubmitTimers();
          playSound('success');
          hapticNotification('success');
          autoSubmit.onSubmit();
          toast.success('Saved!');
        }, delayMs);
        
        // Show preview toast with cancel option
        toast.info(`Heard: "${previewText}"`, {
          duration: delayMs,
          action: {
            label: 'Cancel',
            onClick: () => {
              clearAutoSubmitTimers();
              toast.info('Cancelled');
            },
          },
        });
      } else {
        // Just show preview without auto-submit
        toast.success(`Heard: "${previewText}"`);
      }
    }
  }, [onTranscription, showPreview, autoSubmit, previewDurationMs]);

  const clearAutoSubmitTimers = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoSubmitCountdown(null);
  }, []);

  // Voice recording hook
  const {
    state,
    partialTranscript,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    isRecording,
    isProcessingAudio,
    canStopRecording,
    stateLabel,
    isOffline,
    mediaStream,
  } = useVoiceRecording({
    preferRealtime: preferRealtime && isOnline, // Force batch mode when offline
    onTranscription: handleTranscription,
    onPartialTranscript,
    onError: (err) => {
      console.error('[VoiceRecordButton] Error:', err);
      if (err.message.includes('denied') || err.message.includes('permission')) {
        setShowPermissionDialog(true);
      } else {
        toast.error(err.message || 'Voice recording failed');
      }
    },
    offlineMetadata,
  });

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearAutoSubmitTimers();
      if (autoResetTimerRef.current) {
        clearTimeout(autoResetTimerRef.current);
      }
    };
  }, [clearAutoSubmitTimers]);

  // Auto-reset from preview state when showPreview is false (Doc Aga mode)
  useEffect(() => {
    if (state === 'preview' && !showPreview) {
      autoResetTimerRef.current = setTimeout(() => {
        reset();
      }, 300);
      return () => {
        if (autoResetTimerRef.current) {
          clearTimeout(autoResetTimerRef.current);
        }
      };
    }
  }, [state, showPreview, reset]);

  // Start/stop audio analysis when recording state changes
  useEffect(() => {
    if (isRecording && mediaStream && showAudioLevel) {
      startAnalysis(mediaStream);
    } else {
      stopAnalysis();
    }
  }, [isRecording, mediaStream, showAudioLevel, startAnalysis, stopAnalysis]);

  const handleClick = useCallback(() => {
    if (state === 'idle' || state === 'error') {
      startRecording();
    } else if (state === 'preview') {
      // Allow follow-up recordings from preview state
      reset();
      setTimeout(() => startRecording(), 50);
    } else if (canStopRecording) {
      stopRecording();
    }
  }, [state, canStopRecording, startRecording, stopRecording, reset]);

  const handleRetry = useCallback(() => {
    setShowPermissionDialog(false);
    reset();
    setTimeout(() => startRecording(), 100);
  }, [reset, startRecording]);

  // Determine button appearance based on state
  const getButtonVariant = () => {
    if (state === 'recording') return 'destructive';
    if (state === 'error') return 'destructive';
    return variant;
  };

  const getIcon = () => {
    switch (state) {
      case 'idle':
        return <Mic className={config.icon} />;
      case 'requesting_mic':
      case 'processing':
      case 'stopping':
        return <Loader2 className={cn(config.icon, 'animate-spin')} />;
      case 'connecting':
        return (
          <div className="relative">
            <Mic className={cn(config.icon, 'animate-pulse')} />
            <Radio className="h-2 w-2 absolute -top-0.5 -right-0.5 text-yellow-500 animate-pulse" />
          </div>
        );
      case 'recording':
        return <Square className={cn(config.icon, 'animate-pulse')} />;
      case 'offline_queued':
        return <CloudUpload className={cn(config.icon, 'text-amber-500')} />;
      case 'error':
        return <AlertCircle className={config.icon} />;
      case 'preview':
        return <Check className={config.icon} />;
      default:
        return <Mic className={config.icon} />;
    }
  };

  const getLabel = () => {
    switch (state) {
      case 'idle':
        return idleLabel;
      case 'connecting':
        return 'Connecting...';
      case 'recording':
        return recordingLabel;
      case 'stopping':
      case 'processing':
        return 'Processing...';
      case 'offline_queued':
        return 'Saved offline';
      case 'error':
        return 'Retry';
      default:
        return idleLabel;
    }
  };

  const isDisabled = disabled || state === 'processing' || state === 'stopping' || state === 'offline_queued';

  // Calculate total pending count for badge
  const totalPendingCount = pendingStats.pendingCount + pendingStats.failedCount;

  return (
    <>
      <MicrophonePermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
        onRetry={handleRetry}
      />

      <div className={cn('flex flex-col items-center gap-2', className)}>
        {/* Offline indicator */}
        {showOfflineIndicator && !isOnline && state === 'idle' && (
          <div className="flex items-center gap-1 text-amber-600 text-xs">
            <WifiOff className="h-3 w-3" />
            <span>Will save offline</span>
          </div>
        )}

        {/* Live transcript display */}
        {showLiveTranscript && isRecording && partialTranscript && (
          <div className={cn(
            'text-muted-foreground italic animate-pulse max-w-xs truncate px-2',
            config.text
          )}>
            "{partialTranscript}..."
          </div>
        )}

        {/* Audio level visualization */}
        {showAudioLevel && isRecording && (
          <AudioLevelMeter
            audioLevel={audioLevel}
            frequencyData={frequencyData}
            variant={audioLevelVariant}
            size={size}
            isActive={isAnalyzing}
          />
        )}

        {/* Recording status indicator */}
        {isRecording && (
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-2 w-2 rounded-full animate-pulse',
              state === 'connecting' ? 'bg-yellow-500' : 
              state === 'offline_queued' ? 'bg-amber-500' : 'bg-destructive'
            )} />
            <span className={cn('text-muted-foreground', config.text)}>
              {stateLabel}
            </span>
          </div>
        )}

        {/* Main button */}
        <div className="flex items-center gap-2 relative">
          <Button
            type="button"
            variant={getButtonVariant()}
            size={showLabel ? 'default' : 'icon'}
            onClick={handleClick}
            disabled={isDisabled}
            className={cn(
              !showLabel && config.button,
              showLabel && 'gap-2',
              isRecording && 'ring-2 ring-destructive/50 ring-offset-2',
              !isOnline && state === 'idle' && 'ring-2 ring-amber-500/30'
            )}
          >
            {getIcon()}
            {showLabel && <span>{getLabel()}</span>}
          </Button>

          {/* Offline indicator on button */}
          {showOfflineIndicator && !isOnline && !showLabel && state === 'idle' && (
            <WifiOff className="h-3 w-3 text-amber-500 absolute -top-1 -right-1" />
          )}

          {/* Pending badge */}
          {showPendingBadge && totalPendingCount > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute -bottom-2 -right-2 h-5 min-w-5 text-xs bg-amber-100 text-amber-800 border-amber-300"
            >
              {totalPendingCount}
            </Badge>
          )}

          {/* Cancel button when recording */}
          {canStopRecording && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={cancelRecording}
              className={cn(config.button, 'text-muted-foreground')}
            >
              <X className={config.icon} />
            </Button>
          )}
        </div>

        {/* Auto-submit countdown */}
        {autoSubmitCountdown !== null && (
          <div className={cn('text-muted-foreground', config.text)}>
            Saving in {autoSubmitCountdown}s...
          </div>
        )}

        {/* Error message */}
        {state === 'error' && error && (
          <div className={cn('text-destructive', config.text)}>
            {error.message}
          </div>
        )}
      </div>
    </>
  );
}

export default VoiceRecordButton;
