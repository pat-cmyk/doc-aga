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
import { Loader2, Sun, Moon } from "lucide-react";
import { hapticNotification } from "@/lib/haptics";

interface MilkRecord {
  id: string;
  animal_id: string;
  record_date: string;
  liters: number;
  session: 'AM' | 'PM';
}

interface DeleteMilkRecordFromProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: MilkRecord;
  animalName: string | null;
  onDelete: (record: MilkRecord) => void;
}

export function DeleteMilkRecordFromProfileDialog({
  open,
  onOpenChange,
  record,
  animalName,
  onDelete,
}: DeleteMilkRecordFromProfileDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    hapticNotification('warning');
    onDelete(record);
    onOpenChange(false);
    setIsDeleting(false);
  };

  const formattedDate = format(parseISO(record.record_date), "MMMM d, yyyy");
  const sessionLabel = record.session === 'AM' ? 'Morning' : 'Evening';
  const SessionIcon = record.session === 'AM' ? Sun : Moon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Milk Record?</AlertDialogTitle>
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
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Session:</span>
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <SessionIcon className="h-3.5 w-3.5" />
                    {record.session} ({sessionLabel})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium text-foreground">{record.liters} L</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                You can undo this within 30 seconds after deletion.
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
