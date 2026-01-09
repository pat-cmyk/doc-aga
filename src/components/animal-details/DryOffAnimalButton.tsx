import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MilkOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCacheManager, isCacheManagerReady } from "@/lib/cacheManager";

interface DryOffAnimalButtonProps {
  animalId: string;
  animalName: string;
  farmId: string;
  isCurrentlyLactating: boolean | null;
  onSuccess?: () => void;
}

export function DryOffAnimalButton({
  animalId,
  animalName,
  farmId,
  isCurrentlyLactating,
  onSuccess,
}: DryOffAnimalButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only show for lactating animals
  if (!isCurrentlyLactating) return null;

  const handleDryOff = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("animals")
        .update({
          is_currently_lactating: false,
          milking_stage: "Dry Period",
          milking_start_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", animalId);

      if (error) throw error;

      // Invalidate related caches
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation("animal", farmId);
      }
      
      // Also invalidate lactating animals and milk-related caches
      queryClient.invalidateQueries({ queryKey: ["lactating-animals", farmId] });
      queryClient.invalidateQueries({ queryKey: ["milk-inventory", farmId] });

      toast({
        title: "Animal Dried Off",
        description: `${animalName} is now in dry period and won't appear in milk recording.`,
      });

      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error drying off animal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to dry off animal",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-amber-600 border-amber-200 hover:bg-amber-50">
          <MilkOff className="h-4 w-4 mr-1" />
          Dry Off
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dry Off {animalName}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will mark <strong>{animalName}</strong> as no longer lactating
              and move her to the "Dry Period" stage.
            </p>
            <p className="text-sm text-muted-foreground">
              The animal will no longer appear in milk recording dialogs.
              When she calves again and you record milk, she'll automatically
              restart lactation at "Early Lactation".
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDryOff}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Confirm Dry Off"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
