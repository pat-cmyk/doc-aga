import { useState, useMemo, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Wheat, CalendarIcon, AlertCircle, WifiOff } from "lucide-react";
import { VoiceFormInput } from "@/components/ui/VoiceFormInput";
import { ExtractedFeedData } from "@/lib/voiceFormExtractors";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { getCachedFeedInventory } from "@/lib/dataCache";
import { validateRecordDate } from "@/lib/recordValidation";
import { calculateCostPerKg } from "@/lib/feedSplitCalculation";

interface RecordSingleFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animalId: string;
  animalName: string;
  farmId: string;
  animalFarmEntryDate?: string | null;
  onSuccess?: () => void;
}

const FRESH_CUT_OPTION = "Fresh Cut and Carry";

export function RecordSingleFeedDialog({
  open,
  onOpenChange,
  animalId,
  animalName,
  farmId,
  animalFarmEntryDate,
  onSuccess,
}: RecordSingleFeedDialogProps) {
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [feedType, setFeedType] = useState("");
  const [kilograms, setKilograms] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cachedFeed, setCachedFeed] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  // Fetch feed inventory
  const { data: feedInventory = [], isLoading: isLoadingInventory } = useQuery({
    queryKey: ['feed-inventory-types', farmId],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase
        .from('feed_inventory')
        .select('id, feed_type, quantity_kg, cost_per_unit, unit, weight_per_unit, category')
        .eq('farm_id', farmId)
        .gt('quantity_kg', 0)
        .order('feed_type');
      if (error) throw error;
      return data || [];
    },
    enabled: !!farmId && isOnline,
  });

  // Load cached data when offline
  useEffect(() => {
    if (!isOnline && farmId) {
      getCachedFeedInventory(farmId).then(cached => {
        if (cached?.items) {
          setCachedFeed(cached.items.filter((f: any) => f.quantity_kg > 0));
        }
      });
    }
  }, [isOnline, farmId]);

  const displayFeedInventory = isOnline ? feedInventory : cachedFeed;

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
      setFeedType("");
      setKilograms("");
      setNotes("");
    }
  }, [open]);

  // Get selected feed inventory item
  const selectedFeedInventory = useMemo(() => {
    if (!feedType || feedType === FRESH_CUT_OPTION) return null;
    return displayFeedInventory.find(f => f.id === feedType);
  }, [feedType, displayFeedInventory]);

  // Calculate cost per kg
  const costPerKg = useMemo(() => {
    if (!selectedFeedInventory) return 0;
    return calculateCostPerKg(
      selectedFeedInventory.cost_per_unit,
      selectedFeedInventory.weight_per_unit,
      selectedFeedInventory.unit
    );
  }, [selectedFeedInventory]);

  // Check if over stock
  const isOverStock = useMemo(() => {
    if (!selectedFeedInventory) return false;
    const kg = parseFloat(kilograms);
    return !isNaN(kg) && kg > selectedFeedInventory.quantity_kg;
  }, [selectedFeedInventory, kilograms]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      hapticSelection();
      setRecordDate(date);
    }
  };

  const handleClose = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!farmId || !feedType || !kilograms) return;

    const kg = parseFloat(kilograms);
    if (isNaN(kg) || kg <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // Validate record date
    const dateValidation = validateRecordDate(
      format(recordDate, 'yyyy-MM-dd'),
      { farm_entry_date: animalFarmEntryDate }
    );
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
      const dateTime = format(recordDate, "yyyy-MM-dd'T'HH:mm:ss");
      const feedTypeName = feedType === FRESH_CUT_OPTION
        ? FRESH_CUT_OPTION
        : selectedFeedInventory?.feed_type || feedType;
      const cost = costPerKg > 0 ? Math.round(kg * costPerKg * 100) / 100 : undefined;

      // Build optimistic record
      const optimisticRecord = {
        id: `optimistic-${optimisticId}`,
        animal_id: animalId,
        record_datetime: dateTime,
        kilograms: kg,
        feed_type: feedTypeName,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
        optimisticId,
        syncStatus: isOnline ? 'syncing' : 'pending',
      };

      // Immediately update React Query cache
      queryClient.setQueryData(['feeding-records', animalId], (old: any[] = []) =>
        [optimisticRecord, ...old]
      );

      if (!isOnline) {
        // Queue for offline sync
        await addToQueue({
          id: `single_feed_${Date.now()}`,
          type: 'single_feed',
          payload: {
            farmId,
            singleFeed: {
              animalId,
              animalName,
              kilograms: kg,
              feedType: feedTypeName,
              feedInventoryId: feedType !== FRESH_CUT_OPTION ? selectedFeedInventory?.id : undefined,
              recordDate: dateTime,
              notes: notes.trim() || undefined,
              cost,
            },
          },
          createdAt: Date.now(),
          optimisticId,
        });

        hapticNotification('success');
        toast({
          title: "Queued for Sync",
          description: `${kg}kg feeding will sync when online`,
        });
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Insert feeding record with inventory link and cost lock
      const { error: insertError } = await supabase.from("feeding_records").insert({
        animal_id: animalId,
        record_datetime: dateTime,
        kilograms: kg,
        feed_type: feedTypeName,
        feed_inventory_id: feedType !== FRESH_CUT_OPTION ? selectedFeedInventory?.id : null,
        cost_per_kg_at_time: costPerKg > 0 ? costPerKg : null,
        notes: notes.trim() || null,
        created_by: user?.id,
      });

      if (insertError) throw insertError;

      // Deduct from inventory if not Fresh Cut and Carry
      if (feedType !== FRESH_CUT_OPTION && selectedFeedInventory) {
        const newQuantity = Math.max(0, selectedFeedInventory.quantity_kg - kg);

        const { error: updateError } = await supabase
          .from('feed_inventory')
          .update({
            quantity_kg: newQuantity,
            last_updated: new Date().toISOString()
          })
          .eq('id', selectedFeedInventory.id);

        if (updateError) {
          console.error('Failed to update inventory:', updateError);
        }

        // Create transaction record
        const { error: txError } = await supabase
          .from('feed_stock_transactions')
          .insert({
            feed_inventory_id: selectedFeedInventory.id,
            transaction_type: 'consumption',
            quantity_change_kg: -kg,
            balance_after: newQuantity,
            notes: `Single feeding: ${animalName}`,
            created_by: user?.id,
          });

        if (txError) {
          console.error('Failed to create transaction:', txError);
        }

        // Create expense record if cost data is available
        if (cost && cost > 0 && user?.id) {
          const { error: expenseError } = await supabase
            .from('farm_expenses')
            .insert({
              animal_id: animalId,
              farm_id: farmId,
              user_id: user.id,
              category: 'Feed & Supplements',
              amount: cost,
              description: `${feedTypeName} feeding: ${kg.toFixed(2)} kg`,
              expense_date: format(recordDate, 'yyyy-MM-dd'),
              allocation_type: 'Operational',
              linked_feed_inventory_id: selectedFeedInventory.id,
            });

          if (expenseError) {
            console.error('Failed to create expense record:', expenseError);
          }
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["feeding-records"] });
      queryClient.invalidateQueries({ queryKey: ["feed-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["feed-inventory-types"] });
      queryClient.invalidateQueries({ queryKey: ["daily-activity-compliance", farmId] });
      queryClient.invalidateQueries({ queryKey: ["animal-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });

      hapticNotification('success');
      toast({
        title: "Feed Recorded",
        description: `${kg}kg of ${feedTypeName} recorded for ${animalName}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error recording feed:", error);

      // Rollback optimistic update
      queryClient.setQueryData(['feeding-records', animalId], (old: any[] = []) =>
        old.filter((r: any) => r.optimisticId !== optimisticId)
      );

      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to record feeding",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = feedType && parseFloat(kilograms) > 0 && !isOverStock;
  const isLoading = isLoadingInventory && isOnline;

  const handleVoiceDataExtracted = (data: ExtractedFeedData) => {
    if (data.totalKg) setKilograms(data.totalKg.toString());
    if (data.feedType) setFeedType(data.feedType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wheat className="h-5 w-5 text-orange-500" />
            Record Feed
            {!isOnline && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
            {isOnline && (
              <VoiceFormInput
                extractorType="feed"
                extractorContext={{ feedInventory: displayFeedInventory }}
                onDataExtracted={handleVoiceDataExtracted}
                disabled={isLoading}
                offlineMode="queue"
                formType="feed"
                size="sm"
                className="ml-auto"
              />
            )}
          </DialogTitle>
          <DialogDescription>
            Record feed for {animalName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

            {/* Feed Type Selection */}
            <div className="space-y-2">
              <Label>Feed Type</Label>
              <Select value={feedType} onValueChange={(v) => { hapticSelection(); setFeedType(v); }}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Select feed type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FRESH_CUT_OPTION}>
                    <div className="flex flex-col">
                      <span>Fresh Cut and Carry</span>
                      <span className="text-xs text-muted-foreground">No inventory deduction</span>
                    </div>
                  </SelectItem>
                  {displayFeedInventory.map((feed) => (
                    <SelectItem key={feed.id} value={feed.id}>
                      <div className="flex flex-col">
                        <span>{feed.feed_type}</span>
                        <span className="text-xs text-muted-foreground">
                          Available: {feed.quantity_kg.toFixed(1)} kg
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedFeedInventory && (
                <p className="text-xs text-muted-foreground">
                  Available: {selectedFeedInventory.quantity_kg.toFixed(1)} kg
                </p>
              )}
            </div>

            {/* Kilograms Input */}
            <div className="space-y-2">
              <Label htmlFor="kilograms">Kilograms</Label>
              <Input
                id="kilograms"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 5"
                value={kilograms}
                onChange={(e) => setKilograms(e.target.value)}
                onFocus={() => hapticImpact('light')}
                className="min-h-[48px]"
              />
              {isOverStock && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                  <span className="text-sm text-destructive">
                    Amount exceeds available stock ({selectedFeedInventory?.quantity_kg.toFixed(1)} kg). 
                    Reduce quantity or add more stock first.
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
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
                    Saving...
                  </>
                ) : !isOnline ? (
                  "Queue for Sync"
                ) : (
                  "Record Feed"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
