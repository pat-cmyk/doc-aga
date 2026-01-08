import { useState, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hapticImpact, hapticNotification } from "@/lib/haptics";
import { MicrophonePermissionDialog } from "@/components/MicrophonePermissionDialog";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export interface ExtractedMilkData {
  totalLiters?: number;
  session?: 'AM' | 'PM';
  animalSelection?: string;
}

interface VoiceMilkInputProps {
  onDataExtracted: (data: ExtractedMilkData) => void;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing';

export function VoiceMilkInput({ 
  onDataExtracted, 
  disabled = false 
}: VoiceMilkInputProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isOnline = useOnlineStatus();

  const startRecording = async () => {
    if (!isOnline) {
      toast.error('Voice input requires internet connection');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
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
      
      // First transcribe the audio
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });

      if (transcriptionError) {
        throw new Error(transcriptionError.message || 'Transcription failed');
      }

      const transcription = transcriptionData?.text;
      if (!transcription) {
        toast.error('Walang narinig na text');
        return;
      }

      console.log('Milk voice transcription:', transcription);

      // Parse the transcription for milk recording data
      const extractedData = parseTranscription(transcription);
      
      if (extractedData.totalLiters || extractedData.session) {
        onDataExtracted(extractedData);
        hapticNotification('success');
        
        const parts = [];
        if (extractedData.totalLiters) parts.push(`${extractedData.totalLiters}L`);
        if (extractedData.session) parts.push(extractedData.session === 'AM' ? 'Morning' : 'Evening');
        
        toast.success(`Extracted: ${parts.join(', ')}`);
      } else {
        toast.info('Try saying: "25 liters this morning"');
      }
    } catch (error: any) {
      console.error('Voice processing error:', error);
      toast.error('Hindi na-process ang audio');
      hapticNotification('error');
    } finally {
      setState('idle');
    }
  };

  const parseTranscription = (text: string): ExtractedMilkData => {
    const result: ExtractedMilkData = {};
    const lowerText = text.toLowerCase();

    // Extract liters - look for numbers followed by liters/litro/L
    const literPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:liters?|litro|l\b)/i,
      /(?:collected|pumitas|nakuha|kumuha)\s*(?:ng)?\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*(?:na\s+)?(?:litro|liters?)/i,
    ];

    for (const pattern of literPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.totalLiters = parseFloat(match[1]);
        break;
      }
    }

    // If no pattern matched, try to find any standalone number that could be liters
    if (!result.totalLiters) {
      const numberMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
      if (numberMatch) {
        const num = parseFloat(numberMatch[1]);
        // Only use if it's a reasonable liter amount (0.1 - 500)
        if (num >= 0.1 && num <= 500) {
          result.totalLiters = num;
        }
      }
    }

    // Extract session (AM/PM)
    const morningKeywords = ['morning', 'umaga', 'am', 'a.m.', 'breakfast', 'early'];
    const eveningKeywords = ['evening', 'gabi', 'hapon', 'pm', 'p.m.', 'afternoon', 'night'];

    if (morningKeywords.some(kw => lowerText.includes(kw))) {
      result.session = 'AM';
    } else if (eveningKeywords.some(kw => lowerText.includes(kw))) {
      result.session = 'PM';
    }

    // Extract animal selection hints (for future use)
    const allKeywords = ['lahat', 'all', 'everyone', 'everybody', 'all lactating'];
    if (allKeywords.some(kw => lowerText.includes(kw))) {
      result.animalSelection = 'all-lactating';
    }

    return result;
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
        variant={state === 'recording' ? 'destructive' : 'ghost'}
        size="icon"
        onClick={handleClick}
        disabled={disabled || state === 'processing' || !isOnline}
        className="h-8 w-8 shrink-0"
        title={!isOnline ? 'Voice input requires internet' : state === 'idle' ? 'Voice input' : 'Stop recording'}
      >
        {state === 'idle' && <Mic className="h-4 w-4" />}
        {state === 'recording' && <Square className="h-4 w-4 animate-pulse" />}
        {state === 'processing' && <Loader2 className="h-4 w-4 animate-spin" />}
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
