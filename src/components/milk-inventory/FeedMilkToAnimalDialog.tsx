import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, Info, Baby } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { supabase } from "@/integrations/supabase/client";
import { useLastMilkPriceBySpecies } from "@/hooks/useRevenues";
import { useFarmAnimals, type FarmAnimal } from "@/hooks/useFarmAnimals";
import { useQueryClient } from "@tanstack/react-query";
import { format, differenceInMonths, differenceInDays } from "date-fns";
import type { MilkInventoryItem } from "@/hooks/useMilkInventory";
import { deductMilkFromInventoryCache, addOptimisticRecords, getCachedMilkPrices, getCachedAnimals } from "@/lib/dataCache";
import { addToQueue } from "@/lib/offlineQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface FeedMilkToAnimalDialogProps {
  farmId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableItems: MilkInventoryItem[];
  totalAvailable: number;
  stockType: 'good' | 'rejected';
}

function formatAnimalAge(animal: FarmAnimal): string {
  if (!animal.birth_date) return "No data available";
  const months = differenceInMonths(new Date(), new Date(animal.birth_date));
  if (months < 1) {
    const days = differenceInDays(new Date(), new Date(animal.birth_date));
    return `${days} day${days !== 1 ? 's' : ''} old`;
  }
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} old`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m old` : `${years} year${years !== 1 ? 's' : ''} old`;
}

function getFeedingHint(animal: FarmAnimal | undefined): string {
  if (!animal) return "";
  const weight = animal.current_weight_kg;
  if (!weight) return "No weight data — typical calf intake is 4-6L/day";
  const low = (weight * 0.10).toFixed(1);
  const high = (weight * 0.20).toFixed(1);
  return `Recommended: ${low}-${high}L/day for a ${weight}kg animal (10-20% of body weight)`;
}

