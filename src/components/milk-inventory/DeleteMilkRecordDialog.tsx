import { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MilkInventoryItem } from "@/hooks/useMilkInventory";

interface DeleteMilkRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  record: MilkInventoryItem;
}

export function DeleteMilkRecordDialog({ 
  open, 
  onOpenChange, 
  farmId, 
  record 
}: DeleteMilkRecordDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Delete from milking_records (which cascades to milk_inventory via FK)
      const { error } = await supabase
        .from("milking_records")
        .delete()
        .eq("id", record.milking_record_id);
      
      if (error) throw error;
      
      // Refetch to sync
      await queryClient.refetchQueries({ 
        queryKey: ['milk-inventory', farmId],
        type: 'active',
      });
      
      toast.success("Milk record deleted");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete milk record:", error);
      toast.error("Failed to delete record");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Milk Record?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>This will permanently delete this milk record:</p>
            <div className="bg-muted p-3 rounded-md text-sm">
              <p><strong>Animal:</strong> {record.animal_name || record.ear_tag || "Unknown"}</p>
              <p><strong>Date:</strong> {format(new Date(record.record_date), "PPP")}</p>
              <p><strong>Amount:</strong> {record.liters_remaining.toFixed(1)} L</p>
            </div>
            <p className="text-destructive">This action cannot be undone.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
