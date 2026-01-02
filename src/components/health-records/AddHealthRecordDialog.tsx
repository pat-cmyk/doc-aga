import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Camera, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { validateRecordDate } from "@/lib/recordValidation";
import { VoiceInputButton } from "@/components/ui/voice-input-button";

interface AddHealthRecordDialogProps {
  animalId: string;
  isOnline: boolean;
  onSuccess: () => void;
  animalFarmEntryDate?: string | null;
}

export const AddHealthRecordDialog = ({ animalId, isOnline, onSuccess, animalFarmEntryDate }: AddHealthRecordDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSelectingPhoto, setIsSelectingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    visit_date: "",
    diagnosis: "",
    treatment: "",
    notes: ""
  });

  // Restore state from sessionStorage
  useEffect(() => {
    const savedDialogOpen = sessionStorage.getItem('hr_dialog_open');
    const savedFormData = sessionStorage.getItem('hr_form_data');
    const savedPhotos = sessionStorage.getItem('hr_uploaded_photos');
    const savedSelectingPhoto = sessionStorage.getItem('hr_selecting_photo');
    
    if (savedDialogOpen === '1') setShowDialog(true);
    if (savedFormData) {
      try {
        setFormData(JSON.parse(savedFormData));
      } catch (e) {
        console.error('Failed to restore form data:', e);
      }
    }
    if (savedPhotos) {
      try {
        setUploadedPhotos(JSON.parse(savedPhotos));
      } catch (e) {
        console.error('Failed to restore photos:', e);
      }
    }
    if (savedSelectingPhoto === '1') setIsSelectingPhoto(true);
  }, []);

  // Persist state
  useEffect(() => {
    sessionStorage.setItem('hr_dialog_open', showDialog ? '1' : '0');
  }, [showDialog]);

  useEffect(() => {
    sessionStorage.setItem('hr_form_data', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    sessionStorage.setItem('hr_uploaded_photos', JSON.stringify(uploadedPhotos));
  }, [uploadedPhotos]);

  // Prevent navigation during upload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploadingImage) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploadingImage]);

  const compressImage = async (file: File, maxDim = 1600, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const scale = Math.min(1, maxDim / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to compress image'));
          }, 'image/jpeg', quality);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setIsSelectingPhoto(false);
      sessionStorage.removeItem('hr_selecting_photo');
      return;
    }

    setIsUploadingImage(true);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const compressedBlob = await compressImage(file);
        
        const fileExt = 'jpg';
        const fileName = `${animalId}-health-${Date.now()}-${i}.${fileExt}`;
        const filePath = `health/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('animal-photos')
          .upload(filePath, compressedBlob, {
            contentType: 'image/jpeg'
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('animal-photos')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      setUploadedPhotos([...uploadedPhotos, ...uploadedUrls]);
      toast({
        title: "Photos uploaded",
        description: `${uploadedUrls.length} photo(s) added`
      });
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUploadingImage(false);
      setIsSelectingPhoto(false);
      sessionStorage.removeItem('hr_selecting_photo');
      if (event.target) event.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.visit_date) {
      toast({
        title: "Missing field",
        description: "Visit date is required",
        variant: "destructive"
      });
      return;
    }

    // Validate record date against farm entry date
    const dateValidation = validateRecordDate(formData.visit_date, { farm_entry_date: animalFarmEntryDate });
    if (!dateValidation.valid) {
      toast({
        title: "Invalid Date",
        description: dateValidation.message,
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    try {
      const { data: record, error: recordError } = await supabase
        .from("health_records")
        .insert({
          animal_id: animalId,
          visit_date: formData.visit_date,
          diagnosis: formData.diagnosis || null,
          treatment: formData.treatment || null,
          notes: formData.notes || null
        })
        .select()
        .single();

      if (recordError) throw recordError;

      if (uploadedPhotos.length > 0) {
        const photoRecords = uploadedPhotos.map(url => ({
          animal_id: animalId,
          photo_path: url,
          label: `Health Record - ${formData.visit_date}`
        }));

        const { error: photosError } = await supabase
          .from("animal_photos")
          .insert(photoRecords);

        if (photosError) throw photosError;
      }

      toast({
        title: "Success!",
        description: "Health record added"
      });

      // Clear sessionStorage
      sessionStorage.removeItem('hr_dialog_open');
      sessionStorage.removeItem('hr_form_data');
      sessionStorage.removeItem('hr_uploaded_photos');
      sessionStorage.removeItem('hr_selecting_photo');
      
      setShowDialog(false);
      setFormData({ visit_date: "", diagnosis: "", treatment: "", notes: "" });
      setUploadedPhotos([]);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(uploadedPhotos.filter((_, i) => i !== index));
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && isUploadingImage) {
      toast({
        title: "Upload in progress",
        description: "Please wait for photos to finish uploading",
        variant: "destructive"
      });
      return;
    }
    
    setShowDialog(open);
    
    if (!open) {
      sessionStorage.removeItem('hr_dialog_open');
      sessionStorage.removeItem('hr_form_data');
      sessionStorage.removeItem('hr_uploaded_photos');
      sessionStorage.removeItem('hr_selecting_photo');
    }
  };

  const handleAddPhotosClick = () => {
    setIsSelectingPhoto(true);
    sessionStorage.setItem('hr_selecting_photo', '1');
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={showDialog} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          size="sm"
          disabled={!isOnline}
          title={!isOnline ? "Available when online" : ""}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-full sm:max-w-md h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Health Record</DialogTitle>
          <DialogDescription>Record veterinary visits and treatments</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="visit_date">Visit Date *</Label>
            <Input
              id="visit_date"
              type="date"
              value={formData.visit_date}
              onChange={(e) => setFormData(prev => ({ ...prev, visit_date: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <div className="flex gap-2">
              <Input
                id="diagnosis"
                value={formData.diagnosis}
                onChange={(e) => setFormData(prev => ({ ...prev, diagnosis: e.target.value }))}
                placeholder="Diagnosis"
                className="flex-1"
              />
              <VoiceInputButton
                onTranscription={(text) => setFormData(prev => ({ ...prev, diagnosis: prev.diagnosis ? `${prev.diagnosis} ${text}` : text }))}
                disabled={!isOnline}
                className="self-start"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="treatment">Treatment</Label>
            <div className="flex gap-2">
              <Input
                id="treatment"
                value={formData.treatment}
                onChange={(e) => setFormData(prev => ({ ...prev, treatment: e.target.value }))}
                placeholder="Treatment provided"
                className="flex-1"
              />
              <VoiceInputButton
                onTranscription={(text) => setFormData(prev => ({ ...prev, treatment: prev.treatment ? `${prev.treatment} ${text}` : text }))}
                disabled={!isOnline}
                className="self-start"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <div className="flex gap-2">
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes"
                className="flex-1"
              />
              <VoiceInputButton
                onTranscription={(text) => setFormData(prev => ({ ...prev, notes: prev.notes ? `${prev.notes} ${text}` : text }))}
                disabled={!isOnline}
                className="self-start"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Photos</Label>
            {isUploadingImage && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading photos...
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAddPhotosClick}
              disabled={saving || isUploadingImage}
            >
              <Camera className="h-4 w-4 mr-2" />
              {isUploadingImage ? "Uploading..." : "Add Photos"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {uploadedPhotos.map((url, index) => (
                  <div key={index} className="relative">
                    <img src={url} alt={`Photo ${index + 1}`} className="w-full h-20 object-cover rounded" />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={() => removePhoto(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)} 
              disabled={isUploadingImage}
              className="flex-1 min-h-[48px]"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={saving || isUploadingImage} 
              className="flex-1 min-h-[48px]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
