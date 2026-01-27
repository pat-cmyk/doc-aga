import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, Loader2, Volume2 } from "lucide-react";
import { useFarmerFeedback } from "@/hooks/useFarmerFeedback";
import { useFeedbackNotifications } from "@/hooks/useFeedbackNotifications";
import { toast } from "sonner";
import { VoiceRecordButton } from "@/components/ui/VoiceRecordButton";

interface GovernmentConnectTabProps {
  farmId: string;
}

export const GovernmentConnectTab = ({ farmId }: GovernmentConnectTabProps) => {
  const [transcription, setTranscription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { submitFeedback, isSubmitting } = useFarmerFeedback(farmId);
  
  // Enable real-time notifications
  useFeedbackNotifications(farmId);

  const handleVoiceTranscription = (text: string) => {
    // Append to existing transcription
    setTranscription(prev => prev ? `${prev} ${text}` : text);
  };

  const handleSubmit = () => {
    if (!transcription.trim()) {
      toast.error("Walang laman ang feedback");
      return;
    }

    submitFeedback({
      farmId,
      transcription,
      isAnonymous,
    });

    setTranscription("");
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="flex items-start gap-4">
          <Volume2 className="h-8 w-8 text-primary flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Boses ng Magsasaka</h3>
            <p className="text-sm text-muted-foreground">
              Direktang iparating ang inyong mga hinaing, mungkahi, o pangangailangan sa gobyerno. 
              Gamitin ang inyong boses o mag-type ng mensahe.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <VoiceRecordButton
              size="lg"
              variant="default"
              preferRealtime={false}
              showLabel
              showLiveTranscript
              onTranscription={handleVoiceTranscription}
              idleLabel="Magsalita"
              recordingLabel="Ihinto"
              className="flex-col"
            />
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Pindutin ang mikropono para magsimula ng pag-record
          </div>

          <div className="relative">
            <Textarea
              placeholder="O mag-type ng inyong mensahe dito..."
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
            <Label htmlFor="anonymous" className="text-sm">
              Isumite nang anonymous (hindi makikita ang inyong pangalan)
            </Label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!transcription.trim() || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sinusubmit...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Isumite ang Feedback
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-4 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          <strong>Paalala:</strong> Ang lahat ng feedback ay direktang papunta sa Department of Agriculture. 
          Makikita ninyo ang status ng inyong submission sa "My Submissions" tab.
        </p>
      </Card>
    </div>
  );
};
