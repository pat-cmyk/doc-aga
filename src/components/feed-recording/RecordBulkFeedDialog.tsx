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
import { Loader2, Wheat, Scale, TrendingUp, CalendarIcon, AlertCircle, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useFarmAnimals,
  getAnimalDropdownOptions,
  getSelectedAnimals,
} from "@/hooks/useFarmAnimals";
import { calculateFeedSplit, calculateCostPerKg, FeedSplitResult } from "@/lib/feedSplitCalculation";
import { AnimalCombobox } from "@/components/milk-recording/AnimalCombobox";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { getCachedAnimals, getCachedFeedInventory } from "@/lib/dataCache";

interface RecordBulkFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string | null;
}

const FRESH_CUT_OPTION = "Fresh Cut and Carry";

export function RecordBulkFeedDialog({
  open,
  onOpenChange,
  farmId,
}: RecordBulkFeedDialogProps) {
  const [selectedOption, setSelectedOption] = useState("");
  const [totalKg, setTotalKg] = useState("");
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [feedType, setFeedType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cachedAnimals, setCachedAnimals] = useState<any[]>([]);
  const [cachedFeed, setCachedFeed] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  // Fetch animals
  const { data: animals = [], isLoading: isLoadingAnimals } = useFarmAnimals(farmId);
  
  // Fetch feed inventory for feed types (including cost data)
  const { data: feedInventory = [], isLoading: isLoadingInventory } = useQuery({
    queryKey: ['feed-inventory-types', farmId],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase
        .from('feed_inventory')
        .select('id, feed_type, quantity_kg, cost_per_unit, unit, weight_per_unit')
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
      getCachedAnimals(farmId).then(cached => {
        if (cached?.data) {
          setCachedAnimals(cached.data);
        }
      });
      getCachedFeedInventory(farmId).then(cached => {
        if (cached?.items) {
          setCachedFeed(cached.items.filter((f: any) => f.quantity_kg > 0));
        }
      });
    }
  }, [isOnline, farmId]);

  const displayAnimals = isOnline ? animals : cachedAnimals;
  const displayFeedInventory = isOnline ? feedInventory : cachedFeed;
  const dropdownOptions = useMemo(() => getAnimalDropdownOptions(displayAnimals), [displayAnimals]);
  
  // Get available quantity for selected feed type
  const selectedFeedInventory = useMemo(() => {
    if (!feedType || feedType === FRESH_CUT_OPTION) return null;
    return displayFeedInventory.find(f => f.id === feedType);
  }, [feedType, displayFeedInventory]);

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
      setTotalKg("");
      setRecordDate(new Date());
      setFeedType("");
    }
  }, [open]);

  const selectedAnimals = useMemo(
    () => getSelectedAnimals(displayAnimals, selectedOption),
    [displayAnimals, selectedOption]
  );

  // Calculate cost per kg for selected feed
  const costPerKg = useMemo(() => {
    if (!selectedFeedInventory) return 0;
    return calculateCostPerKg(
      selectedFeedInventory.cost_per_unit,
      selectedFeedInventory.weight_per_unit,
      selectedFeedInventory.unit
    );
  }, [selectedFeedInventory]);

  const splitPreview = useMemo(() => {
    const kg = parseFloat(totalKg);
    if (!selectedAnimals.length || isNaN(kg) || kg <= 0) {
      return [];
    }
    return calculateFeedSplit(selectedAnimals, kg, costPerKg);
  }, [selectedAnimals, totalKg, costPerKg]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      hapticSelection();
      setRecordDate(date);
    }
  };

  const handleAnimalChange = (value: string) => {
    setSelectedOption(value);
  };

  const handleClose = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  const isOverStock = useMemo(() => {
    if (!selectedFeedInventory) return false;
    const kg = parseFloat(totalKg);
    return !isNaN(kg) && kg > selectedFeedInventory.quantity_kg;
  }, [selectedFeedInventory, totalKg]);

  const handleSubmit = async () => {
    if (!farmId || splitPreview.length === 0 || !feedType) return;

    setIsSubmitting(true);
    try {
      const dateTime = format(recordDate, "yyyy-MM-dd'T'HH:mm:ss");
      const feedTypeName = feedType === FRESH_CUT_OPTION 
        ? FRESH_CUT_OPTION 
        : selectedFeedInventory?.feed_type || feedType;

      if (!isOnline) {
        // Queue for offline sync
        await addToQueue({
          id: `bulk_feed_${Date.now()}`,
          type: 'bulk_feed',
          payload: {
            farmId,
            feedRecords: splitPreview.map((split) => ({
              animalId: split.animalId,
              animalName: split.animalName,
              kilograms: split.kilograms,
              cost: split.cost,
            })),
            feedType: feedTypeName,
            feedInventoryId: feedType !== FRESH_CUT_OPTION ? selectedFeedInventory?.id : undefined,
            totalKg: parseFloat(totalKg),
            recordDate: dateTime,
          },
          createdAt: Date.now(),
        });

        hapticNotification('success');
        toast({
          title: "Queued for Sync",
          description: `${totalKg}kg feeding will sync when online`,
        });
        onOpenChange(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Create feeding records for each animal
      const records = splitPreview.map((split) => ({
        animal_id: split.animalId,
        record_datetime: dateTime,
        kilograms: split.kilograms,
        feed_type: feedTypeName,
        created_by: user?.id,
      }));

      const { error: insertError } = await supabase.from("feeding_records").insert(records);
      if (insertError) throw insertError;

      // Deduct from inventory if not Fresh Cut and Carry
      if (feedType !== FRESH_CUT_OPTION && selectedFeedInventory) {
        const newQuantity = Math.max(0, selectedFeedInventory.quantity_kg - parseFloat(totalKg));
        
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
            quantity_change_kg: -parseFloat(totalKg),
            balance_after: newQuantity,
            notes: `Bulk feeding: ${splitPreview.length} animals`,
            created_by: user?.id,
          });

        if (txError) {
          console.error('Failed to create transaction:', txError);
        }

        // Create expense records for each animal if cost data is available
        if (costPerKg > 0 && user?.id) {
          const expenseRecords = splitPreview
            .filter(split => split.cost && split.cost > 0)
            .map((split) => ({
              animal_id: split.animalId,
              farm_id: farmId,
              user_id: user.id,
              category: 'Feed & Supplements',
              amount: split.cost!,
              description: `${feedTypeName} feeding: ${split.kilograms.toFixed(2)} kg`,
              expense_date: format(recordDate, 'yyyy-MM-dd'),
              allocation_type: 'Operational',
              linked_feed_inventory_id: selectedFeedInventory.id,
            }));

          if (expenseRecords.length > 0) {
            const { error: expenseError } = await supabase
              .from('farm_expenses')
              .insert(expenseRecords);

            if (expenseError) {
              console.error('Failed to create expense records:', expenseError);
            }
          }
        }
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["feeding-records"] });
      queryClient.invalidateQueries({ queryKey: ["feed-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["feed-inventory-types"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["animal-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["animal-expense-summary"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["animal-cost-aggregates"] });

      hapticNotification('success');
      toast({
        title: "Feed Recorded",
        description: `${totalKg}kg of ${feedTypeName} split across ${splitPreview.length} animal${splitPreview.length > 1 ? "s" : ""}`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error recording feed:", error);
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

  const canSubmit = selectedAnimals.length > 0 && parseFloat(totalKg) > 0 && feedType && !isOverStock;
  const isLoading = (isLoadingAnimals || isLoadingInventory) && isOnline;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wheat className="h-5 w-5 text-orange-500" />
            Record Bulk Feeding
            {!isOnline && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Record feed given and split proportionally by animal weight
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayAnimals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wheat className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No animals in your herd</p>
            <p className="text-sm mt-1">
              Add animals to start recording feed
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

            {/* Total Kilograms */}
            <div className="space-y-2">
              <Label htmlFor="total-kg">Total Kilograms</Label>
              <Input
                id="total-kg"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 50"
                value={totalKg}
                onChange={(e) => setTotalKg(e.target.value)}
                onFocus={() => hapticImpact('light')}
                className="min-h-[48px]"
              />
              {isOverStock && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Exceeds available stock ({selectedFeedInventory?.quantity_kg.toFixed(1)} kg)
                </p>
              )}
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
                  "Record Feed"
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

function SplitPreviewRow({ split }: { split: FeedSplitResult }) {
  return (
    <div className="flex items-center justify-between text-sm bg-background rounded px-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium truncate">{split.animalName}</span>
        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
          <Scale className="h-3 w-3" />
          {split.weight}kg
        </span>
      </div>
      <div className="flex flex-col items-end shrink-0 ml-2">
        <span className="font-semibold text-orange-600">
          {split.kilograms.toFixed(1)}kg
        </span>
        {split.cost !== undefined && split.cost > 0 && (
          <span className="text-xs text-muted-foreground">
            ₱{split.cost.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
