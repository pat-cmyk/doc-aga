/**
 * VoiceRecordWithExtraction - Wrapper combining VoiceRecordButton with data extraction
 * 
 * This bridges the unified voice recording system with form-specific data extraction.
 * It wraps VoiceRecordButton and adds:
 * - Data extraction from transcription (milk, feed, text, custom)
 * - Auto-submit logic with countdown and cancel
 * - Extraction preview feedback via toast
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { VoiceRecordButton } from './VoiceRecordButton';
import { 
  runExtractor, 
  type ExtractorType, 
  type ExtractorContext,
  type ExtractedData 
} from '@/lib/voiceFormExtractors';
import { toast } from 'sonner';
import { playSound } from '@/lib/audioFeedback';
import { hapticNotification } from '@/lib/haptics';

export interface VoiceRecordWithExtractionProps<T = Record<string, any>> {
  /** Callback when data is extracted from voice input */
  onDataExtracted: (data: T) => void;
  
  /** Type of extraction to perform */
  extractorType: ExtractorType;
  
  /** Custom extractor function for 'custom' type */
  customExtractor?: (transcription: string, context?: ExtractorContext) => T;
  
  /** Context data for extractors (e.g., animals, feedInventory) */
  extractorContext?: ExtractorContext;
  
  /** Auto-submit configuration */
  autoSubmit?: {
    enabled: boolean;
    delayMs?: number;
    onSubmit: () => void;
    isComplete?: (data: T) => boolean;
  };
  
  /** Button size variant */
  size?: 'sm' | 'md' | 'lg';
  
  /** Button variant */
  variant?: 'default' | 'ghost' | 'outline';
  
  /** Additional CSS classes */
  className?: string;
  
  /** Whether the button is disabled */
  disabled?: boolean;
  
  /** Mode: realtime (ElevenLabs Scribe) or batch (Gemini) */
  mode?: 'realtime' | 'batch';
  
  /** Show live transcript during recording */
  showLiveTranscript?: boolean;
}

export function VoiceRecordWithExtraction<T = Record<string, any>>({
  onDataExtracted,
  extractorType,
  customExtractor,
  extractorContext,
  autoSubmit,
  size = 'sm',
  variant = 'ghost',
  className = '',
  disabled = false,
  mode = 'batch',
  showLiveTranscript = false,
}: VoiceRecordWithExtractionProps<T>) {
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const clearAutoSubmitTimers = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setAutoSubmitCountdown(null);
  }, []);

  /**
   * Handle transcription from VoiceRecordButton
   */
  const handleTranscription = useCallback((transcription: string) => {
    console.log(`[VoiceRecordWithExtraction] Transcription (${extractorType}):`, transcription);

    // Run extractor
    const extractedData = runExtractor(
      transcription,
      extractorType,
      extractorContext,
      customExtractor as any
    ) as T;

    // Check if we got useful data
    const hasData = Object.values(extractedData as object).some(
      v => v !== undefined && v !== null && v !== ''
    );

    if (!hasData) {
      // Give helpful hints
      const hints: Record<ExtractorType, string> = {
        milk: 'Try: "25 liters this morning"',
        feed: 'Try: "10 kilos Napier grass"',
        text: 'Try speaking clearly',
        custom: 'Try speaking clearly',
      };
      toast.info(hints[extractorType] || 'No data extracted');
      return;
    }

    // Pass extracted data to parent
    onDataExtracted(extractedData);
    hapticNotification('success');

    // Build feedback message
    const parts: string[] = [];
    const data = extractedData as Record<string, any>;
    if (data.totalLiters) parts.push(`${data.totalLiters}L`);
    if (data.totalKg) parts.push(`${data.totalKg}kg`);
    if (data.session) parts.push(data.session === 'AM' ? 'Morning' : 'Evening');
    if (data.feedType) parts.push(data.feedType);
    if (data.text) parts.push(data.text.substring(0, 30) + (data.text.length > 30 ? '...' : ''));

    // Show validation warnings if any
    const warnings = data.warnings as string[] | undefined;
    if (warnings && warnings.length > 0) {
      toast.warning(warnings[0], { 
        duration: 6000,
        description: 'Please verify this value is correct.',
      });
    }

    // Transcription preview
    const transcriptionPreview = transcription.length > 60 
      ? transcription.substring(0, 60) + '...' 
      : transcription;

    // Check if auto-submit is enabled and form is complete
    const shouldAutoSubmit = autoSubmit?.enabled && 
      autoSubmit.onSubmit && 
      (autoSubmit.isComplete ? autoSubmit.isComplete(extractedData) : true) &&
      (!warnings || warnings.length === 0);

    if (shouldAutoSubmit) {
      const delayMs = autoSubmit.delayMs || 2500;
      const countdownSeconds = Math.ceil(delayMs / 1000);
      setAutoSubmitCountdown(countdownSeconds);

      // Countdown timer
      let remaining = countdownSeconds;
      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setAutoSubmitCountdown(remaining);
        }
      }, 1000);

      // Auto-submit timer
      autoSubmitTimerRef.current = setTimeout(() => {
        clearAutoSubmitTimers();
        autoSubmit.onSubmit();
        playSound('success');
        toast.success(`Auto-saved: ${parts.join(', ')}`);
      }, delayMs);

      toast.info(`Heard: "${transcriptionPreview}"\nWill save ${parts.join(', ')} in ${countdownSeconds}s`, {
        duration: delayMs,
        action: {
          label: 'Cancel',
          onClick: () => {
            clearAutoSubmitTimers();
            toast.info('Auto-save cancelled');
          },
        },
      });
    } else if (parts.length > 0) {
      // Show what was extracted (no auto-submit)
      toast.success(`Heard: "${transcriptionPreview}"\nExtracted: ${parts.join(', ')}`, {
        duration: 4000,
      });
    } else {
      toast.success('Voice input processed');
    }
  }, [extractorType, extractorContext, customExtractor, onDataExtracted, autoSubmit, clearAutoSubmitTimers]);

  return (
    <VoiceRecordButton
      preferRealtime={mode === 'realtime'}
      size={size}
      variant={variant}
      disabled={disabled}
      className={className}
      onTranscription={handleTranscription}
      showLiveTranscript={showLiveTranscript}
    />
  );
}

// Re-export types for convenience
export type { ExtractorType, ExtractorContext, ExtractedData };
