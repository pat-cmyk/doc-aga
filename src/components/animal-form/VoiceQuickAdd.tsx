/**
 * VoiceQuickAdd - Voice-enabled animal registration component
 * 
 * Uses the unified useVoiceRecording hook for consistent voice handling,
 * but maintains custom preview UI for animal data review.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mic, Square, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MicrophonePermissionDialog } from '@/components/MicrophonePermissionDialog';
import { hapticNotification } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';

export interface ExtractedAnimalData {
  livestock_type: 'cattle' | 'goat' | 'sheep' | 'carabao' | null;
  gender: 'Male' | 'Female' | null;
  ear_tag: string | null;
  name: string | null;
  is_lactating: boolean;
  entry_weight_kg: number | null;
  acquisition_type: 'purchased' | 'grant' | null;
  breed: string | null;
  confidence: 'high' | 'medium' | 'low';
}

interface VoiceQuickAddProps {
  onDataExtracted: (data: ExtractedAnimalData) => void;
  disabled?: boolean;
}

const livestockEmojis: Record<string, string> = {
  cattle: '🐄',
  carabao: '🐃',
  goat: '🐐',
  sheep: '🐑',
};

type ComponentState = 'idle' | 'recording' | 'processing' | 'preview' | 'error';

const VoiceQuickAdd: React.FC<VoiceQuickAddProps> = ({ onDataExtracted, disabled = false }) => {
  const { toast } = useToast();
  const [componentState, setComponentState] = useState<ComponentState>('idle');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedAnimalData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Process transcription to extract animal data
  const processTranscription = useCallback(async (text: string) => {
    setTranscription(text);
    setComponentState('processing');
    
    try {
      // Call edge function to extract animal data
      const { data: extractData, error: extractError } = await supabase.functions.invoke('process-animal-voice', {
        body: { transcription: text }
      });

      if (extractError || extractData?.error) {
        throw new Error(extractData?.error || 'Failed to process voice command');
      }

      if (extractData?.data) {
        setExtractedData(extractData.data);
        setComponentState('preview');
        hapticNotification('success');
      } else {
        throw new Error('Could not understand the voice command');
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      setComponentState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Processing failed');
      hapticNotification('error');
    }
  }, []);

  // Use the unified voice recording hook
  const {
    state: voiceState,
    startRecording,
    stopRecording,
    reset: resetVoice,
    isRecording,
    isProcessingAudio,
    stateLabel,
  } = useVoiceRecording({
    preferRealtime: false, // Use batch mode for animal registration
    onTranscription: processTranscription,
    onError: (error) => {
      if (error.message.includes('denied') || error.message.includes('permission')) {
        setShowPermissionDialog(true);
      } else {
        setComponentState('error');
        setErrorMessage(error.message);
      }
    },
  });

  // Sync component state with voice recording state
  React.useEffect(() => {
    if (voiceState === 'recording' || voiceState === 'connecting') {
      setComponentState('recording');
    } else if (voiceState === 'processing' || voiceState === 'stopping') {
      setComponentState('processing');
    }
  }, [voiceState]);

  const handleStartRecording = () => {
    setErrorMessage('');
    setExtractedData(null);
    setTranscription('');
    startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleApply = () => {
    if (extractedData) {
      onDataExtracted(extractedData);
      hapticNotification('success');
      toast({
        title: "Form Auto-filled!",
        description: "Review the details and click 'Add Animal'",
      });
      resetState();
    }
  };

  const resetState = () => {
    setComponentState('idle');
    setTranscription('');
    setExtractedData(null);
    setErrorMessage('');
    resetVoice();
  };

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    }
  };

  const renderPreviewContent = () => {
    if (!extractedData) return null;

    const fields = [
      extractedData.livestock_type && `${livestockEmojis[extractedData.livestock_type] || '🐄'} ${extractedData.livestock_type}`,
      extractedData.gender,
      extractedData.ear_tag && `Tag: ${extractedData.ear_tag}`,
      extractedData.is_lactating && 'Lactating',
      extractedData.entry_weight_kg && `${extractedData.entry_weight_kg}kg`,
      extractedData.breed,
    ].filter(Boolean);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Detected</span>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            getConfidenceBadgeColor(extractedData.confidence)
          )}>
            {extractedData.confidence} confidence
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {fields.map((field, idx) => (
            <span 
              key={idx}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-sm bg-primary/10 text-primary font-medium"
            >
              {field}
            </span>
          ))}
        </div>

        {transcription && (
          <p className="text-xs text-muted-foreground italic">
            "{transcription}"
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <MicrophonePermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
        onRetry={() => {
          setShowPermissionDialog(false);
          handleStartRecording();
        }}
      />

      <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          {componentState === 'idle' && (
            <Button
              onClick={handleStartRecording}
              disabled={disabled}
              variant="outline"
              className="w-full h-14 gap-3 text-base font-medium border-primary/30 hover:bg-primary/10 hover:border-primary"
            >
              <Mic className="h-5 w-5 text-primary" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">Speak to Add</span>
                <span className="text-xs text-muted-foreground">Magsalita para Magdagdag</span>
              </div>
            </Button>
          )}

          {componentState === 'recording' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-destructive animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-destructive">{stateLabel}</span>
                  <span className="text-xs text-muted-foreground">Nakikinig...</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: "Add female cow, ear tag A005, currently milking"
              </p>
              <Button
                onClick={handleStopRecording}
                variant="destructive"
                className="w-full h-12 gap-2"
              >
                <Square className="h-4 w-4" />
                <span>Stop Recording</span>
              </Button>
            </div>
          )}

          {componentState === 'processing' && (
            <div className="flex items-center justify-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Understanding...</span>
                <span className="text-xs text-muted-foreground">Pinoproseso...</span>
              </div>
            </div>
          )}

          {componentState === 'preview' && extractedData && (
            <div className="space-y-4">
              {renderPreviewContent()}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={resetState}
                  className="flex-1 h-12"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleApply}
                  className="flex-1 h-12"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Apply to Form
                </Button>
              </div>
            </div>
          )}

          {componentState === 'error' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium">{errorMessage}</span>
              </div>
              <Button
                onClick={resetState}
                variant="outline"
                className="w-full h-12"
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default VoiceQuickAdd;
