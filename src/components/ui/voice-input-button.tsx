import { useState, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { MicrophonePermissionDialog } from "@/components/MicrophonePermissionDialog";

interface VoiceInputButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

type RecordingState = 'idle' | 'recording' | 'processing';

export function VoiceInputButton({ 
  onTranscription, 
  disabled = false,
  className = ""
}: VoiceInputButtonProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
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
        await processAudio(audioBlob);
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setState('recording');
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
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('processing');
      hapticImpact('light');
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      const base64Audio = await blobToBase64(blob);
      
      const { data, error } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        throw new Error(error.message || 'Transcription failed');
      }

      if (data?.text) {
        onTranscription(data.text);
        hapticNotification('success');
        toast.success('Na-transcribe na ang audio');
      } else {
        toast.error('Walang narinig na text');
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast.error('Hindi na-transcribe ang audio');
      hapticNotification('error');
    } finally {
      setState('idle');
    }
  };

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

  const handleClick = () => {
    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={state === 'recording' ? 'destructive' : 'outline'}
        size="icon"
        onClick={handleClick}
        disabled={disabled || state === 'processing'}
        className={`min-h-[48px] min-w-[48px] shrink-0 ${className}`}
      >
        {state === 'idle' && <Mic className="h-5 w-5" />}
        {state === 'recording' && <Square className="h-5 w-5 animate-pulse" />}
        {state === 'processing' && <Loader2 className="h-5 w-5 animate-spin" />}
      </Button>

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
