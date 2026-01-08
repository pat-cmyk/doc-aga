import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MicrophonePermissionDialog } from "@/components/MicrophonePermissionDialog";
import { cn } from "@/lib/utils";

interface FeedInventoryItem {
  id: string;
  feed_type: string;
}

interface ExtractedFeedData {
  totalKg?: number;
  feedType?: string;
  animalSelection?: string;
}

interface VoiceFeedInputProps {
  feedInventory: FeedInventoryItem[];
  onDataExtracted: (data: ExtractedFeedData) => void;
  disabled?: boolean;
  className?: string;
}

type RecordingState = "idle" | "recording" | "processing";

const FRESH_CUT_OPTION = "Fresh Cut and Carry";

export function VoiceFeedInput({
  feedInventory,
  onDataExtracted,
  disabled = false,
  className,
}: VoiceFeedInputProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        processAudio(audioBlob);
      };

      mediaRecorder.start();
      setRecordingState("recording");
    } catch (error: any) {
      if (error.name === "NotAllowedError") {
        setShowPermissionDialog(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to start recording",
          variant: "destructive",
        });
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
      setRecordingState("processing");

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      const base64Audio = await blobToBase64(audioBlob);

      const { data, error } = await supabase.functions.invoke("voice-to-text", {
        body: { audio: base64Audio },
      });

      if (error) throw error;

      const transcription = data?.text || "";
      if (transcription) {
        const extractedData = parseTranscription(transcription);
        onDataExtracted(extractedData);
        
        // Build description of what was extracted
        const parts: string[] = [];
        if (extractedData.totalKg) parts.push(`${extractedData.totalKg}kg`);
        if (extractedData.feedType) parts.push(extractedData.feedType === FRESH_CUT_OPTION ? "Fresh Cut" : extractedData.feedType);
        if (extractedData.animalSelection) parts.push(extractedData.animalSelection);
        
        toast({
          title: "Voice Captured",
          description: parts.length > 0 
            ? `Extracted: ${parts.join(", ")}` 
            : `"${transcription.slice(0, 50)}..."`,
        });
      } else {
        toast({
          title: "No Speech Detected",
          description: "Please try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Voice processing error:", error);
      toast({
        title: "Processing Failed",
        description: "Could not process voice input",
        variant: "destructive",
      });
    } finally {
      setRecordingState("idle");
    }
  };

  const parseTranscription = (text: string): ExtractedFeedData => {
    const result: ExtractedFeedData = {};
    const lowerText = text.toLowerCase();

    // Extract kilograms - patterns: "15 kg", "10 kilos", "20 kilogram", "5 kilo"
    const kgPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)/i,
      /(?:kg|kilos?|kilograms?)\s*(\d+(?:\.\d+)?)/i,
    ];
    
    for (const pattern of kgPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.totalKg = parseFloat(match[1]);
        break;
      }
    }

    // Check for Fresh Cut and Carry
    if (
      lowerText.includes("fresh cut") ||
      lowerText.includes("cut and carry") ||
      lowerText.includes("freshcut") ||
      lowerText.includes("damo") || // Tagalog for grass
      lowerText.includes("fresh grass")
    ) {
      result.feedType = FRESH_CUT_OPTION;
    } else {
      // Match against inventory items
      for (const item of feedInventory) {
        const feedTypeLower = item.feed_type.toLowerCase();
        if (lowerText.includes(feedTypeLower)) {
          result.feedType = item.id;
          break;
        }
        // Check for common feed type keywords
        if (feedTypeLower.includes("napier") && lowerText.includes("napier")) {
          result.feedType = item.id;
          break;
        }
        if (feedTypeLower.includes("hay") && lowerText.includes("hay")) {
          result.feedType = item.id;
          break;
        }
        if (feedTypeLower.includes("concentrate") && (lowerText.includes("concentrate") || lowerText.includes("feeds"))) {
          result.feedType = item.id;
          break;
        }
        if (feedTypeLower.includes("silage") && lowerText.includes("silage")) {
          result.feedType = item.id;
          break;
        }
      }
    }

    // Parse animal selection - Tagalog and English keywords
    if (
      lowerText.includes("all animals") ||
      lowerText.includes("lahat") ||
      lowerText.includes("everyone") ||
      lowerText.includes("all")
    ) {
      result.animalSelection = "all";
    } else if (
      lowerText.includes("goat") ||
      lowerText.includes("kambing")
    ) {
      result.animalSelection = "goat";
    } else if (
      lowerText.includes("cattle") ||
      lowerText.includes("baka") ||
      lowerText.includes("cow")
    ) {
      result.animalSelection = "cattle";
    } else if (
      lowerText.includes("carabao") ||
      lowerText.includes("kalabaw")
    ) {
      result.animalSelection = "carabao";
    } else if (
      lowerText.includes("lactating") ||
      lowerText.includes("milking") ||
      lowerText.includes("nagpapasuso")
    ) {
      result.animalSelection = "lactating";
    }

    return result;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleClick = () => {
    if (recordingState === "idle") {
      startRecording();
    } else if (recordingState === "recording") {
      stopRecording();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={recordingState === "recording" ? "destructive" : "outline"}
        size="icon"
        onClick={handleClick}
        disabled={disabled || recordingState === "processing"}
        className={cn(
          "shrink-0",
          recordingState === "recording" && "animate-pulse",
          className
        )}
        title={
          recordingState === "idle"
            ? "Voice input"
            : recordingState === "recording"
            ? "Stop recording"
            : "Processing..."
        }
      >
        {recordingState === "idle" && <Mic className="h-4 w-4" />}
        {recordingState === "recording" && <Square className="h-4 w-4" />}
        {recordingState === "processing" && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
      </Button>

      <MicrophonePermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
        onRetry={startRecording}
      />
    </>
  );
}
