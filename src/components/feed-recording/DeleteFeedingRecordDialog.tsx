import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { hapticNotification } from "@/lib/haptics";
import { formatPHP } from "@/lib/currency";

interface FeedingRecord {
  id: string;
  feed_type: string | null;
  kilograms: number | null;
  record_datetime: string;
  feed_inventory_id: string | null;
  cost_per_kg_at_time: number | null;
}

interface DeleteFeedingRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: FeedingRecord;
  animalName: string;
  onDelete: (record: FeedingRecord) => void;
}

export function DeleteFeedingRecordDialog({
  open,
  onOpenChange,
  record,
  animalName,
  onDelete,
}: DeleteFeedingRecordDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    hapticNotification('warning');
    onDelete(record);
    onOpenChange(false);
    setIsDeleting(false);
  };

  const totalCost = record.cost_per_kg_at_time && record.kilograms
    ? record.kilograms * record.cost_per_kg_at_time
    : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Feeding Record?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This will delete the following record:</p>
              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Animal:</span>
                  <span className="font-medium text-foreground">{animalName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(record.record_datetime), "MMMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Feed:</span>
                  <span className="font-medium text-foreground">{record.feed_type || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium text-foreground">{record.kilograms?.toFixed(2) || "0"} kg</span>
                </div>
                {totalCost !== null && totalCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost:</span>
                    <span className="font-medium text-foreground">{formatPHP(totalCost, true)}</span>
                  </div>
                )}
              </div>
              {record.feed_inventory_id && record.kilograms && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  {record.kilograms.toFixed(2)} kg will be returned to feed inventory.
                </div>
              )}
              <p className="text-destructive text-xs">
                This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
