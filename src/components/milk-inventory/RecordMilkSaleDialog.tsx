import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLastMilkPriceBySpecies, useAddRevenue } from "@/hooks/useRevenues";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { MilkInventoryItem } from "@/hooks/useMilkInventory";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { REVENUE_SOURCE_KEYS } from "@/lib/revenueCategories";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { deductMilkFromInventoryCache } from "@/lib/dataCache";
import { addToQueue } from "@/lib/offlineQueue";
import { getCacheManager, isCacheManagerReady } from "@/lib/cacheManager";
import { playSound } from "@/lib/audioFeedback";

const SPECIES_LABELS: Record<string, string> = {
  cattle: "Cattle",
  goat: "Goat",
  carabao: "Carabao",
  sheep: "Sheep",
};

interface RecordMilkSaleDialogProps {
  farmId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableItems: MilkInventoryItem[];
  totalAvailable: number;
  filterSpecies: string;
}

export function RecordMilkSaleDialog({
  farmId,
  open,
  onOpenChange,
  availableItems,
  totalAvailable,
  filterSpecies,
}: RecordMilkSaleDialogProps) {
  const { toast } = useToast();
  const { data: pricesBySpecies } = useLastMilkPriceBySpecies(farmId);
  const addRevenue = useAddRevenue();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const [litersToSell, setLitersToSell] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default price when dialog opens based on species
  useEffect(() => {
    if (open && pricesBySpecies) {
      const speciesPrice = pricesBySpecies[filterSpecies];
      if (speciesPrice) {
        setPricePerLiter(String(speciesPrice));
      }
    }
  }, [open, filterSpecies, pricesBySpecies]);

  // Calculate FIFO selection preview with partial sales support
  const fifoPreview = useMemo(() => {
    const liters = parseFloat(litersToSell) || 0;
    if (liters <= 0) return { records: [], totalLiters: 0, warning: null };

    const selectedRecords: { record: MilkInventoryItem; litersUsed: number }[] = [];
    let remaining = liters;

    // Sort by date ascending (oldest first - FIFO)
    const sorted = [...availableItems].sort((a, b) => 
      new Date(a.record_date).getTime() - new Date(b.record_date).getTime()
    );

    for (const record of sorted) {
      if (remaining <= 0) break;
      
      // Use only what's needed from this record (partial sale support)
      const litersFromThis = Math.min(remaining, record.liters_remaining);
      selectedRecords.push({ record, litersUsed: litersFromThis });
      remaining -= litersFromThis;
    }

    const totalSelected = selectedRecords.reduce((sum, r) => sum + r.litersUsed, 0);
    const warning = remaining > 0 
      ? `Only ${totalSelected.toFixed(1)}L available`
      : null;

    return { records: selectedRecords, totalLiters: totalSelected, warning };
  }, [litersToSell, availableItems]);

  const totalAmount = useMemo(() => {
    const liters = fifoPreview.totalLiters;
    const price = parseFloat(pricePerLiter) || 0;
    return liters * price;
  }, [fifoPreview.totalLiters, pricePerLiter]);

  const handleSubmit = async () => {
    if (fifoPreview.records.length === 0) {
      toast({ title: "Error", description: "No milk records to sell", variant: "destructive" });
      return;
    }

    const price = parseFloat(pricePerLiter);
    if (!price || price <= 0) {
      toast({ title: "Error", description: "Please enter a valid price", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const saleSpeciesLabel = SPECIES_LABELS[filterSpecies] || filterSpecies;
    const linkedMilkLogId = fifoPreview.records[0].record.milking_record_id;

    try {
      // STEP 1: Update local cache immediately for instant UI feedback
      const deductions = fifoPreview.records.map(({ record, litersUsed }) => ({
        id: record.id,
        litersUsed,
      }));
      await deductMilkFromInventoryCache(farmId, deductions);

      // OFFLINE BRANCH: queue for later sync
      if (!isOnline) {
        await addToQueue({
          id: crypto.randomUUID(),
          type: 'milk_sale',
          payload: {
            farmId,
            milkSale: {
              totalLiters: fifoPreview.totalLiters,
              pricePerLiter: price,
              totalAmount,
              species: saleSpeciesLabel,
              deductions: fifoPreview.records.map(({ record, litersUsed }) => ({
                id: record.id,
                litersUsed,
                milkingRecordId: record.milking_record_id,
                litersOriginal: record.liters_original,
              })),
              linkedMilkLogId,
              notes: notes || `${saleSpeciesLabel} milk: ${fifoPreview.totalLiters.toFixed(1)}L from ${fifoPreview.records.length} records @ ₱${price}/L`,
              saleDate: format(new Date(), "yyyy-MM-dd"),
            },
          },
          createdAt: Date.now(),
        });

        if (isCacheManagerReady()) {
          await getCacheManager().invalidateForMutation('milk-sale', farmId);
        }
        await queryClient.invalidateQueries({
          queryKey: ["last-milk-price-by-species", farmId],
        });
        playSound('success');

        toast({
          title: "Sale Queued (Offline)",
          description: `${fifoPreview.totalLiters.toFixed(1)}L for ₱${totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} — will sync when online`,
        });

        setLitersToSell("");
        setNotes("");
        onOpenChange(false);
        setIsSubmitting(false);
        return;
      }

      // ONLINE PATH: write directly to database

      // STEP 2: Update each inventory record in the database
      for (const { record, litersUsed } of fifoPreview.records) {
        const newRemaining = record.liters_remaining - litersUsed;
        const isFullyConsumed = newRemaining <= 0;

        // Update milk_inventory table directly
        const { error: invError } = await supabase
          .from("milk_inventory")
          .update({
            liters_remaining: Math.max(0, newRemaining),
            is_available: !isFullyConsumed,
          })
          .eq("id", record.id);

        if (invError) throw invError;

        // Always record price_per_liter (for price history), even on partial sales
        const updateFields: Record<string, any> = { price_per_liter: price };
        if (isFullyConsumed) {
          updateFields.is_sold = true;
          updateFields.sale_amount = record.liters_original * price;
        }
        await supabase
          .from("milking_records")
          .update(updateFields)
          .eq("id", record.milking_record_id);
      }

      // STEP 3: Create single revenue record (with duplicate prevention)
      // Check if a revenue entry already exists for this milk log (belt-and-suspenders with DB unique index)
      const { data: existingRevenue } = await supabase
        .from("farm_revenues")
        .select("id")
        .eq("linked_milk_log_id", linkedMilkLogId)
        .eq("is_deleted", false)
        .maybeSingle();

      if (!existingRevenue) {
        await addRevenue.mutateAsync({
          farm_id: farmId,
          amount: totalAmount,
          source: REVENUE_SOURCE_KEYS.MILK_SALE,
          transaction_date: format(new Date(), "yyyy-MM-dd"),
          linked_milk_log_id: linkedMilkLogId,
          notes: notes || `${saleSpeciesLabel} milk: ${fifoPreview.totalLiters.toFixed(1)}L from ${fifoPreview.records.length} records @ ₱${price}/L`,
        });
      }

      // STEP 4: Refetch to sync with server
      await queryClient.refetchQueries({
        queryKey: ['milk-inventory', farmId],
        type: 'active',
      });
      // Also invalidate price history so species cards update immediately
      await queryClient.invalidateQueries({
        queryKey: ["last-milk-price-by-species", farmId],
      });

      playSound('success');
      toast({
        title: "Sale Recorded",
        description: `Sold ${fifoPreview.totalLiters.toFixed(1)}L (${saleSpeciesLabel}) for ₱${totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      });

      // Reset form and close
      setLitersToSell("");
      setNotes("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error recording milk sale:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record sale",
        variant: "destructive",
      });
      // Refetch to restore correct state
      await queryClient.refetchQueries({
        queryKey: ['milk-inventory', farmId],
        type: 'active',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const speciesLabel = SPECIES_LABELS[filterSpecies] || filterSpecies;
  const dialogTitle = `Record ${speciesLabel} Milk Sale`;
  const dialogDescription = `Sell ${speciesLabel} milk using FIFO (oldest first)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
          {/* Available Stock Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Available: <strong>{totalAvailable.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L</strong> from {availableItems.length} records
              <span className="text-muted-foreground"> ({speciesLabel})</span>
            </AlertDescription>
          </Alert>

          {/* Liters to Sell */}
          <div className="space-y-2">
            <Label htmlFor="liters">Liters to Sell</Label>
            <Input
              id="liters"
              type="number"
              step="0.1"
              min="0"
              max={totalAvailable}
              value={litersToSell}
              onChange={(e) => setLitersToSell(e.target.value)}
              placeholder={`Up to ${totalAvailable.toFixed(1)}`}
              className="min-h-[48px]"
            />
          </div>

          {/* Price per Liter */}
          <div className="space-y-2">
            <Label htmlFor="price">Price per Liter (₱)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={pricePerLiter}
              onChange={(e) => setPricePerLiter(e.target.value)}
              placeholder="e.g. 65.00"
              className="min-h-[48px]"
            />
            {pricesBySpecies?.[filterSpecies] && (
              <p className="text-xs text-muted-foreground">
                Last {speciesLabel} price: ₱{pricesBySpecies[filterSpecies]}/L
              </p>
            )}
          </div>

          {/* FIFO Preview with partial sale indicators */}
          {fifoPreview.records.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium">Sale Preview (FIFO):</p>
              <div className="space-y-1 text-sm">
                {fifoPreview.records.slice(0, 5).map(({ record, litersUsed }) => (
                  <div key={record.id} className="flex justify-between text-muted-foreground">
                    <span>
                      {format(new Date(record.record_date), "MMM d")}: {record.animal_name || record.ear_tag}
                    </span>
                    <span>
                      {litersUsed.toFixed(1)} L
                      {litersUsed < record.liters_remaining && (
                        <span className="text-xs ml-1 text-amber-600 dark:text-amber-400">(partial)</span>
                      )}
                    </span>
                  </div>
                ))}
                {fifoPreview.records.length > 5 && (
                  <p className="text-muted-foreground">
                    ... and {fifoPreview.records.length - 5} more records
                  </p>
                )}
              </div>
              
              {fifoPreview.warning && (
                <p className="text-amber-600 dark:text-amber-400 text-sm">
                  ⚠️ {fifoPreview.warning}
                </p>
              )}

              {totalAmount > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t text-primary font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    Total: ₱{totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <div className="flex gap-2">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Buyer name, delivery details, etc."
                className="min-h-[80px] flex-1"
              />
              <VoiceInputButton
                onTranscription={(text) => setNotes(prev => prev ? `${prev} ${text}` : text)}
                disabled={!isOnline}
                className="self-start"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0 px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || fifoPreview.records.length === 0 || !pricePerLiter}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              `Sell ${fifoPreview.totalLiters.toFixed(1)} L`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
