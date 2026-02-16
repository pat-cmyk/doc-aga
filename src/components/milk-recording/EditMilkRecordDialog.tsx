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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Pencil, CalendarIcon, Sun, Moon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { MilkQualityFields } from "./MilkQualityFields";
import type { MilkQuality } from "@/constants/milkQuality";

interface MilkRecord {
  id: string;
  animal_id: string;
  record_date: string;
  liters: number;
  session: 'AM' | 'PM' | 'Full Day';
  milk_quality?: string;
  milk_quality_rejection_reason?: string | null;
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
  const [session, setSession] = useState<'AM' | 'PM' | 'Full Day'>(record.session);
  const [milkQuality, setMilkQuality] = useState<MilkQuality>((record.milk_quality as MilkQuality) || 'good');
  const [rejectionReason, setRejectionReason] = useState(record.milk_quality_rejection_reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open && record) {
      setLiters(record.liters.toString());
      setRecordDate(new Date(record.record_date));
      setSession(record.session);
      setMilkQuality((record.milk_quality as MilkQuality) || 'good');
      setRejectionReason(record.milk_quality_rejection_reason || '');
      hapticImpact('light');
    }
  }, [open, record]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) { hapticSelection(); setRecordDate(date); }
  };

  const handleSessionChange = (value: string) => {
    hapticSelection();
    setSession(value as 'AM' | 'PM' | 'Full Day');
  };

  const handleClose = () => { hapticImpact('light'); onOpenChange(false); };

  const handleSubmit = async () => {
    const litersNum = parseFloat(liters);
    if (isNaN(litersNum) || litersNum <= 0) {
      toast({ title: "Invalid Liters", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const dateStr = format(recordDate, "yyyy-MM-dd");

    try {
      const { error: milkingError } = await supabase
        .from("milking_records")
        .update({
          liters: litersNum,
          record_date: dateStr,
          session,
          milk_quality: milkQuality,
          milk_quality_rejection_reason: rejectionReason || null,
        } as any)
        .eq("id", record.id);

      if (milkingError) throw milkingError;

      // milk_inventory is updated via the sync_milk_inventory_on_update trigger
      // but we still need to update liters_original/record_date which the trigger handles for liters changes
      // For date changes, update directly
      const { error: inventoryError } = await supabase
        .from("milk_inventory")
        .update({
          record_date: dateStr,
        })
        .eq("milking_record_id", record.id);

      if (inventoryError) {
        console.warn("No matching milk inventory record to update:", inventoryError);
      }

      await queryClient.refetchQueries({ queryKey: ['milking-records', record.animal_id], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['milk-inventory', farmId], type: 'active' });

      hapticNotification('success');
      const isRejected = milkQuality === 'rejected';
      toast({
        title: "Record Updated",
        description: `Updated to ${litersNum}L${isRejected ? ' (Rejected)' : ''} (${session})`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating milk record:", error);
      hapticNotification('error');
      toast({ title: "Error", description: "Failed to update milk record", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = parseFloat(liters) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Milk Record
          </DialogTitle>
          <DialogDescription>
            Update milk production for {animalName || 'this animal'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left min-h-[48px]", !recordDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(recordDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={recordDate} onSelect={handleDateSelect} disabled={(date) => date > new Date() || date < subDays(new Date(), 30)} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Session</Label>
            <Select value={session} onValueChange={handleSessionChange}>
              <SelectTrigger className="min-h-[48px]"><SelectValue placeholder="Select session" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AM"><span className="flex items-center gap-2"><Sun className="h-4 w-4 text-amber-500" />Morning (AM)</span></SelectItem>
                <SelectItem value="PM"><span className="flex items-center gap-2"><Moon className="h-4 w-4 text-indigo-500" />Evening (PM)</span></SelectItem>
                <SelectItem value="Full Day"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" />Full Day</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-liters">Liters Collected</Label>
            <Input id="edit-liters" type="number" step="0.1" min="0" placeholder="e.g. 5.5" value={liters} onChange={(e) => setLiters(e.target.value)} onFocus={() => hapticImpact('light')} className="min-h-[48px]" />
          </div>

          <MilkQualityFields
            milkQuality={milkQuality}
            rejectionReason={rejectionReason}
            onQualityChange={setMilkQuality}
            onRejectionReasonChange={setRejectionReason}
          />

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} className="flex-1 min-h-[48px]" disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} className="flex-1 min-h-[48px]" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
