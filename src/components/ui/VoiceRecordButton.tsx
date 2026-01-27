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
import { Mic, Square, Loader2, X, Check, AlertCircle, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVoiceRecording, type UseVoiceRecordingOptions } from '@/hooks/useVoiceRecording';
import { MicrophonePermissionDialog } from '@/components/MicrophonePermissionDialog';
import { playSound } from '@/lib/audioFeedback';
import { hapticNotification } from '@/lib/haptics';

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
  disabled?: boolean;
  className?: string;
  
  /** Label text when idle */
  idleLabel?: string;
  
  /** Label text when recording */
  recordingLabel?: string;
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
  disabled = false,
  className = '',
  idleLabel = 'Voice',
  recordingLabel = 'Stop',
}: VoiceRecordButtonProps) {
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Cleanup timers on unmount
  useEffect(() => {
    return () => clearAutoSubmitTimers();
  }, [clearAutoSubmitTimers]);

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
  } = useVoiceRecording({
    preferRealtime,
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
  });

  const handleClick = useCallback(() => {
    if (state === 'idle' || state === 'error') {
      startRecording();
    } else if (canStopRecording) {
      stopRecording();
    }
  }, [state, canStopRecording, startRecording, stopRecording]);

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
      case 'error':
        return 'Retry';
      default:
        return idleLabel;
    }
  };

  const isDisabled = disabled || state === 'processing' || state === 'stopping';

  return (
    <>
      <MicrophonePermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
        onRetry={handleRetry}
      />

      <div className={cn('flex flex-col items-center gap-2', className)}>
        {/* Live transcript display */}
        {showLiveTranscript && isRecording && partialTranscript && (
          <div className={cn(
            'text-muted-foreground italic animate-pulse max-w-xs truncate px-2',
            config.text
          )}>
            "{partialTranscript}..."
          </div>
        )}

        {/* Recording status indicator */}
        {isRecording && (
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-2 w-2 rounded-full animate-pulse',
              state === 'connecting' ? 'bg-yellow-500' : 'bg-destructive'
            )} />
            <span className={cn('text-muted-foreground', config.text)}>
              {stateLabel}
            </span>
          </div>
        )}

        {/* Main button */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={getButtonVariant()}
            size={showLabel ? 'default' : 'icon'}
            onClick={handleClick}
            disabled={isDisabled}
            className={cn(
              !showLabel && config.button,
              showLabel && 'gap-2',
              isRecording && 'ring-2 ring-destructive/50 ring-offset-2'
            )}
          >
            {getIcon()}
            {showLabel && <span>{getLabel()}</span>}
          </Button>

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
