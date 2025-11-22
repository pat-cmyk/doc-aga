import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mic, Send, Loader2, Volume2 } from "lucide-react";
import { useFarmerFeedback } from "@/hooks/useFarmerFeedback";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GovernmentConnectTabProps {
  farmId: string;
}

export const GovernmentConnectTab = ({ farmId }: GovernmentConnectTabProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const { submitFeedback, isSubmitting } = useFarmerFeedback(farmId);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
      toast.info("Nagsisimula nang mag-record...");
    } catch (error) {
      toast.error("Hindi ma-access ang microphone");
      console.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          throw new Error('Failed to process audio');
        }

        // Call voice-to-text function
        const { data, error } = await supabase.functions.invoke('voice-to-text', {
          body: { audio: base64Audio }
        });

        if (error) throw error;

        setTranscription(data.text);
        toast.success("Na-transcribe na ang iyong mensahe");
      };
    } catch (error) {
      toast.error("Hindi ma-process ang audio");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
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
            {isRecording || isProcessing ? (
              <Button
                size="lg"
                variant={isRecording ? "destructive" : "secondary"}
                className="h-24 w-24 rounded-full"
                onClick={stopRecording}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="default"
                className="h-24 w-24 rounded-full"
                onClick={startRecording}
              >
                <Mic className="h-8 w-8" />
              </Button>
            )}
          </div>

          <div className="text-center text-sm text-muted-foreground">
            {isRecording && "Nag-rerecord... Pindutin ulit para ihinto"}
            {isProcessing && "Pinoproseso ang audio..."}
            {!isRecording && !isProcessing && "Pindutin ang mikropono para magsimula"}
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
