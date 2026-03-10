import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { MILESTONE_TYPES } from "@/lib/bcsDefinitions";

interface AnimalPhoto {
  id: string;
  photo_path: string;
  label: string | null;
  milestone_type: string | null;
  taken_at: string | null;
  created_at: string;
}

interface EditPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: AnimalPhoto;
  animalId: string;
}

export function EditPhotoDialog({
  open,
  onOpenChange,
  photo,
  animalId,
}: EditPhotoDialogProps) {
  const [milestoneType, setMilestoneType] = useState(photo.milestone_type || "");
  const [label, setLabel] = useState(photo.label || "");
  const [takenAt, setTakenAt] = useState<Date>(
    photo.taken_at ? new Date(photo.taken_at) : new Date(photo.created_at)
  );
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setMilestoneType(photo.milestone_type || "");
    setLabel(photo.label || "");
    setTakenAt(photo.taken_at ? new Date(photo.taken_at) : new Date(photo.created_at));
  }, [photo]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('animal_photos')
        .update({
          label: label || null,
          milestone_type: milestoneType || null,
          taken_at: takenAt.toISOString(),
        })
        .eq('id', photo.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['animal-photos-timeline', animalId] });
      toast({ title: "Photo updated" });
      onOpenChange(false);
    } catch (error: any) {
      console.error('[EditPhoto] Failed:', error);
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Photo Details</DialogTitle>
          <DialogDescription>
            Update the label, milestone, or date for this photo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Milestone type */}
          <div className="space-y-2">
            <Label>Milestone</Label>
            <Select value={milestoneType} onValueChange={setMilestoneType}>
              <SelectTrigger>
                <SelectValue placeholder="Select milestone type" />
              </SelectTrigger>
              <SelectContent>
                {MILESTONE_TYPES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. After vaccination"
            />
          </div>

          {/* Date taken */}
          <div className="space-y-2">
            <Label>Date Taken</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(takenAt, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={takenAt}
                  onSelect={(d) => d && setTakenAt(d)}
                  disabled={(d) => d > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
