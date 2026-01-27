import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Loader2, Radio, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MicrophonePermissionDialog } from '@/components/MicrophonePermissionDialog';
import { useRealtimeTranscription, type UseRealtimeTranscriptionOptions } from '@/hooks/useRealtimeTranscription';
import { TranscriptionCorrectionDialog } from '@/components/TranscriptionCorrectionDialog';

interface VoiceInterfaceProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  showLabel?: boolean;
  /** Enable realtime transcription (ElevenLabs Scribe) */
  useRealtime?: boolean;
  /** Enable correction UI */
  enableCorrection?: boolean;
  /** Context for keyterm generation */
  keyterms?: string[];
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ 
  onTranscription, 
  disabled = false,
  compact = false,
  className = "",
  showLabel = true,
  useRealtime = false,
  enableCorrection = false,
  keyterms = [],
}) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [lastTranscription, setLastTranscription] = useState<string | null>(null);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Realtime transcription hook
  const realtimeOptions: UseRealtimeTranscriptionOptions = {
    onPartialTranscript: (text: string) => {
      console.log('[VoiceInterface] Partial transcript:', text);
    },
    onComplete: (fullText: string) => {
      console.log('[VoiceInterface] Complete transcript:', fullText);
      setLastTranscription(fullText);
      onTranscription(fullText);
      toast({
        title: "Processing your question",
        description: fullText.substring(0, 100) + (fullText.length > 100 ? '...' : ''),
      });
    },
    onError: (error: Error) => {
      console.error('[VoiceInterface] Realtime error:', error);
      toast({
        title: "Realtime Error",
        description: "Falling back to batch transcription",
        variant: "destructive",
      });
    },
  };
  
  const {
    isConnected: isRealtimeConnected,
    isConnecting: isRealtimeConnecting,
    partialTranscript,
    fullTranscript,
    startSession,
    endSession,
    error: realtimeError,
  } = useRealtimeTranscription(realtimeOptions);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        const stream = mediaRecorderRef.current.stream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
      if (isRealtimeConnected) {
        endSession();
      }
    };
  }, [isRecording, isRealtimeConnected, endSession]);

  const startRecording = async () => {
    try {
      // Check microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (useRealtime) {
        // Use realtime transcription
        console.log('[VoiceInterface] Starting realtime transcription...');
        stream.getTracks().forEach(track => track.stop()); // Close permission check stream
        
        await startSession();
        setIsRecording(true);
        
        toast({
          title: "Recording Started (Realtime)",
          description: "Speak your question to Doc Aga",
        });
      } else {
        // Use batch transcription
        const isSamsungDevice = /samsung/i.test(navigator.userAgent);
        const mimeType = isSamsungDevice ? 'audio/webm;codecs=opus' : 'audio/webm';
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType
        });
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach(track => track.stop());
          await processAndSendAudio(audioBlob);
        };

        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event);
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
          toast({
            title: "Recording Error",
            description: "Please try again",
            variant: "destructive",
          });
        };

        mediaRecorder.start();
        setIsRecording(true);
        
        toast({
          title: "Recording Started",
          description: "Speak your question to Doc Aga",
        });
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      setShowPermissionDialog(true);
    }
  };

  const stopRecording = useCallback(() => {
    console.log('[VoiceInterface] Stop requested. State:', { 
      useRealtime, 
      isRealtimeConnected, 
      isRealtimeConnecting,
      isRecording 
    });
    
    if (useRealtime) {
      // Handle both connected and connecting states
      if (isRealtimeConnected) {
        console.log('[VoiceInterface] Stopping active realtime session...');
        endSession();
      } else if (isRealtimeConnecting) {
        console.log('[VoiceInterface] Cancelling realtime connection...');
        // Connection in progress - just reset state, the hook will cleanup
      }
      setIsRecording(false);
    } else if (mediaRecorderRef.current && isRecording) {
      console.log('[VoiceInterface] Stopping batch recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [useRealtime, isRealtimeConnected, isRealtimeConnecting, isRecording, endSession]);

  const processAndSendAudio = async (blob: Blob) => {
    setIsProcessing(true);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      console.log('Sending audio for transcription...');

      const { data, error } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        console.error('Function invocation error:', error);
        throw new Error('Failed to connect to transcription service');
      }

      if (data.error) {
        console.error('Transcription error:', data.error);
        
        if (data.error.includes('quota') || data.error.includes('insufficient_quota')) {
          throw new Error('OpenAI quota exceeded. Please add credits to your OpenAI account');
        }
        
        throw new Error(data.error);
      }

      if (data.text) {
        console.log('Transcription:', data.text);
        setLastTranscription(data.text);
        onTranscription(data.text);
        
        toast({
          title: "Processing your question",
          description: data.text.substring(0, 100) + (data.text.length > 100 ? '...' : ''),
        });
      } else {
        throw new Error('No transcription returned');
      }

    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : 'Failed to process audio',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCorrectionSubmitted = (correctedText?: string) => {
    if (correctedText) {
      // Re-process with corrected text
      setLastTranscription(correctedText);
      onTranscription(correctedText);
      toast({
        title: "Correction Applied",
        description: "Processing with corrected text",
      });
    }
  };

  return (
    <>
      <MicrophonePermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
        onRetry={startRecording}
      />
      
      <TranscriptionCorrectionDialog
        open={showCorrectionDialog}
        onOpenChange={setShowCorrectionDialog}
        originalText={lastTranscription || ''}
        context="doc-aga"
        onCorrectionSubmitted={handleCorrectionSubmitted}
      />
      
      <div className={`flex items-center justify-center gap-2 ${compact ? 'p-2' : 'p-4 border-t bg-muted/30'} ${className}`}>
        {!isRecording ? (
          <div className="flex items-center gap-2">
            <Button 
              onClick={startRecording}
              className="gap-2"
              variant="secondary"
              size={compact ? "default" : "default"}
              disabled={isProcessing || disabled || isRealtimeConnecting}
            >
              {useRealtime && <Radio className="h-3 w-3 text-green-500" />}
              <Mic className={compact ? "h-4 w-4" : "h-4 w-4"} />
              {showLabel && (compact ? "Record" : (useRealtime ? "Realtime Voice" : "Record Voice Question"))}
            </Button>
            
            {/* Correction button */}
            {enableCorrection && lastTranscription && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCorrectionDialog(true)}
                className="gap-1"
              >
                <Edit2 className="h-3 w-3" />
                Edit
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {/* Live transcript display for realtime mode */}
            {useRealtime && partialTranscript && (
              <div className="text-sm text-muted-foreground italic animate-pulse max-w-xs truncate">
                "{partialTranscript}..."
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <div className={`h-3 w-3 rounded-full ${isRealtimeConnecting ? 'bg-yellow-500' : 'bg-destructive'} animate-pulse`} />
                {useRealtime 
                  ? (isRealtimeConnecting ? 'Connecting...' : 'Listening...') 
                  : 'Recording...'}
              </div>
              <Button 
                onClick={stopRecording}
                variant="destructive"
                size="sm"
                className="gap-2"
                disabled={useRealtime && !isRealtimeConnected && !isRealtimeConnecting}
              >
                <Square className="h-4 w-4" />
                {isRealtimeConnecting ? 'Cancel' : 'Stop & Send'}
              </Button>
            </div>
          </div>
        )}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </div>
        )}
      </div>
    </>
  );
};

export default VoiceInterface;

// Export recording state for parent components that need it
export { VoiceInterface };
