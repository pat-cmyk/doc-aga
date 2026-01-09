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
import { Loader2, Scale, CalendarIcon, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { validateRecordDate } from "@/lib/recordValidation";
import { WeightHintBadge } from "@/components/ui/weight-hint-badge";

interface RecordSingleWeightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animalId: string;
  animalName: string;
  farmId: string;
  livestockType?: string;
  gender?: string | null;
  lifeStage?: string | null;
  animalFarmEntryDate?: string | null;
  onSuccess?: () => void;
}

export function RecordSingleWeightDialog({
  open,
  onOpenChange,
  animalId,
  animalName,
  farmId,
  livestockType,
  gender,
  lifeStage,
  animalFarmEntryDate,
  onSuccess,
}: RecordSingleWeightDialogProps) {
  const [measurementDate, setMeasurementDate] = useState<Date>(new Date());
  const [weight, setWeight] = useState("");
  const [method, setMethod] = useState("scale");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  // Haptic on dialog open
  useEffect(() => {
    if (open) {
      hapticImpact('light');
    }
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setMeasurementDate(new Date());
      setWeight("");
      setMethod("scale");
      setNotes("");
    }
  }, [open]);

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
    if (!farmId || !weight) return;

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid weight",
        variant: "destructive",
      });
      return;
    }

    // Validate record date
    const dateValidation = validateRecordDate(
      format(measurementDate, 'yyyy-MM-dd'),
      { farm_entry_date: animalFarmEntryDate }
    );
    if (!dateValidation.valid) {
      toast({
        title: "Invalid Date",
        description: dateValidation.message,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const optimisticId = crypto.randomUUID();

    try {
      const dateStr = format(measurementDate, "yyyy-MM-dd");

      // Build optimistic record
      const optimisticRecord = {
        id: `optimistic-${optimisticId}`,
        animal_id: animalId,
        weight_kg: weightNum,
        measurement_date: dateStr,
        measurement_method: method,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
        optimisticId,
        syncStatus: isOnline ? 'syncing' : 'pending',
      };

      // Immediately update React Query cache
      queryClient.setQueryData(['weight-records', animalId], (old: any[] = []) =>
        [optimisticRecord, ...old]
      );

      if (!isOnline) {
        // Queue for offline sync
        await addToQueue({
          id: `single_weight_${Date.now()}`,
          type: 'single_weight',
          payload: {
            farmId,
            singleWeight: {
              animalId,
              animalName,
              weightKg: weightNum,
              measurementDate: dateStr,
              measurementMethod: method,
              notes: notes.trim() || undefined,
            },
          },
          createdAt: Date.now(),
          optimisticId,
        });

        hapticNotification('success');
        toast({
          title: "Queued for Sync",
          description: `${weightNum}kg weight will sync when online`,
        });
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Insert weight record
      const { error: insertError } = await supabase.from("weight_records").insert({
        animal_id: animalId,
        weight_kg: weightNum,
        measurement_date: dateStr,
        measurement_method: method,
        notes: notes.trim() || null,
        recorded_by: user?.id,
      });

      if (insertError) throw insertError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["weight-records"] });

      hapticNotification('success');
      toast({
        title: "Weight Recorded",
        description: `${weightNum}kg recorded for ${animalName}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error recording weight:", error);

      // Rollback optimistic update
      queryClient.setQueryData(['weight-records', animalId], (old: any[] = []) =>
        old.filter((r: any) => r.optimisticId !== optimisticId)
      );

      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to record weight",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = parseFloat(weight) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Record Weight
            {!isOnline && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Record weight for {animalName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Date</Label>
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
                    date > new Date() || date < subDays(new Date(), 7)
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Weight Input */}
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 450"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[48px]"
            />
            {livestockType && (
              <WeightHintBadge
                livestockType={livestockType}
                gender={gender}
                lifeStage={lifeStage}
                weightType="current"
                className="mt-1"
              />
            )}
          </div>

          {/* Measurement Method */}
          <div className="space-y-2">
            <Label>Measurement Method</Label>
            <Select value={method} onValueChange={(v) => { hapticSelection(); setMethod(v); }}>
              <SelectTrigger className="min-h-[48px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scale">Scale</SelectItem>
                <SelectItem value="tape_measure">Tape Measure</SelectItem>
                <SelectItem value="visual_estimate">Visual Estimate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Weight"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
