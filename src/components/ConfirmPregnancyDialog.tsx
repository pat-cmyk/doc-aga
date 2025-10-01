import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";

interface ConfirmPregnancyDialogProps {
  recordId: string;
  performedDate: string | null;
  onSuccess: () => void;
}

const ConfirmPregnancyDialog = ({ recordId, performedDate, onSuccess }: ConfirmPregnancyDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Calculate expected delivery date (283 days gestation period for cattle)
  const expectedDeliveryDate = performedDate 
    ? addDays(new Date(performedDate), 283).toISOString().split('T')[0]
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
              Based on 283 days gestation period
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