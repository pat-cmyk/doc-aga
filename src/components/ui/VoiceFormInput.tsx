/**
 * VoiceFormInput - Unified Voice Recording Component
 * 
 * A reusable voice input component that:
 * - Works offline by queuing recordings to IndexedDB
 * - Has configurable data extraction based on form type
 * - Provides consistent UI/UX across all dialogs
 * - Processes recordings automatically when online
 */

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { MicrophonePermissionDialog } from "@/components/MicrophonePermissionDialog";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { 
  runExtractor, 
  type ExtractorType, 
  type ExtractorContext,
  type ExtractedData 
} from "@/lib/voiceFormExtractors";

// ==================== TYPES ====================

type RecordingState = 'idle' | 'recording' | 'processing';

export interface VoiceFormInputProps<T = Record<string, any>> {
  /** Callback when data is extracted from voice input */
  onDataExtracted: (data: T) => void;
  
  /** Type of extraction to perform */
  extractorType: ExtractorType;
  
  /** Custom extractor function for 'custom' type */
  customExtractor?: (transcription: string, context?: ExtractorContext) => T;
  
  /** Context data for extractors (e.g., feedInventory for feed extractor) */
  extractorContext?: ExtractorContext;
  
  /** Button size variant */
  size?: 'sm' | 'md' | 'lg';
  
  /** Button variant */
  variant?: 'ghost' | 'outline' | 'default';
  
  /** Additional CSS classes */
  className?: string;
  
  /** Whether the button is disabled */
  disabled?: boolean;
  
  /** Offline behavior: 'queue' saves for later, 'block' requires online */
  offlineMode?: 'queue' | 'block';
  
  /** Form type for categorizing offline queue items */
  formType?: string;
  
  /** Callback when recording starts */
  onRecordingStart?: () => void;
  
  /** Callback when recording ends */
  onRecordingEnd?: () => void;
  
  /** Callback when recording is queued for offline processing */
  onOfflineQueued?: (queueId: string) => void;
  
  /** Show queued count badge */
  showQueuedCount?: boolean;
  
  /** Number of queued voice inputs */
  queuedCount?: number;
}

// ==================== COMPONENT ====================

export function VoiceFormInput<T = Record<string, any>>({
  onDataExtracted,
  extractorType,
  customExtractor,
  extractorContext,
  size = 'sm',
  variant = 'ghost',
  className = '',
  disabled = false,
  offlineMode = 'queue',
  formType,
  onRecordingStart,
  onRecordingEnd,
  onOfflineQueued,
  showQueuedCount = false,
  queuedCount = 0,
}: VoiceFormInputProps<T>) {
  const [state, setState] = useState<RecordingState>('idle');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isOnline = useOnlineStatus();

  // Size classes
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'min-h-[48px] min-w-[48px]',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  /**
   * Start audio recording
   */
  const startRecording = useCallback(async () => {
    // Check offline mode
    if (!isOnline && offlineMode === 'block') {
      toast.error('Voice input requires internet connection');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        onRecordingEnd?.();
        await processAudio(audioBlob);
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setState('recording');
      onRecordingStart?.();
      hapticImpact('medium');
    } catch (error: any) {
      console.error('Error starting recording:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setShowPermissionDialog(true);
      } else {
        toast.error('Hindi ma-access ang microphone');
      }
      setState('idle');
    }
  }, [isOnline, offlineMode, onRecordingStart, onRecordingEnd]);

  /**
   * Stop audio recording
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('processing');
      hapticImpact('light');
    }
  }, [state]);

  /**
   * Process recorded audio - either immediately or queue for offline
   */
  const processAudio = async (blob: Blob) => {
    try {
      // If offline, queue for later processing
      if (!isOnline && offlineMode === 'queue') {
        const queueId = await addToQueue({
          id: `voice_form_${Date.now()}`,
          type: 'voice_form_input' as any,
          payload: {
            voiceFormInput: {
              audioBlob: blob,
              extractorType,
              extractorContext,
              formType: formType || extractorType,
            }
          },
          createdAt: Date.now(),
        });

        toast.info('Recording saved. Will process when online.');
        hapticNotification('success');
        onOfflineQueued?.(queueId);
        setState('idle');
        return;
      }

      // Online: transcribe and extract immediately
      const base64Audio = await blobToBase64(blob);
      
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });

      if (transcriptionError) {
        throw new Error(transcriptionError.message || 'Transcription failed');
      }

      const transcription = transcriptionData?.text;
      if (!transcription) {
        toast.error('Walang narinig na text');
        setState('idle');
        return;
      }

      console.log(`[VoiceFormInput] Transcription (${extractorType}):`, transcription);

      // Run extractor
      const extractedData = runExtractor(
        transcription,
        extractorType,
        extractorContext,
        customExtractor as any
      ) as T;

      // Check if we got useful data
      const hasData = Object.values(extractedData as object).some(v => v !== undefined && v !== null && v !== '');
      
      if (hasData) {
        onDataExtracted(extractedData);
        hapticNotification('success');
        
        // Show extraction feedback
        const parts: string[] = [];
        const data = extractedData as Record<string, any>;
        if (data.totalLiters) parts.push(`${data.totalLiters}L`);
        if (data.totalKg) parts.push(`${data.totalKg}kg`);
        if (data.session) parts.push(data.session === 'AM' ? 'Morning' : 'Evening');
        if (data.feedType) parts.push(data.feedType);
        if (data.text) parts.push(data.text.substring(0, 30) + (data.text.length > 30 ? '...' : ''));
        
        if (parts.length > 0) {
          toast.success(`Extracted: ${parts.join(', ')}`);
        } else {
          toast.success('Voice input processed');
        }
      } else {
        // Give helpful hints based on extractor type
        const hints: Record<ExtractorType, string> = {
          milk: 'Try: "25 liters this morning"',
          feed: 'Try: "10 kilos Napier grass"',
          text: 'Try speaking clearly',
          custom: 'Try speaking clearly',
        };
        toast.info(hints[extractorType] || 'No data extracted');
      }
    } catch (error: any) {
      console.error('Voice processing error:', error);
      toast.error('Hindi na-process ang audio');
      hapticNotification('error');
    } finally {
      setState('idle');
    }
  };

  /**
   * Convert blob to base64
   */
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  /**
   * Handle button click
   */
  const handleClick = () => {
    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  };

  // Determine if button should be disabled
  const isDisabled = disabled || state === 'processing' || (!isOnline && offlineMode === 'block');
  
  // Determine tooltip
  const getTitle = () => {
    if (!isOnline && offlineMode === 'block') return 'Voice input requires internet';
    if (!isOnline && offlineMode === 'queue') return 'Recording will be queued for processing';
    if (state === 'recording') return 'Stop recording';
    return 'Voice input';
  };

  return (
    <>
      <div className={`relative inline-flex ${className}`}>
        <Button
          type="button"
          variant={state === 'recording' ? 'destructive' : variant}
          size="icon"
          onClick={handleClick}
          disabled={isDisabled}
          className={`${sizeClasses[size]} shrink-0`}
          title={getTitle()}
        >
          {state === 'idle' && <Mic className={iconSizes[size]} />}
          {state === 'recording' && <Square className={`${iconSizes[size]} animate-pulse`} />}
          {state === 'processing' && <Loader2 className={`${iconSizes[size]} animate-spin`} />}
        </Button>
        
        {/* Queued count badge */}
        {showQueuedCount && queuedCount > 0 && (
          <Badge 
            variant="secondary" 
            className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1 text-xs flex items-center gap-0.5"
          >
            <Clock className="h-3 w-3" />
            {queuedCount}
          </Badge>
        )}
        
        {/* Offline indicator */}
        {!isOnline && offlineMode === 'queue' && state === 'idle' && (
          <div className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-amber-500" title="Offline - will queue" />
        )}
      </div>

      <MicrophonePermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
        onRetry={() => {
          setShowPermissionDialog(false);
          startRecording();
        }}
      />
    </>
  );
}

// Export types for consumers
export type { ExtractorType, ExtractorContext, ExtractedData };
