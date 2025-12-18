import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MicrophonePermissionDialog } from '@/components/MicrophonePermissionDialog';

interface VoiceInterfaceProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  showLabel?: boolean;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ 
  onTranscription, 
  disabled = false,
  compact = false,
  className = "",
  showLabel = true 
}) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        const stream = mediaRecorderRef.current.stream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Detect Samsung/Android devices for optimized MIME type
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
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Automatically send the recording
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
    } catch (error) {
      console.error('Error starting recording:', error);
      setShowPermissionDialog(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

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

  return (
    <>
    <MicrophonePermissionDialog
      open={showPermissionDialog}
      onOpenChange={setShowPermissionDialog}
      onRetry={startRecording}
    />
    <div className={`flex items-center justify-center gap-2 ${compact ? 'p-2' : 'p-4 border-t bg-muted/30'} ${className}`}>
      {!isRecording ? (
        <Button 
          onClick={startRecording}
          className="gap-2"
          variant="secondary"
          size={compact ? "default" : "default"}
          disabled={isProcessing || disabled}
        >
          <Mic className={compact ? "h-4 w-4" : "h-4 w-4"} />
          {showLabel && (compact ? "Record" : "Record Voice Question")}
        </Button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            Recording...
          </div>
          <Button 
            onClick={stopRecording}
            variant="destructive"
            size="sm"
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Stop & Send
          </Button>
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
