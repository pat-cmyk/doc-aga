import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceInterfaceProps {
  onTranscription: (text: string) => void;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ onTranscription }) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Recording Started",
        description: "Speak your question to Doc Aga",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: "Recording Stopped",
        description: "Click send to transcribe and submit",
      });
    }
  };

  const sendAudio = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      console.log('Sending audio for transcription...');

      // Send to voice-to-text edge function
      const { data, error } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });

      if (error) throw error;

      if (data.text) {
        console.log('Transcription:', data.text);
        onTranscription(data.text);
        setAudioBlob(null);
        
        toast({
          title: "Transcription Complete",
          description: "Processing your question...",
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

  const discardRecording = () => {
    setAudioBlob(null);
    toast({
      title: "Recording Discarded",
      description: "Ready to record again",
    });
  };

  return (
    <div className="flex items-center justify-center gap-2 p-4 border-t bg-muted/30">
      {!audioBlob ? (
        !isRecording ? (
          <Button 
            onClick={startRecording}
            className="gap-2"
            variant="secondary"
          >
            <Mic className="h-4 w-4" />
            Record Voice Question
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
              Stop Recording
            </Button>
          </div>
        )
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Recording ready</span>
          <Button 
            onClick={sendAudio}
            disabled={isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send
              </>
            )}
          </Button>
          <Button 
            onClick={discardRecording}
            variant="outline"
            size="sm"
            disabled={isProcessing}
          >
            Discard
          </Button>
        </div>
      )}
    </div>
  );
};

export default VoiceInterface;
