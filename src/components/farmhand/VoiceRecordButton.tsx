import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Loader2, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ActivityConfirmation from './ActivityConfirmation';
import DocAgaConsultation from './DocAgaConsultation';
import AnimalSelectionStep from './AnimalSelectionStep';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addToQueue } from '@/lib/offlineQueue';
import { compressAudio } from '@/lib/audioCompression';
import { getOfflineMessage } from '@/lib/errorMessages';
import { getCachedAnimalDetails } from '@/lib/dataCache';
import { TranscriptionCorrectionDialog } from '@/components/TranscriptionCorrectionDialog';

interface VoiceRecordButtonProps {
  farmId: string;
  animalId?: string | null;
}

const VoiceRecordButton = ({ farmId, animalId }: VoiceRecordButtonProps) => {
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [mode, setMode] = useState<'idle' | 'activity' | 'doc-aga' | 'select-animal'>('idle');
  const [docAgaQuery, setDocAgaQuery] = useState<string | null>(null);
  const [animalContext, setAnimalContext] = useState<{ 
    name: string; 
    ear_tag: string;
    gender?: string;
    breed?: string;
    birth_date?: string;
    life_stage?: string;
  } | null>(null);
  const [needsAnimalSelection, setNeedsAnimalSelection] = useState(false);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [lastTranscription, setLastTranscription] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Resilient animalId fallback from URL if prop not provided
  const effectiveAnimalId = animalId || (() => {
    const pathname = window.location.pathname;
    const match = pathname.match(/\/animals\/([a-f0-9-]+)/);
    return match ? match[1] : undefined;
  })();

  // Load animal context - offline-safe
  useEffect(() => {
    const loadAnimalContext = async () => {
      if (!effectiveAnimalId || !farmId) {
        setAnimalContext(null);
        return;
      }

      try {
        if (!isOnline) {
          // Offline: use cache
          console.info('[VoiceRecord] Loading animal context from cache (offline)');
          const cached = await getCachedAnimalDetails(effectiveAnimalId, farmId);
          if (cached?.animal) {
            setAnimalContext({
              name: cached.animal.name || '',
              ear_tag: cached.animal.ear_tag || '',
              gender: cached.animal.gender || undefined,
              breed: cached.animal.breed || undefined,
              birth_date: cached.animal.birth_date || undefined,
              life_stage: cached.animal.life_stage || undefined,
            });
          }
        } else {
          // Online: fetch from backend with cache fallback
          const { data, error } = await supabase
            .from('animals')
            .select('name, ear_tag, gender, breed, birth_date, life_stage')
            .eq('id', effectiveAnimalId)
            .single();

          if (error) throw error;
          
          if (data) {
            setAnimalContext({
              name: data.name || '',
              ear_tag: data.ear_tag || '',
              gender: data.gender || undefined,
              breed: data.breed || undefined,
              birth_date: data.birth_date || undefined,
              life_stage: data.life_stage || undefined,
            });
          }
        }
      } catch (error) {
        console.error('[VoiceRecord] Error loading animal context:', error);
        // Fallback to cache on error
        try {
          const cached = await getCachedAnimalDetails(effectiveAnimalId, farmId);
          if (cached?.animal) {
            setAnimalContext({
              name: cached.animal.name || '',
              ear_tag: cached.animal.ear_tag || '',
              gender: cached.animal.gender || undefined,
              breed: cached.animal.breed || undefined,
              birth_date: cached.animal.birth_date || undefined,
              life_stage: cached.animal.life_stage || undefined,
            });
          }
        } catch (cacheError) {
          console.error('[VoiceRecord] Cache fallback also failed:', cacheError);
        }
      }
    };

    loadAnimalContext();
  }, [effectiveAnimalId, farmId, isOnline]);

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
      // If offline, compress and queue the audio
      if (!isOnline) {
        const compressedBlob = await compressAudio(blob);
        
        console.info('[VoiceRecord] Enqueuing offline:', { 
          hasAnimalContext: !!animalContext, 
          animalId: effectiveAnimalId 
        });
        
        await addToQueue({
          id: crypto.randomUUID(),
          type: 'voice_activity',
          payload: {
            audioBlob: compressedBlob,
            farmId,
            animalId: effectiveAnimalId || null,
            animalContext: animalContext || null,
            timestamp: Date.now(),
          },
          createdAt: Date.now(),
        });

        toast({
          title: "Voice Activity Saved ✅",
          description: getOfflineMessage('voice_activity'),
          duration: 5000,
        });

        setIsProcessing(false);
        return;
      }

      // Online: Normal processing
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
      
      // Store transcription for potential correction
      setLastTranscription(transcriptionText);

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
        console.info('[VoiceRecord] Processing online:', { 
          hasAnimalContext: !!animalContext, 
          animalId: effectiveAnimalId 
        });
        
        const { data: aiData, error: aiError } = await supabase.functions.invoke('process-farmhand-activity', {
          body: { 
            transcription: transcriptionText,
            farmId,
            animalId: effectiveAnimalId || undefined,
            animalContext: animalContext || undefined
          }
        });

        if (aiError) {
          throw new Error('AI processing failed');
        }

        // Handle clarification requests - show helpful toast instead of error
        if (aiData?.error === 'NEEDS_CLARIFICATION') {
          const options = aiData.availableOptions || [];
          const optionsList = options.length > 0 
            ? ` Available options: ${options.join(', ')}` 
            : '';
          
          toast({
            title: "Please Clarify",
            description: aiData.message + optionsList,
            variant: "default",
            duration: 8000, // Longer duration for clarification
          });
          setIsProcessing(false);
          return; // Gracefully handle without throwing
        }

        if (aiData?.error) {
          throw new Error(aiData.error);
        }

        console.log('Extracted data:', aiData);

        // Check if activity was queued for approval (farmhand approval workflow)
        if (aiData?.queued === true) {
          const autoApproveInfo = aiData.auto_approve_at 
            ? `Will auto-approve by ${new Date(aiData.auto_approve_at).toLocaleString()}`
            : 'Your manager will review it soon.';
          
          toast({
            title: "Activity Submitted for Approval ✅",
            description: `Your ${aiData.activity_type || 'activity'} has been queued. ${autoApproveInfo}`,
          });
          setIsProcessing(false);
          return;
        }

        // Check if activity requires animal but none was identified
        const requiresAnimal = ['weight_measurement', 'milking', 'health_observation', 'injection'].includes(aiData.activity_type);
        if (requiresAnimal && !aiData.animal_id && aiData.needs_animal_selection) {
          setMode('select-animal');
          setNeedsAnimalSelection(true);
          setExtractedData(aiData);
          return;
        }

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
    
    // Offer correction option after successful activity logging
    if (lastTranscription) {
      setTimeout(() => {
        setShowCorrectionDialog(true);
      }, 500);
    }
  };

  const handleDocAgaClose = () => {
    setDocAgaQuery(null);
    setMode('idle');
  };

  const handleAnimalSelected = async (selections: Array<{ livestock_type: string; selection: 'ALL' | string[] }>) => {
    if (!extractedData) return;

    try {
      // Process each livestock type selection
      const distributionsByType = await Promise.all(
        selections.map(async ({ livestock_type, selection }) => {
          let animals = [];
          
          if (selection === 'ALL') {
            // Fetch all milking animals of this type
            const { data } = await supabase
              .from('animals')
              .select('id, ear_tag, name, current_weight_kg, livestock_type, milking_stage')
              .eq('farm_id', farmId)
              .eq('livestock_type', livestock_type)
              .in('milking_stage', ['Early Lactation', 'Mid-Lactation', 'Late Lactation'])
              .eq('is_deleted', false);
            animals = data || [];
          } else {
            // Fetch selected animals
            const { data } = await supabase
              .from('animals')
              .select('id, ear_tag, name, current_weight_kg, livestock_type, milking_stage')
              .in('id', selection)
              .eq('is_deleted', false);
            animals = data || [];
          }
          
          if (animals.length === 0) {
            throw new Error(`No animals found for ${livestock_type}`);
          }

          // Calculate distribution for this type
          const totalWeight = animals.reduce((sum, a) => sum + (a.current_weight_kg || 0), 0);
          const distributions = animals.map(animal => ({
            animal_id: animal.id,
            animal_name: animal.name || `Tag ${animal.ear_tag}`,
            ear_tag: animal.ear_tag,
            livestock_type: animal.livestock_type,
            weight_kg: animal.current_weight_kg || 0,
            milking_stage: animal.milking_stage,
            proportion: totalWeight > 0 ? (animal.current_weight_kg || 0) / totalWeight : 1 / animals.length,
            milk_liters: totalWeight > 0 
              ? ((animal.current_weight_kg || 0) / totalWeight) * extractedData.quantity
              : extractedData.quantity / animals.length
          }));
          
          return {
            livestock_type,
            animals: animals.length,
            distributions
          };
        })
      );

      const newExtractedData = {
        ...extractedData,
        is_bulk_milking: true,
        distributions_by_type: distributionsByType,
        total_types: distributionsByType.length,
        total_animals: distributionsByType.reduce((sum, d) => sum + d.animals, 0)
      };

      setExtractedData(newExtractedData);
      setMode('activity');
      setNeedsAnimalSelection(false);
    } catch (error) {
      console.error('Error handling animal selection:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not process animal selection",
        variant: "destructive",
      });
    }
  };

  // Show Dok Aga consultation
  if (mode === 'doc-aga' && docAgaQuery) {
    return <DocAgaConsultation initialQuery={docAgaQuery} onClose={handleDocAgaClose} farmId={farmId} />;
  }

  // Show animal selection step
  if (mode === 'select-animal' && extractedData && needsAnimalSelection) {
    return (
      <AnimalSelectionStep
        activityType={extractedData.activity_type}
        extractedData={extractedData}
        farmId={farmId}
        detectedLivestockType={extractedData.livestock_type}
        onAnimalSelected={handleAnimalSelected}
        onCancel={handleCancel}
      />
    );
  }

  // Show activity confirmation
  if (mode === 'activity' && extractedData) {
    return <ActivityConfirmation data={extractedData} onCancel={handleCancel} onSuccess={handleSuccess} />;
  }

  return (
    <>
      <TranscriptionCorrectionDialog
        open={showCorrectionDialog}
        onOpenChange={setShowCorrectionDialog}
        originalText={lastTranscription}
        farmId={farmId}
        context="voice_recording"
        onCorrectionSubmitted={() => {
          toast({
            title: "Thank you!",
            description: "Your feedback helps improve voice recognition",
          });
        }}
      />
      
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
    </>
  );
};

export default VoiceRecordButton;
