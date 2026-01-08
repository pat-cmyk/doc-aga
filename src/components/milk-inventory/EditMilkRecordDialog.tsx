import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { updateLocalMilkInventoryRecord } from "@/lib/dataCache";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MilkInventoryItem } from "@/hooks/useMilkInventory";

interface EditMilkRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  record: MilkInventoryItem;
}

export function EditMilkRecordDialog({ 
  open, 
  onOpenChange, 
  farmId, 
  record 
}: EditMilkRecordDialogProps) {
  const [liters, setLiters] = useState(record.liters.toString());
  const [date, setDate] = useState<Date>(new Date(record.record_date));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    const newLiters = parseFloat(liters);
    if (isNaN(newLiters) || newLiters <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const newDate = format(date, "yyyy-MM-dd");
      
      // Update local cache first for instant UI update
      await updateLocalMilkInventoryRecord(farmId, record.id, {
        liters: newLiters,
        record_date: newDate,
      });
      
      // Invalidate to refresh UI
      queryClient.invalidateQueries({ queryKey: ["milk-inventory", farmId] });
      
      // Update database
      const { error } = await supabase
        .from("milking_records")
        .update({
          liters: newLiters,
          record_date: newDate,
        })
        .eq("id", record.id);
      
      if (error) throw error;
      
      toast.success("Milk record updated");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update milk record:", error);
      toast.error("Failed to update record");
      // Refetch to restore correct state
      queryClient.invalidateQueries({ queryKey: ["milk-inventory", farmId] });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Milk Record</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="liters">Amount (Liters)</Label>
            <Input
              id="liters"
              type="number"
              step="0.1"
              min="0.1"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              placeholder="Enter liters"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) => d > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Animal: {record.animal_name || record.ear_tag || "Unknown"}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
