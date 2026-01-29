import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays, addDays } from "date-fns";
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

interface AIRecord {
  id: string;
  animal_id: string;
  scheduled_date: string | null;
  performed_date: string | null;
  technician: string | null;
  semen_code: string | null;
  notes: string | null;
  pregnancy_confirmed: boolean | null;
}

interface EditAIRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: AIRecord;
  animalName: string;
  onSuccess?: () => void;
}

export function EditAIRecordDialog({
  open,
  onOpenChange,
  record,
  animalName,
  onSuccess,
}: EditAIRecordDialogProps) {
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    record.scheduled_date ? new Date(record.scheduled_date) : undefined
  );
  const [performedDate, setPerformedDate] = useState<Date | undefined>(
    record.performed_date ? new Date(record.performed_date) : undefined
  );
  const [technician, setTechnician] = useState(record.technician || "");
  const [semenCode, setSemenCode] = useState(record.semen_code || "");
  const [notes, setNotes] = useState(record.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when record changes or dialog opens
  useEffect(() => {
    if (open && record) {
      setScheduledDate(record.scheduled_date ? new Date(record.scheduled_date) : undefined);
      setPerformedDate(record.performed_date ? new Date(record.performed_date) : undefined);
      setTechnician(record.technician || "");
      setSemenCode(record.semen_code || "");
      setNotes(record.notes || "");
      hapticImpact('light');
    }
  }, [open, record]);

  const handleClose = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!scheduledDate && !performedDate) {
      toast({
        title: "Missing Date",
        description: "Please enter at least a scheduled or performed date",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: Record<string, any> = {
        scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : null,
        performed_date: performedDate ? format(performedDate, "yyyy-MM-dd") : null,
        technician: technician.trim() || null,
        semen_code: semenCode.trim() || null,
        notes: notes.trim() || null,
      };

      const { error } = await supabase
        .from("ai_records")
        .update(updateData)
        .eq("id", record.id);

      if (error) throw error;

      // Invalidate related queries
      await queryClient.invalidateQueries({ 
        queryKey: ['ai-records', record.animal_id],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['animal', record.animal_id],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['dashboard'],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['pregnant-animals'],
      });

      hapticNotification('success');
      toast({
        title: "Record Updated",
        description: "AI/Breeding record has been updated successfully",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating AI record:", error);
      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to update AI record",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = scheduledDate || performedDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit AI/Breeding Record
          </DialogTitle>
          <DialogDescription>
            Update breeding record for {animalName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Scheduled Date */}
          <div className="space-y-2">
            <Label>Scheduled Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left min-h-[48px]",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={(date) => {
                    hapticSelection();
                    setScheduledDate(date);
                  }}
                  disabled={(date) =>
                    date < subDays(new Date(), 365) || date > addDays(new Date(), 365)
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Performed Date (if already performed) */}
          {record.performed_date && (
            <div className="space-y-2">
              <Label>Performed Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left min-h-[48px]",
                      !performedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {performedDate ? format(performedDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={performedDate}
                    onSelect={(date) => {
                      hapticSelection();
                      setPerformedDate(date);
                    }}
                    disabled={(date) =>
                      date > new Date() || date < subDays(new Date(), 365)
                    }
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Technician */}
          <div className="space-y-2">
            <Label htmlFor="edit-technician">Technician</Label>
            <Input
              id="edit-technician"
              placeholder="e.g. Dr. Santos"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[48px]"
            />
          </div>

          {/* Semen Code */}
          <div className="space-y-2">
            <Label htmlFor="edit-semen-code">Semen Code</Label>
            <Input
              id="edit-semen-code"
              placeholder="e.g. BULL-2024-001"
              value={semenCode}
              onChange={(e) => setSemenCode(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[48px] font-mono"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-ai-notes">Notes</Label>
            <Textarea
              id="edit-ai-notes"
              placeholder="Additional observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[80px]"
            />
          </div>

          {/* Pregnancy Status Info */}
          {record.pregnancy_confirmed && (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md">
              <p className="text-sm text-green-700 dark:text-green-300">
                ✓ Pregnancy confirmed - use the Confirm Pregnancy dialog to update pregnancy status
              </p>
            </div>
          )}

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
