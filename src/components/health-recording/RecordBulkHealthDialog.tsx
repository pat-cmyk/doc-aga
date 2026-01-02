import { useState, useMemo, useEffect } from "react";
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
import { Loader2, Heart, CalendarIcon, Users, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFarmAnimals, getAnimalDropdownOptions, getSelectedAnimals } from "@/hooks/useFarmAnimals";
import { AnimalCombobox } from "@/components/milk-recording/AnimalCombobox";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { HEALTH_CATEGORIES, QUICK_DIAGNOSES, QUICK_TREATMENTS } from "@/lib/healthCategories";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { getCachedAnimals } from "@/lib/dataCache";

interface RecordBulkHealthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string | null;
}

export function RecordBulkHealthDialog({
  open,
  onOpenChange,
  farmId,
}: RecordBulkHealthDialogProps) {
  const [selectedOption, setSelectedOption] = useState("");
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cachedAnimals, setCachedAnimals] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const { data: animals = [], isLoading } = useFarmAnimals(farmId);

  // Load cached animals when offline
  useEffect(() => {
    if (!isOnline && farmId) {
      getCachedAnimals(farmId).then(cached => {
        if (cached?.data) {
          setCachedAnimals(cached.data);
        }
      });
    }
  }, [isOnline, farmId]);

  const displayAnimals = isOnline ? animals : cachedAnimals;
  const dropdownOptions = useMemo(() => getAnimalDropdownOptions(displayAnimals), [displayAnimals]);

  // Haptic on dialog open
  useEffect(() => {
    if (open) {
      hapticImpact('light');
    }
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedOption("");
      setRecordDate(new Date());
      setSelectedCategory("");
      setDiagnosis("");
      setTreatment("");
      setNotes("");
    }
  }, [open]);

  const selectedAnimals = useMemo(
    () => getSelectedAnimals(displayAnimals, selectedOption),
    [displayAnimals, selectedOption]
  );

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
    // Clear diagnosis and treatment when category changes
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

  const handleAnimalChange = (value: string) => {
    setSelectedOption(value);
  };

  const handleClose = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!farmId || selectedAnimals.length === 0 || !diagnosis) return;

    setIsSubmitting(true);
    const optimisticId = crypto.randomUUID();
    
    try {
      const dateStr = format(recordDate, "yyyy-MM-dd");

      // Build optimistic records for immediate UI update
      const optimisticRecords = selectedAnimals.map((animal) => ({
        id: `optimistic-${optimisticId}-${animal.id}`,
        animal_id: animal.id,
        visit_date: dateStr,
        diagnosis: diagnosis,
        treatment: treatment || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
        optimisticId,
        syncStatus: isOnline ? 'syncing' : 'pending',
      }));

      // Immediately update React Query cache for instant UI feedback
      queryClient.setQueryData(['health-records', farmId], (old: any[] = []) => 
        [...optimisticRecords, ...old]
      );

      if (!isOnline) {
        // Queue for offline sync
        await addToQueue({
          id: `bulk_health_${Date.now()}`,
          type: 'bulk_health',
          payload: {
            farmId,
            healthRecords: selectedAnimals.map((animal) => ({
              animalId: animal.id,
              animalName: animal.name || animal.ear_tag || 'Unknown',
            })),
            diagnosis,
            treatment: treatment || undefined,
            notes: notes || undefined,
            recordDate: dateStr,
          },
          createdAt: Date.now(),
          optimisticId,
        });

        hapticNotification('success');
        toast({
          title: "Queued for Sync",
          description: `Health record for ${selectedAnimals.length} animal(s) will sync when online`,
        });
        onOpenChange(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Create health records for each animal
      const records = selectedAnimals.map((animal) => ({
        animal_id: animal.id,
        visit_date: dateStr,
        diagnosis: diagnosis,
        treatment: treatment || null,
        notes: notes || null,
        created_by: user?.id,
      }));

      const { error } = await supabase.from("health_records").insert(records);

      if (error) throw error;

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["health-records"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["animal"] });

      hapticNotification('success');
      toast({
        title: "Health Records Added",
        description: `Recorded ${diagnosis} for ${selectedAnimals.length} animal${selectedAnimals.length > 1 ? "s" : ""}`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error recording health:", error);
      
      // Rollback optimistic update
      queryClient.setQueryData(['health-records', farmId], (old: any[] = []) => 
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

  const canSubmit = selectedAnimals.length > 0 && diagnosis.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            Record veterinary visits and treatments for your animals
          </DialogDescription>
        </DialogHeader>

        {isLoading && isOnline ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayAnimals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No animals in your herd</p>
            <p className="text-sm mt-1">Add animals first to record health events</p>
          </div>
        ) : (
          <div className="space-y-4">
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
                      date > new Date() || date < subDays(new Date(), 7)
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

            {/* Animal Selection */}
            <div className="space-y-2">
              <Label>Select Animals</Label>
              <AnimalCombobox
                options={dropdownOptions}
                value={selectedOption}
                onChange={handleAnimalChange}
                placeholder="Search or select animals..."
              />
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

            {/* Preview */}
            {selectedAnimals.length > 0 && diagnosis && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Preview
                </div>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">{selectedAnimals.length}</span> animal{selectedAnimals.length > 1 ? "s" : ""} will receive:
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Diagnosis:</span> {diagnosis}
                  </p>
                  {treatment && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Treatment:</span> {treatment}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 min-h-[48px]"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 min-h-[48px]"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isOnline ? "Recording..." : "Queuing..."}
                  </>
                ) : isOnline ? (
                  "Record Health"
                ) : (
                  "Queue for Sync"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
