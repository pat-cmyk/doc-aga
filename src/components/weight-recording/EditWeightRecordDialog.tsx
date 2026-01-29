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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";

interface WeightRecord {
  id: string;
  animal_id: string;
  measurement_date: string;
  weight_kg: number;
  measurement_method: string | null;
  notes: string | null;
}

interface EditWeightRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: WeightRecord;
  animalName: string;
  onSuccess?: () => void;
}

const MEASUREMENT_METHODS = [
  { value: "scale", label: "Weighing Scale" },
  { value: "tape", label: "Weight Tape" },
  { value: "visual", label: "Visual Estimate" },
];

export function EditWeightRecordDialog({
  open,
  onOpenChange,
  record,
  animalName,
  onSuccess,
}: EditWeightRecordDialogProps) {
  const [measurementDate, setMeasurementDate] = useState<Date>(new Date(record.measurement_date));
  const [weightKg, setWeightKg] = useState(record.weight_kg.toString());
  const [measurementMethod, setMeasurementMethod] = useState(record.measurement_method || "scale");
  const [notes, setNotes] = useState(record.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when record changes or dialog opens
  useEffect(() => {
    if (open && record) {
      setMeasurementDate(new Date(record.measurement_date));
      setWeightKg(record.weight_kg.toString());
      setMeasurementMethod(record.measurement_method || "scale");
      setNotes(record.notes || "");
      hapticImpact('light');
    }
  }, [open, record]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      hapticSelection();
      setMeasurementDate(date);
    }
  };

  const handleClose = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const weight = parseFloat(weightKg);
    if (isNaN(weight) || weight <= 0) {
      toast({
        title: "Invalid Weight",
        description: "Please enter a valid weight",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const dateStr = format(measurementDate, "yyyy-MM-dd");

    try {
      // Update weight record
      const { error } = await supabase
        .from("weight_records")
        .update({
          measurement_date: dateStr,
          weight_kg: weight,
          measurement_method: measurementMethod,
          notes: notes.trim() || null,
        })
        .eq("id", record.id);

      if (error) throw error;

      // Check if this is the most recent record for the animal
      // If so, update the animal's current_weight_kg
      const { data: latestRecord } = await supabase
        .from("weight_records")
        .select("id")
        .eq("animal_id", record.animal_id)
        .order("measurement_date", { ascending: false })
        .limit(1)
        .single();

      if (latestRecord?.id === record.id) {
        // This is the most recent record, update animal's current weight
        await supabase
          .from("animals")
          .update({ current_weight_kg: weight })
          .eq("id", record.animal_id);
      }

      // Invalidate related queries per SSOT pattern
      await queryClient.invalidateQueries({ 
        queryKey: ['weight-records', record.animal_id],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['animals'],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['animal', record.animal_id],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['feed-inventory'],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['lactating-animals'],
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['dashboard'],
      });

      hapticNotification('success');
      toast({
        title: "Record Updated",
        description: `Weight updated to ${weight} kg`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating weight record:", error);
      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to update weight record",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = parseFloat(weightKg) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Weight Record
          </DialogTitle>
          <DialogDescription>
            Update weight measurement for {animalName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Measurement Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left min-h-[48px]",
                    !measurementDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(measurementDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={measurementDate}
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

          {/* Weight Input */}
          <div className="space-y-2">
            <Label htmlFor="edit-weight">Weight (kg)</Label>
            <Input
              id="edit-weight"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 350"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[48px]"
            />
          </div>

          {/* Measurement Method */}
          <div className="space-y-2">
            <Label>Measurement Method</Label>
            <Select
              value={measurementMethod}
              onValueChange={(value) => {
                hapticSelection();
                setMeasurementMethod(value);
              }}
            >
              <SelectTrigger className="min-h-[48px]">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {MEASUREMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-weight-notes">Notes</Label>
            <Textarea
              id="edit-weight-notes"
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
