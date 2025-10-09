import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ActivityConfirmation from './ActivityConfirmation';
import DocAgaConsultation from './DocAgaConsultation';

interface VoiceRecordButtonProps {
  farmId: string;
}

const VoiceRecordButton = ({ farmId }: VoiceRecordButtonProps) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [mode, setMode] = useState<'idle' | 'activity' | 'doc-aga'>('idle');
  const [docAgaQuery, setDocAgaQuery] = useState<string | null>(null);
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

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Recording Started",
        description: "Describe your activity",
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
    }
  };

  const processAudio = async (blob: Blob) => {
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

      // Step 1: Transcribe audio
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });

      if (transcriptError || transcriptData.error) {
        throw new Error(transcriptData?.error || 'Transcription failed');
      }

      if (!transcriptData.text) {
        throw new Error('No transcription returned');
      }

      const transcriptionText = transcriptData.text;
      console.log('Transcription:', transcriptionText);

      // Check if user is calling Dok Aga
      const isDocAgaQuery = /dok\s*aga|doc\s*aga|doktor\s*aga/i.test(transcriptionText);

      if (isDocAgaQuery) {
        // Route to Dok Aga mode
        toast({
          title: "🩺 Connecting to Dok Aga...",
          description: "Opening veterinary consultation"
        });
        setMode('doc-aga');
        setDocAgaQuery(transcriptionText);
      } else {
        // Route to activity logging mode
        toast({
          title: "📝 Processing Activity...",
          description: "Creating your record"
        });

        // Step 2: Process transcription with AI
        const { data: aiData, error: aiError } = await supabase.functions.invoke('process-farmhand-activity', {
          body: { 
            transcription: transcriptionText,
            farmId
          }
        });

        if (aiError || aiData.error) {
          throw new Error(aiData?.error || 'AI processing failed');
        }

        console.log('Extracted data:', aiData);
        setMode('activity');
        setExtractedData(aiData);
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

  const handleCancel = () => {
    setExtractedData(null);
    setMode('idle');
  };

  const handleSuccess = () => {
    setExtractedData(null);
    setMode('idle');
    toast({
      title: "Record Created",
      description: "Activity successfully logged",
    });
  };

  const handleDocAgaClose = () => {
    setDocAgaQuery(null);
    setMode('idle');
  };

  // Show Dok Aga consultation
  if (mode === 'doc-aga' && docAgaQuery) {
    return <DocAgaConsultation initialQuery={docAgaQuery} onClose={handleDocAgaClose} farmId={farmId} />;
  }

  // Show activity confirmation
  if (mode === 'activity' && extractedData) {
    return <ActivityConfirmation data={extractedData} onCancel={handleCancel} onSuccess={handleSuccess} />;
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Record Activity</h2>
          <p className="text-muted-foreground">
            Tap to record your daily tasks like milking, feeding, or health observations
          </p>
        </div>

        {!isRecording && !isProcessing && (
          <Button 
            onClick={startRecording}
            size="lg"
            className="h-32 w-32 rounded-full text-lg"
          >
            <Mic className="h-12 w-12" />
          </Button>
        )}

        {isRecording && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="h-4 w-4 rounded-full bg-destructive animate-pulse" />
              <span className="text-xl font-semibold">Recording...</span>
            </div>
            <Button 
              onClick={stopRecording}
              variant="destructive"
              size="lg"
              className="gap-2"
            >
              <Square className="h-6 w-6" />
              Stop & Process
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Processing your activity...</p>
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground max-w-md">
          <p className="font-medium mb-2">Example:</p>
          <p className="italic">"I just milked cow number 247, got 15 liters"</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceRecordButton;
