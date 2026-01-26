import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface TranscriptionCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalText: string;
  farmId?: string;
  context?: string;
  audioDuration?: number;
  /** Called when correction is submitted - optionally receives corrected text */
  onCorrectionSubmitted?: (correctedText?: string) => void;
}

export function TranscriptionCorrectionDialog({
  open,
  onOpenChange,
  originalText,
  farmId,
  context,
  audioDuration,
  onCorrectionSubmitted,
}: TranscriptionCorrectionDialogProps) {
  const [correctedText, setCorrectedText] = useState(originalText);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Reset corrected text when original changes
  useEffect(() => {
    setCorrectedText(originalText);
  }, [originalText]);

  const handleSubmit = async () => {
    if (!correctedText.trim()) {
      toast({
        title: "Error",
        description: "Corrected text cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (correctedText === originalText) {
      toast({
        title: "No changes",
        description: "The text hasn't been modified",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('submit-correction', {
        body: {
          originalText,
          correctedText,
          farmId,
          context,
          audioDuration,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Thank you! Your correction helps improve our voice recognition.",
      });

      onCorrectionSubmitted?.(correctedText);
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting correction:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit correction",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseOriginal = () => {
    onCorrectionSubmitted?.(originalText);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Correct Transcription</DialogTitle>
          <DialogDescription>
            Help us improve voice recognition by correcting any errors in the transcription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Original:</label>
            <p className="mt-1 p-3 bg-muted rounded-md text-sm">{originalText}</p>
          </div>

          <div>
            <label htmlFor="correction" className="text-sm font-medium">
              Corrected text:
            </label>
            <Textarea
              id="correction"
              value={correctedText}
              onChange={(e) => setCorrectedText(e.target.value)}
              className="mt-1 min-h-[100px]"
              placeholder="Enter the correct transcription..."
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleUseOriginal}
            disabled={isSubmitting}
          >
            Use Original
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}