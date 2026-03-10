import { useState, useMemo, useEffect, useCallback } from "react";
import { compressImage } from "@/lib/imageUtils";
import { useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { VoiceRecordWithExtraction } from "@/components/ui/VoiceRecordWithExtraction";
import type { ExtractedHealthData } from "@/lib/voiceFormExtractors";
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
import { Loader2, Heart, CalendarIcon, WifiOff, X, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { HEALTH_CATEGORIES, QUICK_DIAGNOSES, QUICK_TREATMENTS } from "@/lib/healthCategories";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { CameraPhotoInput } from "@/components/ui/camera-photo-input";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { addPhoto } from "@/lib/offlinePhotoQueue";
import { addOptimisticRecords, addLocalHealthEvent } from "@/lib/dataCache";
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
  const [offlinePhotoIds, setOfflinePhotoIds] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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
      setOfflinePhotoIds([]);
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

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    if (!isOnline) {
      // Queue photo offline
      try {
        const compressedBlob = await compressImage(file);
        const fileName = `${animalId}-health-${Date.now()}.jpg`;
        const photoId = await addPhoto(compressedBlob, {
          fileName,
          mimeType: 'image/jpeg',
          target: 'health_record',
          animalId,
          farmId,
        });
        setOfflinePhotoIds(prev => [...prev, photoId]);
        toast({
          title: "Photo queued",
          description: "Photo will upload when online",
        });
      } catch (error: any) {
        toast({
          title: "Failed to queue photo",
          description: error.message,
          variant: "destructive",
        });
      }
      return;
    }

    setIsUploadingImage(true);

    try {
      const compressedBlob = await compressImage(file);
      
      const fileName = `${animalId}-health-${Date.now()}.jpg`;
      const filePath = `${farmId}/health/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('animal-photos')
        .upload(filePath, compressedBlob, {
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('animal-photos')
        .getPublicUrl(filePath);

      setUploadedPhotos([...uploadedPhotos, publicUrl]);
      toast({
        title: "Photo uploaded",
        description: "Photo added successfully"
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
        // Persist to IndexedDB for offline-first — survives reload
        await addOptimisticRecords(farmId, 'health', [{
          animalId,
          visit_date: dateStr,
          diagnosis,
          treatment: treatment || null,
          notes: notes || null,
        }], optimisticId);

        // Update dashboard health counter in IndexedDB
        await addLocalHealthEvent(farmId, 1);

        // Queue for server sync when online
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
            pendingPhotoIds: offlinePhotoIds.length > 0 ? offlinePhotoIds : undefined,
          },
          createdAt: Date.now(),
          optimisticId,
        });

        hapticNotification('success');
        toast({
          title: "✅ Health Recorded",
          description: `Health record saved. Syncs automatically when online`,
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

  const handleVoiceDataExtracted = useCallback((data: ExtractedHealthData) => {
    if (data.category) setSelectedCategory(data.category);
    if (data.diagnosis) setDiagnosis(data.diagnosis);
    if (data.treatment) setTreatment(data.treatment);
    if (data.notes) setNotes(data.notes);
  }, []);

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
            <VoiceRecordWithExtraction
              extractorType="health"
              onDataExtracted={handleVoiceDataExtracted}
              size="sm"
              className="ml-auto"
            />
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
                  source="health-form"
                  extractorType="health"
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
                  source="health-form"
                  extractorType="health"
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
                  source="health-form"
                  extractorType="health"
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
                  source="health-form"
                  extractorType="health"
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
                source="health-form"
                extractorType="health"
              />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>Photos {!isOnline && offlinePhotoIds.length > 0 && <span className="text-xs text-muted-foreground">({offlinePhotoIds.length} queued)</span>}</Label>
            {isUploadingImage && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading photo...
              </div>
            )}
            <CameraPhotoInput
              onPhotoSelected={handlePhotoUpload}
              onError={(error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" })}
              variant="outline"
              label={isUploadingImage ? "Uploading..." : !isOnline ? "Add Photo (offline)" : "Add Photo"}
              disabled={isSubmitting || isUploadingImage}
              className="w-full"
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
                  Recording...
                </>
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
