import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "@/components/ui/bilingual-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateBarn, useUpdateBarn, type Barn } from "@/hooks/useBarns";
import { toast } from "sonner";

interface BarnFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  editBarn?: Barn | null;
}

export function BarnFormDialog({ open, onOpenChange, farmId, editBarn }: BarnFormDialogProps) {
  const [name, setName] = useState(editBarn?.name || "");
  const [barnType, setBarnType] = useState(editBarn?.barn_type || "barn");
  const [description, setDescription] = useState(editBarn?.description || "");
  const [capacity, setCapacity] = useState(editBarn?.capacity?.toString() || "");

  const createBarn = useCreateBarn(farmId);
  const updateBarn = useUpdateBarn(farmId);

  const isEditing = !!editBarn;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (isEditing) {
        await updateBarn.mutateAsync({
          id: editBarn.id,
          name: name.trim(),
          barn_type: barnType,
          description: description.trim() || null,
          capacity: capacity ? parseInt(capacity) : null,
        });
        toast.success("Barn/paddock updated");
      } else {
        await createBarn.mutateAsync({
          name: name.trim(),
          barn_type: barnType,
          description: description.trim() || undefined,
          capacity: capacity ? parseInt(capacity) : undefined,
        });
        toast.success("Barn/paddock created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to save barn/paddock");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit" : "Add"} Barn / Paddock</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <BilingualLabel english="Name" filipino="Pangalan" required htmlFor="barn-name" />
            <Input
              id="barn-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Barn A, Paddock 2"
              required
            />
          </div>

          <div className="space-y-2">
            <BilingualLabel english="Type" filipino="Uri" required htmlFor="barn-type" />
            <Select value={barnType} onValueChange={setBarnType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barn">Barn (Kulungan)</SelectItem>
                <SelectItem value="paddock">Paddock (Pastulan)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <BilingualLabel english="Description" filipino="Paglalarawan" htmlFor="barn-desc" />
            <Textarea
              id="barn-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this location"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <BilingualLabel english="Capacity" filipino="Kapasidad" htmlFor="barn-capacity" />
            <Input
              id="barn-capacity"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Max number of animals (optional)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createBarn.isPending || updateBarn.isPending}>
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
