import { useState, useMemo, useEffect, useCallback } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Milk, Scale, TrendingUp, CalendarIcon, Sun, Moon, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useLactatingAnimals,
  getAnimalDropdownOptions,
  getSelectedAnimals,
} from "@/hooks/useLactatingAnimals";
import { calculateMilkSplit, MilkSplitResult } from "@/lib/milkSplitCalculation";
import { AnimalCombobox } from "./AnimalCombobox";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { VoiceFormInput } from "@/components/ui/VoiceFormInput";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { getCachedAnimals, addLocalMilkRecord, addLocalMilkInventoryRecord } from "@/lib/dataCache";
import { ExtractedMilkData } from "@/lib/voiceFormExtractors";
import { calculateMilkingStageFromDays } from "@/lib/animalStages";
import { useFarm } from "@/contexts/FarmContext";

interface RecordBulkMilkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string | null;
}

export function RecordBulkMilkDialog({
  open,
  onOpenChange,
  farmId,
}: RecordBulkMilkDialogProps) {
  const [selectedOption, setSelectedOption] = useState("");
  const [totalLiters, setTotalLiters] = useState("");
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [session, setSession] = useState<'AM' | 'PM'>(
    new Date().getHours() < 12 ? 'AM' : 'PM'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cachedAnimals, setCachedAnimals] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { maxBackdateDays } = useFarm();

  const { data: animals = [], isLoading } = useLactatingAnimals(farmId);

  // Load cached animals when offline
  useEffect(() => {
    if (!isOnline && farmId) {
      getCachedAnimals(farmId).then(cached => {
        if (cached?.data) {
          // Filter for lactating animals only (matching online query behavior)
          const lactating = cached.data.filter((a: any) => {
            if (a.gender?.toLowerCase() !== 'female') return false;
            
            // Check is_currently_lactating flag first
            if (a.is_currently_lactating) return true;
            
            // Then check milking stage with case-insensitive matching
            const stage = (a.milkingStage || a.milking_stage || '').toLowerCase();
            return ['early lactation', 'mid-lactation', 'late lactation'].includes(stage);
          });
          setCachedAnimals(lactating);
        }
      });
    }
  }, [isOnline, farmId]);

  // Use cached animals when offline
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
      setTotalLiters("");
      setRecordDate(new Date());
      setSession(new Date().getHours() < 12 ? 'AM' : 'PM');
    }
  }, [open]);

  const selectedAnimals = useMemo(
    () => getSelectedAnimals(displayAnimals, selectedOption),
    [displayAnimals, selectedOption]
  );

  const splitPreview = useMemo(() => {
    const liters = parseFloat(totalLiters);
    if (!selectedAnimals.length || isNaN(liters) || liters <= 0) {
      return [];
    }
    return calculateMilkSplit(selectedAnimals, liters);
  }, [selectedAnimals, totalLiters]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      hapticSelection();
      setRecordDate(date);
    }
  };

  const handleSessionChange = (value: string) => {
    hapticSelection();
    setSession(value as 'AM' | 'PM');
  };

  const handleAnimalChange = (value: string) => {
    setSelectedOption(value);
  };

  const handleClose = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  const handleVoiceDataExtracted = (data: ExtractedMilkData) => {
    let updatedOption = selectedOption;
    
    if (data.totalLiters) {
      setTotalLiters(data.totalLiters.toString());
    }
    if (data.session) {
      setSession(data.session);
    }
    if (data.animalSelection === 'all-lactating' && dropdownOptions.length > 0) {
      // Find the "all lactating" option
      const allOption = dropdownOptions.find(opt => 
        opt.value.startsWith('all-') || opt.label.toLowerCase().includes('all')
      );
      if (allOption) {
        setSelectedOption(allOption.value);
        updatedOption = allOption.value;
      }
    }
    
    // Return whether form is complete for auto-submit check
    return updatedOption && data.totalLiters && data.totalLiters > 0;
  };

  // Check if form is complete based on extracted data
  const isFormCompleteForAutoSubmit = useCallback((data: ExtractedMilkData): boolean => {
    // For auto-submit, we need: liters > 0 AND animals selected (via 'all-lactating' in voice)
    const hasLiters = !!data.totalLiters && data.totalLiters > 0;
    const hasAnimalHint = data.animalSelection === 'all-lactating';
    const hasAnimalsAlreadySelected = selectedOption.length > 0;
    
    return hasLiters && (hasAnimalHint || hasAnimalsAlreadySelected);
  }, [selectedOption]);

  const handleSubmit = async () => {
    if (!farmId || splitPreview.length === 0) return;

    setIsSubmitting(true);
    const optimisticId = crypto.randomUUID();
    
    try {
      const dateStr = format(recordDate, "yyyy-MM-dd");
      const totalLitersNum = parseFloat(totalLiters);

      // STEP 1: Update local dashboard cache IMMEDIATELY for instant UI feedback
      await addLocalMilkRecord(farmId, dateStr, totalLitersNum);

      // STEP 2: Update local milk inventory cache for EACH record
      // Use consistent client_generated_id format that matches syncService
      for (let index = 0; index < splitPreview.length; index++) {
        const split = splitPreview[index];
        const clientId = `${optimisticId}_milk_${index}`; // Matches syncService format
        
        await addLocalMilkInventoryRecord(farmId, {
          id: `optimistic-${clientId}`,
          milking_record_id: clientId, // This is the client_generated_id for reconciliation
          animal_id: split.animalId,
          animal_name: split.animalName,
          ear_tag: null,
          record_date: dateStr,
          liters_original: split.liters,
          liters_remaining: split.liters,
          is_available: true,
          created_at: new Date().toISOString(),
          syncStatus: 'pending',
        });
      }

      // Build optimistic records for immediate UI update
      const optimisticRecords = splitPreview.map((split) => ({
        id: `optimistic-${optimisticId}-${split.animalId}`,
        animal_id: split.animalId,
        record_date: dateStr,
        liters: split.liters,
        session: session,
        is_sold: false,
        created_at: new Date().toISOString(),
        optimisticId,
        syncStatus: isOnline ? 'syncing' : 'pending',
      }));

      // Immediately update React Query cache for instant UI feedback
      queryClient.setQueryData(['milking-records', farmId], (old: any[] = []) => 
        [...optimisticRecords, ...old]
      );

      // Refetch milk inventory to merge optimistic data with cache
      await queryClient.refetchQueries({ 
        queryKey: ['milk-inventory', farmId],
        type: 'active',
      });

      if (!isOnline) {
        // Queue for offline sync
        await addToQueue({
          id: `bulk_milk_${Date.now()}`,
          type: 'bulk_milk',
          payload: {
            farmId,
            milkRecords: splitPreview.map((split) => ({
              animalId: split.animalId,
              animalName: split.animalName,
              liters: split.liters,
              recordDate: dateStr,
              session: session,
            })),
          },
          createdAt: Date.now(),
          optimisticId,
        });

        hapticNotification('success');
        toast({
          title: "Queued for Sync",
          description: `${totalLiters}L (${session}) will sync when online`,
        });
        onOpenChange(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Create milking records for each animal
      const records = splitPreview.map((split) => ({
        animal_id: split.animalId,
        record_date: dateStr,
        liters: split.liters,
        session: session,
        created_by: user?.id,
        is_sold: false,
      }));

      const { error } = await supabase.from("milking_records").insert(records);

      if (error) throw error;

      // Update is_currently_lactating and milking_stage for all animals that just had milk recorded
      const animalIds = [...new Set(records.map(r => r.animal_id))];
      
      for (const animalId of animalIds) {
        const animal = selectedAnimals.find(a => a.id === animalId);
        if (!animal) continue;

        // Check if this is a new lactation cycle (was dry or no milking_start_date)
        const wasDry = !animal.is_currently_lactating || animal.milking_stage === 'Dry Period';
        const hasNoStartDate = !animal.milking_start_date;

        if (wasDry || hasNoStartDate) {
          // Start new lactation cycle
          await supabase
            .from('animals')
            .update({ 
              is_currently_lactating: true,
              milking_start_date: dateStr,
              milking_stage: 'Early Lactation',
            })
            .eq('id', animalId);
        } else {
          // Calculate and update milking stage based on days since start
          const newStage = calculateMilkingStageFromDays(
            animal.milking_start_date,
            animal.estimated_days_in_milk
          );
          
          await supabase
            .from('animals')
            .update({ 
              is_currently_lactating: true,
              ...(newStage && { milking_stage: newStage }),
            })
            .eq('id', animalId);
        }
      }

      // Refetch queries to sync with server data (don't clear IndexedDB)
      await queryClient.refetchQueries({ 
        queryKey: ['milk-inventory', farmId],
        type: 'active',
      });
      await queryClient.refetchQueries({ 
        queryKey: ['dashboard', farmId],
        type: 'active',
      });

      hapticNotification('success');
      toast({
        title: "Milk Recorded",
        description: `${totalLiters}L (${session}) split across ${splitPreview.length} animal${splitPreview.length > 1 ? "s" : ""}`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error recording milk:", error);
      
      // Rollback optimistic update
      queryClient.setQueryData(['milking-records', farmId], (old: any[] = []) => 
        old.filter((r: any) => r.optimisticId !== optimisticId)
      );
      
      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to record milk production",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedAnimals.length > 0 && parseFloat(totalLiters) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Milk className="h-5 w-5 text-blue-500" />
            Record Milk Production
            <div className="ml-auto flex items-center gap-2">
              <VoiceFormInput
                extractorType="milk"
                onDataExtracted={handleVoiceDataExtracted}
                disabled={isLoading || displayAnimals.length === 0}
                offlineMode="queue"
                formType="milk"
                size="sm"
                autoSubmit={displayAnimals.length > 0}
                onAutoSubmit={handleSubmit}
                isFormComplete={isFormCompleteForAutoSubmit}
                autoSubmitDelay={2500}
              />
              {!isOnline && (
                <span className="flex items-center gap-1 text-xs font-normal text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </span>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            Record milk collected and split proportionally by weight and lactation stage
          </DialogDescription>
        </DialogHeader>

        {isLoading && isOnline ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayAnimals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Milk className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No lactating animals in your herd</p>
            <p className="text-sm mt-1">
              Animals must be in Early, Mid, or Late Lactation stage
            </p>
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
                      date > new Date() || date < subDays(new Date(), maxBackdateDays)
                    }
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* AM/PM Session */}
            <div className="space-y-2">
              <Label>Session</Label>
              <RadioGroup
                value={session}
                onValueChange={handleSessionChange}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="AM" id="am" />
                  <Label htmlFor="am" className="flex items-center gap-1.5 cursor-pointer">
                    <Sun className="h-4 w-4 text-amber-500" />
                    Morning
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PM" id="pm" />
                  <Label htmlFor="pm" className="flex items-center gap-1.5 cursor-pointer">
                    <Moon className="h-4 w-4 text-indigo-500" />
                    Evening
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Animal Selection - Searchable Combobox */}
            <div className="space-y-2">
              <Label>Select Animals</Label>
              <AnimalCombobox
                options={dropdownOptions}
                value={selectedOption}
                onChange={handleAnimalChange}
                placeholder="Search or select animals..."
              />
            </div>

            {/* Total Liters */}
            <div className="space-y-2">
              <Label htmlFor="total-liters">Total Liters Collected</Label>
              <Input
                id="total-liters"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 25.5"
                value={totalLiters}
                onChange={(e) => setTotalLiters(e.target.value)}
                onFocus={() => hapticImpact('light')}
                className="min-h-[48px]"
              />
            </div>

            {/* Split Preview */}
            {splitPreview.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Split Preview
                </div>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {splitPreview.map((split) => (
                    <SplitPreviewRow key={split.animalId} split={split} />
                  ))}
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
                  "Record Milk"
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

function SplitPreviewRow({ split }: { split: MilkSplitResult }) {
  return (
    <div className="flex items-center justify-between text-sm bg-background rounded px-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium truncate">{split.animalName}</span>
        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
          <Scale className="h-3 w-3" />
          {split.weight}kg
        </span>
      </div>
      <span className="font-semibold text-blue-600 shrink-0 ml-2">
        {split.liters.toFixed(1)}L
      </span>
    </div>
  );
}