export function FeedMilkToAnimalDialog({
  farmId,
  open,
  onOpenChange,
  availableItems,
  totalAvailable,
  stockType,
}: FeedMilkToAnimalDialogProps) {
  const { toast } = useToast();
  const { data: pricesBySpecies } = useLastMilkPriceBySpecies(farmId);
  const { data: animals = [] } = useFarmAnimals(farmId);
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [litersToFeed, setLitersToFeed] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cachedAnimals, setCachedAnimals] = useState<FarmAnimal[]>([]);

  // Reset form when dialog opens; load cached animals if offline
  useEffect(() => {
    if (open) {
      setSelectedAnimalId("");
      setLitersToFeed("");
      // Load cached animals for offline fallback
      if (animals.length === 0) {
        getCachedAnimals(farmId).then((cached) => {
          if (cached?.data) {
            setCachedAnimals(cached.data.map((a: any) => ({
              id: a.id,
              name: a.name,
              ear_tag: a.ear_tag,
              livestock_type: a.livestock_type,
              breed: a.breed,
              gender: a.gender,
              birth_date: a.birth_date,
              current_weight_kg: a.current_weight_kg,
              life_stage: a.life_stage,
              is_active: a.is_active,
            } as FarmAnimal)));
          }
        }).catch(() => {});
      }
    }
  }, [open, farmId, animals.length]);

  // Resolve animals: online data or cached fallback
  const resolvedAnimals = animals.length > 0 ? animals : cachedAnimals;

  const selectedAnimal = useMemo(
    () => resolvedAnimals.find(a => a.id === selectedAnimalId),
    [resolvedAnimals, selectedAnimalId]
  );

  // Determine the livestock_type of the available stock for pricing
  const stockSpecies = useMemo(() => {
    if (availableItems.length === 0) return 'cattle';
    return availableItems[0].livestock_type || 'cattle';
  }, [availableItems]);

  const pricePerLiter = useMemo(() => {
    if (stockType === 'rejected') return 0;
    // Online data first, then cached prices for offline
    if (pricesBySpecies?.[stockSpecies]) return pricesBySpecies[stockSpecies];
    const cached = getCachedMilkPrices(farmId);
    return cached?.[stockSpecies] || 0;
  }, [stockType, pricesBySpecies, stockSpecies, farmId]);

  // FIFO preview
  const fifoPreview = useMemo(() => {
    const liters = parseFloat(litersToFeed) || 0;
    if (liters <= 0) return { records: [], totalLiters: 0, warning: null };

    const selectedRecords: { record: MilkInventoryItem; litersUsed: number }[] = [];
    let remaining = liters;

    const sorted = [...availableItems].sort((a, b) =>
      new Date(a.record_date).getTime() - new Date(b.record_date).getTime()
    );

    for (const record of sorted) {
      if (remaining <= 0) break;
      const litersFromThis = Math.min(remaining, record.liters_remaining);
      selectedRecords.push({ record, litersUsed: litersFromThis });
      remaining -= litersFromThis;
    }

    const totalSelected = selectedRecords.reduce((sum, r) => sum + r.litersUsed, 0);
    const warning = remaining > 0 ? `Only ${totalSelected.toFixed(1)}L available` : null;

    return { records: selectedRecords, totalLiters: totalSelected, warning };
  }, [litersToFeed, availableItems]);

  const totalCost = fifoPreview.totalLiters * pricePerLiter;

  const handleSubmit = async () => {
    if (!selectedAnimalId) {
      toast({ title: "Error", description: "Please select an animal", variant: "destructive" });
      return;
    }
    if (fifoPreview.records.length === 0) {
      toast({ title: "Error", description: "Enter a valid amount of milk", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const feedType = stockType === 'good' ? 'Whole Milk' : 'Waste Milk';
    const recordDatetime = new Date().toISOString();
    const animalLabel = selectedAnimal?.name || selectedAnimal?.ear_tag || 'animal';
    const notes = `${fifoPreview.totalLiters.toFixed(1)}L ${stockType} milk from ${fifoPreview.records.length} batch(es)`;

    // Build deductions array (shared by online/offline paths)
    const deductions = fifoPreview.records.map(({ record, litersUsed }) => {
      const newRemaining = record.liters_remaining - litersUsed;
      return {
        id: record.id,
        litersUsed,
        newRemaining: Math.max(0, newRemaining),
        isFullyConsumed: newRemaining < 0.05,
      };
    });

    try {
      // STEP 1: Deduct from cache for instant UI (both online & offline)
      await deductMilkFromInventoryCache(farmId, deductions.map(d => ({ id: d.id, litersUsed: d.litersUsed })));

      if (!isOnline) {
        // ---- OFFLINE PATH ----
        const optimisticId = crypto.randomUUID();

        // Persist optimistic feeding record to IndexedDB
        await addOptimisticRecords(farmId, 'feeding', [{
          animalId: selectedAnimalId,
          kilograms: fifoPreview.totalLiters,
          feed_type: feedType,
          record_datetime: recordDatetime,
          cost_per_kg_at_time: pricePerLiter,
          milk_inventory_id: fifoPreview.records[0].record.id,
          notes,
        }], optimisticId);

        // Queue for server sync
        await addToQueue({
          id: `milk_feeding_${Date.now()}`,
          type: 'milk_feeding',
          payload: {
            farmId,
            milkFeeding: {
              animalId: selectedAnimalId,
              animalName: animalLabel,
              totalLiters: fifoPreview.totalLiters,
              feedType,
              pricePerLiter,
              stockType,
              deductions,
              milkInventoryId: fifoPreview.records[0].record.id,
              recordDatetime,
              notes,
            },
          },
          createdAt: Date.now(),
          optimisticId,
        });

        toast({
          title: "Feeding Recorded",
          description: `Fed ${fifoPreview.totalLiters.toFixed(1)}L ${stockType} milk to ${animalLabel}. Syncs when online`,
        });
        onOpenChange(false);
        return;
      }

      // ---- ONLINE PATH ----
      // STEP 2: Update milk_inventory rows (FIFO deduction)
      for (const d of deductions) {
        const { error: invError } = await supabase
          .from("milk_inventory")
          .update({
            liters_remaining: d.newRemaining,
            is_available: !d.isFullyConsumed,
          })
          .eq("id", d.id);

        if (invError) throw invError;
      }

      // STEP 3: Insert feeding_record
      const { error: feedError } = await supabase
        .from("feeding_records")
        .insert({
          animal_id: selectedAnimalId,
          feed_type: feedType,
          kilograms: fifoPreview.totalLiters,
          cost_per_kg_at_time: pricePerLiter,
          milk_inventory_id: fifoPreview.records[0].record.id,
          record_datetime: recordDatetime,
          notes,
        });

      if (feedError) throw feedError;

      // STEP 4: Refetch
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['milk-inventory', farmId], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['milk-inventory-rejected', farmId], type: 'active' }),
      ]);

      toast({
        title: "Feeding Recorded",
        description: `Fed ${fifoPreview.totalLiters.toFixed(1)}L ${stockType} milk to ${animalLabel}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error recording milk feeding:", error);
      showErrorToastLegacy(toast, error, "recording milk feeding");
      await queryClient.refetchQueries({ queryKey: ['milk-inventory', farmId], type: 'active' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogTitle = stockType === 'good' ? 'Feed Milk to Animal' : 'Feed Rejected Milk to Animal';
  const dialogDesc = stockType === 'good'
    ? 'Deduct good milk from inventory (FIFO) and record as feed'
    : 'Use rejected milk for animal feeding (FIFO, no cost)';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Baby className="h-5 w-5" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDesc}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
          {/* Available Stock Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Available: <strong>{totalAvailable.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L</strong>
              {stockType === 'rejected' && <span className="text-amber-600 ml-1">(rejected)</span>}
            </AlertDescription>
          </Alert>

          {/* Animal Selector */}
          <div className="space-y-2">
            <Label>Feed to Animal</Label>
            <Select value={selectedAnimalId} onValueChange={setSelectedAnimalId}>
              <SelectTrigger className="min-h-[48px]">
                <SelectValue placeholder="Select animal..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {resolvedAnimals.map((animal) => (
                  <SelectItem key={animal.id} value={animal.id}>
                    {animal.name || animal.ear_tag || 'Unknown'} — {formatAnimalAge(animal)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAnimal && (
              <p className="text-xs text-muted-foreground italic">
                💡 {getFeedingHint(selectedAnimal)}
              </p>
            )}
          </div>

          {/* Liters to Feed */}
          <div className="space-y-2">
            <Label htmlFor="feed-liters">Liters to Feed</Label>
            <Input
              id="feed-liters"
              type="number"
              step="0.1"
              min="0"
              max={totalAvailable}
              value={litersToFeed}
              onChange={(e) => setLitersToFeed(e.target.value)}
              placeholder={`Up to ${totalAvailable.toFixed(1)}`}
              className="min-h-[48px]"
            />
          </div>

          {/* FIFO Preview */}
          {fifoPreview.records.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium">Deduction Preview (FIFO):</p>
              <div className="space-y-1 text-sm">
                {fifoPreview.records.slice(0, 5).map(({ record, litersUsed }) => (
                  <div key={record.id} className="flex justify-between text-muted-foreground">
                    <span>
                      {format(new Date(record.record_date), "MMM d")}: {record.animal_name || record.ear_tag}
                    </span>
                    <span>
                      {litersUsed.toFixed(1)} L
                      {litersUsed < record.liters_remaining && (
                        <span className="text-xs ml-1 text-amber-600">(partial)</span>
                      )}
                    </span>
                  </div>
                ))}
                {fifoPreview.records.length > 5 && (
                  <p className="text-muted-foreground">... and {fifoPreview.records.length - 5} more</p>
                )}
              </div>

              {fifoPreview.warning && (
                <p className="text-amber-600 text-sm">⚠️ {fifoPreview.warning}</p>
              )}

              {/* Cost display */}
              <div className="flex items-center gap-2 pt-2 border-t text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {stockType === 'rejected' ? (
                  <span className="text-muted-foreground">Cost: Free (rejected milk)</span>
                ) : pricePerLiter > 0 ? (
                  <span className="text-primary">
                    Opportunity cost: ₱{pricePerLiter}/L × {fifoPreview.totalLiters.toFixed(1)}L = ₱{totalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No price data — cost will be ₱0</span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0 px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedAnimalId || fifoPreview.records.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              `Feed ${fifoPreview.totalLiters.toFixed(1)} L`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
