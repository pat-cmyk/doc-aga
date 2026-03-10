import { useState } from "react";
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
import { CameraPhotoInput } from "@/components/ui/camera-photo-input";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useQueryClient } from "@tanstack/react-query";
import { compressImage } from "@/lib/imageUtils";
import { MILESTONE_TYPES } from "@/lib/bcsDefinitions";

interface UploadPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animalId: string;
  farmId: string;
  animalName?: string;
}

export function UploadPhotoDialog({
  open,
  onOpenChange,
  animalId,
  farmId,
  animalName,
}: UploadPhotoDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [milestoneType, setMilestoneType] = useState<string>("");
  const [label, setLabel] = useState("");
  const [takenAt, setTakenAt] = useState<Date>(new Date());
  const [isUploading, setIsUploading] = useState(false);

  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setMilestoneType("");
    setLabel("");
    setTakenAt(new Date());
  };

  const handlePhotoSelected = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const compressedBlob = await compressImage(selectedFile);
      const fileName = `${animalId}-photo-${Date.now()}.jpg`;
      const filePath = `${farmId}/photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('animal-photos')
        .upload(filePath, compressedBlob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from('animal_photos')
        .insert({
          animal_id: animalId,
          photo_path: filePath,
          label: label || null,
          milestone_type: milestoneType || null,
          taken_at: takenAt.toISOString(),
          created_by: user?.id,
        });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['animal-photos-timeline', animalId] });
      toast({ title: "Photo uploaded" });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error('[UploadPhoto] Failed:', error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Photo</DialogTitle>
          <DialogDescription>
            Add a photo for {animalName || 'this animal'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo capture */}
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-48 object-cover rounded-lg"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-2 right-2"
                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
              >
                Change
              </Button>
            </div>
          ) : (
            <CameraPhotoInput onPhotoSelected={handlePhotoSelected} />
          )}

          {/* Milestone type */}
          <div className="space-y-2">
            <Label>Milestone (optional)</Label>
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
            <Label>Label (optional)</Label>
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
                  className={cn("w-full justify-start text-left font-normal", !takenAt && "text-muted-foreground")}
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

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!selectedFile || isUploading || !isOnline}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : !isOnline ? (
              "Offline — Cannot Upload"
            ) : (
              "Upload Photo"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
