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

interface HealthRecord {
  id: string;
  visit_date: string;
  diagnosis: string | null;
  treatment: string | null;
  vet_name: string | null;
}

interface DeleteHealthRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: HealthRecord;
  animalName: string;
  onDelete: (record: HealthRecord) => void;
}

export function DeleteHealthRecordDialog({
  open,
  onOpenChange,
  record,
  animalName,
  onDelete,
}: DeleteHealthRecordDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    hapticNotification('warning');
    onDelete(record);
    onOpenChange(false);
    setIsDeleting(false);
  };

  const formattedDate = format(parseISO(record.visit_date), "MMMM d, yyyy");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Health Record?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This will delete the following record:</p>
              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                {animalName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Animal:</span>
                    <span className="font-medium text-foreground">{animalName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium text-foreground">{formattedDate}</span>
                </div>
                {record.diagnosis && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Diagnosis:</span>
                    <span className="font-medium text-foreground">{record.diagnosis}</span>
                  </div>
                )}
                {record.treatment && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Treatment:</span>
                    <span className="font-medium text-foreground">{record.treatment}</span>
                  </div>
                )}
                {record.vet_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vet:</span>
                    <span className="font-medium text-foreground">{record.vet_name}</span>
                  </div>
                )}
              </div>
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
