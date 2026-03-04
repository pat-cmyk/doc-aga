import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { insertBreedingEvent } from "@/lib/breedingEventBridge";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { playSound } from "@/lib/audioFeedback";
import { hapticNotification } from "@/lib/haptics";

interface ScheduleAIDialogProps {
  animalId: string;
  farmId?: string;
  onSuccess: () => void;
  disabled?: boolean;
}

export function ScheduleAIDialog({ animalId, farmId, onSuccess, disabled }: ScheduleAIDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [technician, setTechnician] = useState("");
  const [semenCode, setSemenCode] = useState("");
  const [bullBreed, setBullBreed] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!scheduledDate) {
      toast({
        title: "Required field",
        description: "Please select a scheduled date",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Build structured notes with bull breed for AI father detection
      let formattedNotes = '';
      if (semenCode || bullBreed) {
        const parts: string[] = [];
        if (semenCode) parts.push(`Brand: ${semenCode}`);
        if (bullBreed) parts.push(`Breed: ${bullBreed}`);
        formattedNotes = parts.join(' | ');
        if (notes) formattedNotes += ` | ${notes}`;
      } else {
        formattedNotes = notes;
      }

      const { data: insertedData, error } = await supabase.from("ai_records").insert({
        animal_id: animalId,
        scheduled_date: scheduledDate,
        technician: technician || null,
        semen_code: semenCode || null,
        notes: formattedNotes || null,
        created_by: user?.id
      }).select('id').single();

      if (error) throw error;

      // Bridge to breeding_events state machine (GAP 1 fix)
      if (farmId && insertedData) {
        await insertBreedingEvent({
          animalId,
          farmId,
          eventType: 'ai_scheduled',
          eventDate: scheduledDate,
          relatedAiRecordId: insertedData.id,
          notes: notes || undefined,
        });
      }

      playSound('success');
      hapticNotification('success');
      toast({
        title: "Success!",
        description: "AI breeding scheduled successfully"
      });

      setOpen(false);
      setScheduledDate("");
      setTechnician("");
      setSemenCode("");
      setBullBreed("");
      setNotes("");
      onSuccess();
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "scheduling AI breeding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm"
          disabled={disabled}
          title={disabled ? "Available when online" : ""}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Schedule AI
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule AI Breeding</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="scheduled_date">Scheduled Date *</Label>
            <Input
              id="scheduled_date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="technician">Technician</Label>
            <Input
              id="technician"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              placeholder="Enter technician name"
            />
          </div>
          <div>
            <Label htmlFor="semen_code">Semen Code</Label>
            <Input
              id="semen_code"
              value={semenCode}
              onChange={(e) => setSemenCode(e.target.value)}
              placeholder="Enter semen code/batch number"
            />
          </div>
          <div>
            <Label htmlFor="bull_breed">Bull Breed</Label>
            <Input
              id="bull_breed"
              value={bullBreed}
              onChange={(e) => setBullBreed(e.target.value)}
              placeholder="e.g. Holstein, Angus (for AI father detection)"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <div className="flex gap-2">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                className="flex-1"
              />
              <VoiceInputButton
                onTranscription={(text) => setNotes(prev => prev ? `${prev} ${text}` : text)}
                disabled={!isOnline}
                className="self-start"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}