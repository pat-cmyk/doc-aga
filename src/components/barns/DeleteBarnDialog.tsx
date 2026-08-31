import { useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useDeleteBarn, type Barn } from "@/hooks/useBarns";
import { useToast } from "@/hooks/use-toast";

interface DeleteBarnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  barn: Barn;
}

export function DeleteBarnDialog({ open, onOpenChange, farmId, barn }: DeleteBarnDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteBarn = useDeleteBarn(farmId);
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteBarn.mutateAsync(barn.id);
      toast({ title: `${barn.name} deleted` });
      onOpenChange(false);
    } catch (error: any) {
      console.error("[DeleteBarn] Failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const typeLabel = barn.barn_type === 'paddock' ? 'paddock' : 'barn';
  const animalCount = barn.animal_count || 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {typeLabel}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>This will remove <strong>{barn.name}</strong> from your farm.</p>
            {animalCount > 0 && (
              <div className="bg-muted p-3 rounded-md text-sm">
                <p className="text-amber-600">
                  {animalCount} animal{animalCount !== 1 ? 's' : ''} will be unassigned from this {typeLabel}.
                </p>
              </div>
            )}
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
