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
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { hapticNotification } from "@/lib/haptics";

interface WeightRecord {
  id: string;
  weight_kg: number;
  measurement_date: string;
  measurement_method: string | null;
}

interface DeleteWeightRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: WeightRecord;
  animalName: string;
  isLatest: boolean;
  onDelete: (record: WeightRecord) => void;
}

export function DeleteWeightRecordDialog({
  open,
  onOpenChange,
  record,
  animalName,
  isLatest,
  onDelete,
}: DeleteWeightRecordDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    hapticNotification('warning');
    onDelete(record);
    onOpenChange(false);
    setIsDeleting(false);
  };

  const formattedDate = format(parseISO(record.measurement_date), "MMMM d, yyyy");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Weight Record?</AlertDialogTitle>
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
                  <span className="font-medium text-foreground">{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight:</span>
                  <span className="font-medium text-foreground">{record.weight_kg} kg</span>
                </div>
                {record.measurement_method && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method:</span>
                    <span className="font-medium text-foreground capitalize">
                      {record.measurement_method.replace("_", " ")}
                    </span>
                  </div>
                )}
              </div>
              {isLatest && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                  This is the most recent weight record. Deleting it will update the animal's current weight.
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
