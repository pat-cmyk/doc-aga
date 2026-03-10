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

interface BreedingEvent {
  id: string;
  event_type: string;
  event_date: string;
  notes: string | null;
}

interface DeleteBreedingEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: BreedingEvent;
  eventLabel: string;
  onDelete: (event: BreedingEvent) => void;
}

export function DeleteBreedingEventDialog({
  open,
  onOpenChange,
  event,
  eventLabel,
  onDelete,
}: DeleteBreedingEventDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    hapticNotification('warning');
    onDelete(event);
    onOpenChange(false);
    setIsDeleting(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Breeding Event?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This will delete the following event:</p>
              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event:</span>
                  <span className="font-medium text-foreground">{eventLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(event.event_date), "MMMM d, yyyy")}
                  </span>
                </div>
                {event.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notes:</span>
                    <span className="font-medium text-foreground">{event.notes}</span>
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
