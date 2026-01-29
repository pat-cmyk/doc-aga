import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Pencil, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";

interface HealthRecord {
  id: string;
  animal_id: string;
  visit_date: string;
  diagnosis: string | null;
  treatment: string | null;
  notes: string | null;
}

interface EditHealthRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: HealthRecord;
  animalName: string;
  onSuccess?: () => void;
}

export function EditHealthRecordDialog({
  open,
  onOpenChange,
  record,
  animalName,
  onSuccess,
}: EditHealthRecordDialogProps) {
  const [visitDate, setVisitDate] = useState<Date>(new Date(record.visit_date));
  const [diagnosis, setDiagnosis] = useState(record.diagnosis || "");
  const [treatment, setTreatment] = useState(record.treatment || "");
  const [notes, setNotes] = useState(record.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when record changes or dialog opens
  useEffect(() => {
    if (open && record) {
      setVisitDate(new Date(record.visit_date));
      setDiagnosis(record.diagnosis || "");
      setTreatment(record.treatment || "");
      setNotes(record.notes || "");
      hapticImpact('light');
    }
  }, [open, record]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      hapticSelection();
      setVisitDate(date);
    }
  };

  const handleClose = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!diagnosis.trim() && !treatment.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter at least a diagnosis or treatment",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const dateStr = format(visitDate, "yyyy-MM-dd");

    try {
      const { error } = await supabase
        .from("health_records")
        .update({
          visit_date: dateStr,
          diagnosis: diagnosis.trim() || null,
          treatment: treatment.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", record.id);

      if (error) throw error;

      // Invalidate related queries
      await queryClient.invalidateQueries({ 
        queryKey: ['health-records', record.animal_id],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['animal', record.animal_id],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['dashboard'],
      });

      hapticNotification('success');
      toast({
        title: "Record Updated",
        description: "Health record has been updated successfully",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating health record:", error);
      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to update health record",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = diagnosis.trim() || treatment.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Health Record
          </DialogTitle>
          <DialogDescription>
            Update health record for {animalName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Visit Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left min-h-[48px]",
                    !visitDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(visitDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={visitDate}
                  onSelect={handleDateSelect}
                  disabled={(date) =>
                    date > new Date() || date < subDays(new Date(), 365)
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Diagnosis */}
          <div className="space-y-2">
            <Label htmlFor="edit-diagnosis">Diagnosis</Label>
            <Input
              id="edit-diagnosis"
              placeholder="e.g. Mastitis, Foot Rot"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[48px]"
            />
          </div>

          {/* Treatment */}
          <div className="space-y-2">
            <Label htmlFor="edit-treatment">Treatment</Label>
            <Input
              id="edit-treatment"
              placeholder="e.g. Antibiotics, Hoof trimming"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[48px]"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              placeholder="Additional observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[80px]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 min-h-[48px]"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 min-h-[48px]"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
