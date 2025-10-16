import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ActivityConfirmation from './ActivityConfirmation';
import DocAgaConsultation from './DocAgaConsultation';

interface VoiceRecordButtonProps {
  farmId: string;
  animalId?: string | null;
}

const VoiceRecordButton = ({ farmId, animalId }: VoiceRecordButtonProps) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [mode, setMode] = useState<'idle' | 'activity' | 'doc-aga'>('idle');
  const [docAgaQuery, setDocAgaQuery] = useState<string | null>(null);
  const [animalContext, setAnimalContext] = useState<{ name: string; ear_tag: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load animal context when animalId changes
  useEffect(() => {
    const loadAnimalContext = async () => {
      if (!animalId) {
        setAnimalContext(null);
        return;
      }
      
      const { data } = await supabase
        .from('animals')
        .select('name, ear_tag')
        .eq('id', animalId)
        .single();
      
      if (data) {
        setAnimalContext(data);
      }
    };

    loadAnimalContext();
  }, [animalId]);

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
            farmId,
            animalId: animalId || undefined
          }
        });

        if (aiError) {
          throw new Error('AI processing failed');
        }

        // Handle clarification requests
        if (aiData?.error === 'NEEDS_CLARIFICATION') {
          const options = aiData.availableOptions || [];
          const optionsList = options.length > 0 
            ? `Available options: ${options.join(', ')}` 
            : 'No feed types found in inventory for this unit.';
          
          throw new Error(`${aiData.message}. ${optionsList}`);
        }

        if (aiData?.error) {
          throw new Error(aiData.error);
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
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4">
      {animalContext && (
        <div className="bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-full px-4 py-2 animate-in fade-in slide-in-from-top-2">
          <p className="text-sm font-medium text-primary">
            Recording for: {animalContext.name || `Tag #${animalContext.ear_tag}`}
          </p>
        </div>
      )}

      {!isRecording && !isProcessing && (
        <Button 
          onClick={startRecording}
          size="lg"
          variant="destructive"
          className="h-20 w-20 rounded-full shadow-lg hover:shadow-xl transition-shadow"
        >
          <Mic className="h-10 w-10" />
        </Button>
      )}

      {isRecording && (
        <div className="flex flex-col items-center gap-4 bg-card p-6 rounded-2xl shadow-xl border border-primary/20">
          <div className="flex items-center gap-3 text-destructive">
            <div className="h-4 w-4 rounded-full bg-destructive animate-pulse" />
            <span className="text-lg font-semibold">Recording...</span>
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
        <div className="flex flex-col items-center gap-3 bg-card p-6 rounded-2xl shadow-xl border border-primary/20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Processing...</p>
        </div>
      )}
    </div>
  );
};

export default VoiceRecordButton;
