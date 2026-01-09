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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Pencil, CalendarIcon, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";

interface MilkRecord {
  id: string;
  animal_id: string;
  record_date: string;
  liters: number;
  session: 'AM' | 'PM';
}

interface EditMilkRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: MilkRecord;
  animalName: string | null;
  farmId: string;
  onSuccess?: () => void;
}

export function EditMilkRecordDialog({
  open,
  onOpenChange,
  record,
  animalName,
  farmId,
  onSuccess,
}: EditMilkRecordDialogProps) {
  const [liters, setLiters] = useState(record.liters.toString());
  const [recordDate, setRecordDate] = useState<Date>(new Date(record.record_date));
  const [session, setSession] = useState<'AM' | 'PM'>(record.session);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when record changes or dialog opens
  useEffect(() => {
    if (open && record) {
      setLiters(record.liters.toString());
      setRecordDate(new Date(record.record_date));
      setSession(record.session);
      hapticImpact('light');
    }
  }, [open, record]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      hapticSelection();
      setRecordDate(date);
    }
  };

  const handleSessionChange = (value: string) => {
    hapticSelection();
    setSession(value as 'AM' | 'PM');
  };

  const handleClose = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const litersNum = parseFloat(liters);
    if (isNaN(litersNum) || litersNum <= 0) {
      toast({
        title: "Invalid Liters",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const dateStr = format(recordDate, "yyyy-MM-dd");

    try {
      // Update milking_records
      const { error: milkingError } = await supabase
        .from("milking_records")
        .update({
          liters: litersNum,
          record_date: dateStr,
          session: session,
        })
        .eq("id", record.id);

      if (milkingError) throw milkingError;

      // Update corresponding milk_inventory
      const { error: inventoryError } = await supabase
        .from("milk_inventory")
        .update({
          liters_original: litersNum,
          liters_remaining: litersNum,
          record_date: dateStr,
        })
        .eq("milking_record_id", record.id);

      if (inventoryError) {
        console.warn("No matching milk inventory record to update:", inventoryError);
      }

      // Refetch queries
      await queryClient.refetchQueries({ 
        queryKey: ['milking-records', record.animal_id],
        type: 'active',
      });
      await queryClient.refetchQueries({ 
        queryKey: ['milk-inventory', farmId],
        type: 'active',
      });

      hapticNotification('success');
      toast({
        title: "Record Updated",
        description: `Updated to ${litersNum}L (${session})`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating milk record:", error);
      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to update milk record",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = parseFloat(liters) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Milk Record
          </DialogTitle>
          <DialogDescription>
            Update milk production for {animalName || 'this animal'}
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
                    !recordDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(recordDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={recordDate}
                  onSelect={handleDateSelect}
                  disabled={(date) =>
                    date > new Date() || date < subDays(new Date(), 30)
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* AM/PM Session */}
          <div className="space-y-2">
            <Label>Session</Label>
            <RadioGroup
              value={session}
              onValueChange={handleSessionChange}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="AM" id="edit-am" />
                <Label htmlFor="edit-am" className="flex items-center gap-1.5 cursor-pointer">
                  <Sun className="h-4 w-4 text-amber-500" />
                  Morning
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PM" id="edit-pm" />
                <Label htmlFor="edit-pm" className="flex items-center gap-1.5 cursor-pointer">
                  <Moon className="h-4 w-4 text-indigo-500" />
                  Evening
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Liters Input */}
          <div className="space-y-2">
            <Label htmlFor="edit-liters">Liters Collected</Label>
            <Input
              id="edit-liters"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 5.5"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              onFocus={() => hapticImpact('light')}
              className="min-h-[48px]"
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
