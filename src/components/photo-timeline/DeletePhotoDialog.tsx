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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { hapticNotification } from "@/lib/haptics";

interface AnimalPhoto {
  id: string;
  photo_path: string;
  label: string | null;
  milestone_type: string | null;
  taken_at: string | null;
  created_at: string;
}

interface DeletePhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: AnimalPhoto;
  animalId: string;
  milestoneLabel: string;
}

export function DeletePhotoDialog({
  open,
  onOpenChange,
  photo,
  animalId,
  milestoneLabel,
}: DeletePhotoDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    setIsDeleting(true);
    hapticNotification('warning');
    try {
      // Remove from storage
      await supabase.storage
        .from('animal-photos')
        .remove([photo.photo_path]);

      // Delete DB row
      const { error } = await supabase
        .from('animal_photos')
        .delete()
        .eq('id', photo.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['animal-photos-timeline', animalId] });
      toast({ title: "Photo deleted" });
      onOpenChange(false);
    } catch (error: any) {
      console.error('[DeletePhoto] Failed:', error);
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This will permanently delete this photo.</p>
              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                {photo.label && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Label:</span>
                    <span className="font-medium text-foreground">{photo.label}</span>
                  </div>
                )}
                {photo.milestone_type && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Milestone:</span>
                    <span className="font-medium text-foreground">{milestoneLabel}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(photo.taken_at || photo.created_at), "MMMM d, yyyy")}
                  </span>
                </div>
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
