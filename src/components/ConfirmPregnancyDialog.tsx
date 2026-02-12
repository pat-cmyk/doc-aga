import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { insertBreedingEvent } from "@/lib/breedingEventBridge";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";
import { GESTATION_DAYS } from "@/types/fertility";

interface ConfirmPregnancyDialogProps {
  recordId: string;
  animalId: string;
  farmId: string;
  livestockType?: string;
  performedDate: string | null;
  onSuccess: () => void;
}

const ConfirmPregnancyDialog = ({ recordId, animalId, farmId, livestockType = 'cattle', performedDate, onSuccess }: ConfirmPregnancyDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Use species-specific gestation (GAP 8 fix)
  const gestationDays = GESTATION_DAYS[livestockType] || 283;
  const expectedDeliveryDate = performedDate 
    ? addDays(new Date(performedDate), gestationDays).toISOString().split('T')[0]
    : "";

  const handleConfirm = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from("ai_records")
        .update({
          pregnancy_confirmed: true,
          expected_delivery_date: expectedDeliveryDate,
          confirmed_at: new Date().toISOString()
        })
        .eq("id", recordId);

      if (error) throw error;

      // Bridge to breeding_events state machine (GAP 1 fix)
      await insertBreedingEvent({
        animalId,
        farmId,
        eventType: 'pregnancy_confirmed',
        eventDate: new Date().toISOString(),
        relatedAiRecordId: recordId,
        metadata: { expected_delivery_date: expectedDeliveryDate, gestation_days: gestationDays },
      });

      toast({
        title: "Pregnancy Confirmed!",
        description: `Expected delivery date: ${new Date(expectedDeliveryDate).toLocaleDateString()}`
      });

      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CheckCircle className="h-4 w-4 mr-2" />
          Confirm Pregnancy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Pregnancy</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>AI Performed Date</Label>
            <p className="text-sm font-medium mt-1">
              {performedDate ? new Date(performedDate).toLocaleDateString() : "Not set"}
            </p>
          </div>
          <div>
            <Label>Expected Delivery Date</Label>
            <p className="text-sm font-medium mt-1">
              {expectedDeliveryDate ? new Date(expectedDeliveryDate).toLocaleDateString() : "Not available"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {gestationDays} days gestation period ({livestockType})
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={loading || !performedDate}>
              {loading ? "Confirming..." : "Confirm Pregnancy"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmPregnancyDialog;