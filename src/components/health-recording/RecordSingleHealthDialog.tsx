import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Heart, CalendarIcon, WifiOff, Camera, X, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { HEALTH_CATEGORIES, QUICK_DIAGNOSES, QUICK_TREATMENTS } from "@/lib/healthCategories";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { validateRecordDate } from "@/lib/recordValidation";
import { useFarm } from "@/contexts/FarmContext";

interface RecordSingleHealthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animalId: string;
  animalName: string;
  earTag?: string | null;
  farmId: string;
  animalFarmEntryDate?: string | null;
  onSuccess?: () => void;
}

export function RecordSingleHealthDialog({
  open,
  onOpenChange,
  animalId,
  animalName,
  earTag,
  farmId,
  animalFarmEntryDate,
  onSuccess,
}: RecordSingleHealthDialogProps) {
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { maxBackdateDays } = useFarm();

  // Haptic on dialog open
  useEffect(() => {
    if (open) {
      hapticImpact('light');
    }
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setRecordDate(new Date());
      setSelectedCategory("");
      setDiagnosis("");
      setTreatment("");
      setNotes("");
      setUploadedPhotos([]);
    }
  }, [open]);

  const currentQuickDiagnoses = useMemo(() => {
    return selectedCategory ? QUICK_DIAGNOSES[selectedCategory] || [] : [];
  }, [selectedCategory]);

  const currentQuickTreatments = useMemo(() => {
    return selectedCategory ? QUICK_TREATMENTS[selectedCategory] || [] : [];
  }, [selectedCategory]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      hapticSelection();
      setRecordDate(date);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    hapticSelection();
    setSelectedCategory(categoryId);
    setDiagnosis("");
    setTreatment("");
  };

  const handleQuickDiagnosisSelect = (value: string) => {
    hapticSelection();
    setDiagnosis(value);
  };

  const handleQuickTreatmentSelect = (value: string) => {
    hapticSelection();
    setTreatment(value);
  };

  const handleClose = () => {
    if (isUploadingImage) {
      toast({
        title: "Upload in progress",
        description: "Please wait for photos to finish uploading",
        variant: "destructive",
      });
      return;
    }
    hapticImpact('light');
    onOpenChange(false);
  };

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
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
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
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const compressedBlob = await compressImage(file);
        
        const fileName = `${animalId}-health-${Date.now()}-${i}.jpg`;
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
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(uploadedPhotos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!diagnosis) {
      toast({
        title: "Missing field",
        description: "Diagnosis is required",
        variant: "destructive",
      });
      return;
    }

    const dateStr = format(recordDate, "yyyy-MM-dd");
    
    // Validate date against farm entry
    const dateValidation = validateRecordDate(dateStr, { farm_entry_date: animalFarmEntryDate });
    if (!dateValidation.valid) {
      toast({
        title: "Invalid Date",
        description: dateValidation.message,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const optimisticId = crypto.randomUUID();
    
    try {
      // Build optimistic record for immediate UI update
      const optimisticRecord = {
        id: `optimistic-${optimisticId}`,
        animal_id: animalId,
        visit_date: dateStr,
        diagnosis: diagnosis,
        treatment: treatment || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
        optimisticId,
        syncStatus: isOnline ? 'syncing' : 'pending',
      };

      // Update React Query cache for instant feedback
      queryClient.setQueryData(['health-records', animalId], (old: any[] = []) => 
        [optimisticRecord, ...old]
      );

      if (!isOnline) {
        // Queue for offline sync (photos disabled offline)
        await addToQueue({
          id: `single_health_${Date.now()}`,
          type: 'single_health',
          payload: {
            farmId,
            singleHealth: {
              animalId,
              animalName,
              visitDate: dateStr,
              category: selectedCategory || undefined,
              diagnosis,
              treatment: treatment || undefined,
              notes: notes || undefined,
            },
          },
          createdAt: Date.now(),
          optimisticId,
        });

        hapticNotification('success');
        toast({
          title: "Queued for Sync",
          description: `Health record will sync when online`,
        });
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Insert health record
      const { data: record, error: recordError } = await supabase
        .from("health_records")
        .insert({
          animal_id: animalId,
          visit_date: dateStr,
          diagnosis,
          treatment: treatment || null,
          notes: notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (recordError) throw recordError;

      // Insert photos if any
      if (uploadedPhotos.length > 0 && record) {
        const photoRecords = uploadedPhotos.map(url => ({
          animal_id: animalId,
          photo_path: url,
          label: `Health Record - ${dateStr}`
        }));

        const { error: photosError } = await supabase
          .from("animal_photos")
          .insert(photoRecords);

        if (photosError) {
          console.error('Failed to save photo records:', photosError);
        }
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["health-records"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["animal"] });

      hapticNotification('success');
      toast({
        title: "Health Record Added",
        description: `Recorded ${diagnosis}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error recording health:", error);
      
      // Rollback optimistic update
      queryClient.setQueryData(['health-records', animalId], (old: any[] = []) => 
        old.filter((r: any) => r.optimisticId !== optimisticId)
      );
      
      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to record health event",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = diagnosis.length > 0 && !isUploadingImage;
  const displayName = animalName || earTag || 'Unknown Animal';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Record Health Event
            {!isOnline && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Record veterinary visit for {displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Animal Display (Read-only) */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{displayName}</span>
              {earTag && animalName && (
                <span className="text-sm text-muted-foreground">({earTag})</span>
              )}
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left min-h-[48px]",
                    !recordDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(recordDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={recordDate}
                  onSelect={handleDateSelect}
                  disabled={(date) =>
                    date > new Date() || date < subDays(new Date(), maxBackdateDays)
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {HEALTH_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategory === category.id;
                return (
                  <Button
                    key={category.id}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "h-auto py-2 px-2 flex flex-col items-center gap-1",
                      isSelected && "ring-2 ring-primary ring-offset-2"
                    )}
                    onClick={() => handleCategorySelect(category.id)}
                  >
                    <Icon className={cn("h-4 w-4", !isSelected && category.color)} />
                    <span className="text-xs">{category.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Quick Diagnosis Picks */}
          {currentQuickDiagnoses.length > 0 && (
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <div className="flex flex-wrap gap-2">
                {currentQuickDiagnoses.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={diagnosis === item ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => handleQuickDiagnosisSelect(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Or type custom diagnosis..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  onFocus={() => hapticImpact('light')}
                  className="min-h-[48px] flex-1"
                />
                <VoiceInputButton
                  onTranscription={(text) => setDiagnosis(prev => prev ? `${prev} ${text}` : text)}
                  disabled={!isOnline}
                />
              </div>
            </div>
          )}

          {/* Custom Diagnosis (when no category or other selected) */}
          {(selectedCategory === '' || selectedCategory === 'other') && (
            <div className="space-y-2">
              <Label>Diagnosis *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter diagnosis..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  onFocus={() => hapticImpact('light')}
                  className="min-h-[48px] flex-1"
                />
                <VoiceInputButton
                  onTranscription={(text) => setDiagnosis(prev => prev ? `${prev} ${text}` : text)}
                  disabled={!isOnline}
                />
              </div>
            </div>
          )}

          {/* Quick Treatment Picks */}
          {currentQuickTreatments.length > 0 && (
            <div className="space-y-2">
              <Label>Treatment</Label>
              <div className="flex flex-wrap gap-2">
                {currentQuickTreatments.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={treatment === item ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => handleQuickTreatmentSelect(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Or type custom treatment..."
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  onFocus={() => hapticImpact('light')}
                  className="min-h-[48px] flex-1"
                />
                <VoiceInputButton
                  onTranscription={(text) => setTreatment(prev => prev ? `${prev} ${text}` : text)}
                  disabled={!isOnline}
                />
              </div>
            </div>
          )}

          {/* Custom Treatment (when no category or other selected) */}
          {(selectedCategory === '' || selectedCategory === 'other') && (
            <div className="space-y-2">
              <Label>Treatment</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter treatment..."
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  onFocus={() => hapticImpact('light')}
                  className="min-h-[48px] flex-1"
                />
                <VoiceInputButton
                  onTranscription={(text) => setTreatment(prev => prev ? `${prev} ${text}` : text)}
                  disabled={!isOnline}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <div className="flex gap-2">
              <Textarea
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onFocus={() => hapticImpact('light')}
                className="min-h-[80px] flex-1"
              />
              <VoiceInputButton
                onTranscription={(text) => setNotes(prev => prev ? `${prev} ${text}` : text)}
                className="self-start"
                disabled={!isOnline}
              />
            </div>
          </div>

          {/* Photos (only when online) */}
          <div className="space-y-2">
            <Label>Photos</Label>
            {!isOnline ? (
              <p className="text-sm text-muted-foreground">Photos available when online</p>
            ) : (
              <>
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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || isUploadingImage}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {isUploadingImage ? "Uploading..." : "Add Photos"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                {uploadedPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {uploadedPhotos.map((url, index) => (
                      <div key={index} className="relative">
                        <img
                          src={url}
                          alt={`Upload ${index + 1}`}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting || isUploadingImage}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : !isOnline ? (
                "Queue for Sync"
              ) : (
                "Record Health"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
