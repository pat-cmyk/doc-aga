import { useState } from "react";
import { getIsOnline } from "@/hooks/useOnlineStatus";
import { useBarnAnimals, useAssignAnimalToBarn, useRemoveAnimalFromBarn, type Barn } from "@/hooks/useBarns";
import { useFarmAnimals } from "@/hooks/useFarmAnimals";
import { Button } from "@/components/ui/button";
import { X, Plus, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";

interface BarnAnimalManagerProps {
  barn: Barn;
  farmId: string;
  allBarns: Barn[];
  readOnly?: boolean;
}

export function BarnAnimalManager({ barn, farmId, allBarns, readOnly = false }: BarnAnimalManagerProps) {
  const { data: assignments = [], isLoading } = useBarnAnimals(barn.id, farmId);
  const { data: allAnimals = [] } = useFarmAnimals(farmId);
  const assignAnimal = useAssignAnimalToBarn(farmId);
  const removeAnimal = useRemoveAnimalFromBarn(farmId);

  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [moveConfirm, setMoveConfirm] = useState<{
    animalId: string;
    animalName: string;
    currentBarnName: string;
  } | null>(null);

  const assignedAnimalIds = new Set(assignments.map(a => a.animal_id));

  // Animals available to add: not already in THIS barn
  const availableAnimals = allAnimals.filter(a => !assignedAnimalIds.has(a.id));

  const handleAddAnimal = async () => {
    if (!selectedAnimalId) return;

    const animal = allAnimals.find(a => a.id === selectedAnimalId);
    if (!animal) return;

    // Check if animal is in another barn
    const currentBarn = allBarns.find(b =>
      b.id !== barn.id && (animal as any).current_barn_id === b.id
    );

    if (currentBarn) {
      setMoveConfirm({
        animalId: selectedAnimalId,
        animalName: animal.name || animal.ear_tag || "Unknown",
        currentBarnName: currentBarn.name,
      });
      return;
    }

    await doAssign(selectedAnimalId);
  };

  const doAssign = async (animalId: string) => {
    try {
      await assignAnimal.mutateAsync({ barnId: barn.id, animalId });
      setSelectedAnimalId("");
      toast.success(
        getIsOnline() ? "Animal assigned" : "Saved locally, will sync when online"
      );
    } catch {
      toast.error("Failed to assign animal");
    }
  };

  const handleRemove = async (assignmentId: string, animalId?: string) => {
    try {
      await removeAnimal.mutateAsync({ assignmentId, barnId: barn.id, animalId });
      toast.success(
        getIsOnline() ? "Animal removed from barn" : "Saved locally, will sync when online"
      );
    } catch {
      toast.error("Failed to remove animal");
    }
  };

  if (isLoading) return <div className="py-2 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-3">
      {/* Add animal row (hidden in readOnly mode) */}
      {!readOnly && (
        <div className="flex gap-2">
          <Select value={selectedAnimalId} onValueChange={setSelectedAnimalId}>
            <SelectTrigger className="flex-1 min-h-[44px]">
              <SelectValue placeholder="Select animal to add..." />
            </SelectTrigger>
            <SelectContent>
              {availableAnimals.map(animal => (
                <SelectItem key={animal.id} value={animal.id}>
                  {animal.name || animal.ear_tag || "Unknown"} ({animal.livestock_type})
                </SelectItem>
              ))}
              {availableAnimals.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No animals available</div>
              )}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            onClick={handleAddAnimal}
            disabled={!selectedAnimalId || assignAnimal.isPending}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Current animals list */}
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-1">No animals assigned yet</p>
      ) : (
        <ul className="space-y-1">
          {assignments.map(assignment => {
            const animal = assignment.animal;
            return (
              <li key={assignment.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">
                  {animal?.name || animal?.ear_tag || "Unknown"}
                  <span className="ml-1.5 text-muted-foreground text-xs capitalize">
                    {animal?.livestock_type}
                  </span>
                </span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemove(assignment.id, assignment.animal_id)}
                    disabled={removeAnimal.isPending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Move confirmation dialog */}
      <AlertDialog open={!!moveConfirm} onOpenChange={() => setMoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move Animal?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{moveConfirm?.animalName}</strong> is currently in <strong>{moveConfirm?.currentBarnName}</strong>.
              <span className="flex items-center gap-1 mt-1">
                Move to <ArrowRight className="h-3 w-3 inline" /> <strong>{barn.name}</strong>?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (moveConfirm) {
                  doAssign(moveConfirm.animalId);
                  setMoveConfirm(null);
                }
              }}
            >
              Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}