import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Loader2 } from "lucide-react";

interface MarkAIPerformedDialogProps {
  recordId: string;
  scheduledDate: string | null;
  onSuccess: () => void;
}

const MarkAIPerformedDialog = ({ recordId, scheduledDate, onSuccess }: MarkAIPerformedDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [performedDate, setPerformedDate] = useState("");
  const [semenCode, setSemenCode] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!performedDate) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }

    setLoading(true);
    const updateData: { performed_date: string; semen_code?: string } = { 
      performed_date: performedDate 
    };
    if (semenCode) {
      updateData.semen_code = semenCode;
    }
    const { error } = await supabase
      .from("ai_records")
      .update(updateData)
      .eq("id", recordId);

    setLoading(false);

    if (error) {
      console.error('Update AI record error:', error);
      toast({ title: "Error", description: "Unable to update AI record. Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "AI breeding marked as performed" });
      setOpen(false);
      setPerformedDate("");
      setSemenCode("");
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark as Performed
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark AI Breeding as Performed</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="performedDate">Performed Date</Label>
            <Input
              id="performedDate"
              type="date"
              value={performedDate}
              onChange={(e) => setPerformedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              min={scheduledDate || undefined}
            />
            {scheduledDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Scheduled: {new Date(scheduledDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="semenCode">Semen Code (Optional)</Label>
            <Input
              id="semenCode"
              value={semenCode}
              onChange={(e) => setSemenCode(e.target.value)}
              placeholder="Enter semen code if not set at scheduling"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !performedDate}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MarkAIPerformedDialog;
