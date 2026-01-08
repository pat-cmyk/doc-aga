import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLastMilkPrice, useAddRevenue } from "@/hooks/useRevenues";
import { format } from "date-fns";
import type { MilkInventoryItem } from "@/hooks/useMilkInventory";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { markMilkRecordsSold } from "@/lib/dataCache";

interface RecordMilkSaleDialogProps {
  farmId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableItems: MilkInventoryItem[];
  totalAvailable: number;
}

export function RecordMilkSaleDialog({
  farmId,
  open,
  onOpenChange,
  availableItems,
  totalAvailable,
}: RecordMilkSaleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: lastMilkPrice } = useLastMilkPrice(farmId);
  const addRevenue = useAddRevenue();
  const isOnline = useOnlineStatus();

  const [litersToSell, setLitersToSell] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default price when dialog opens
  useState(() => {
    if (lastMilkPrice) {
      setPricePerLiter(String(lastMilkPrice));
    }
  });

  // Calculate FIFO selection preview
  const fifoPreview = useMemo(() => {
    const liters = parseFloat(litersToSell) || 0;
    if (liters <= 0) return { records: [], totalLiters: 0, warning: null };

    const selectedRecords: { record: MilkInventoryItem; litersUsed: number }[] = [];
    let remaining = liters;
    let totalSelected = 0;

    // Sort by date ascending (oldest first - FIFO)
    const sorted = [...availableItems].sort((a, b) => 
      new Date(a.record_date).getTime() - new Date(b.record_date).getTime()
    );

    for (const record of sorted) {
      if (remaining <= 0) break;
      
      // Use full record (no partial sales supported by schema)
      selectedRecords.push({ record, litersUsed: record.liters });
      totalSelected += record.liters;
      remaining -= record.liters;
    }

    const warning = totalSelected > liters 
      ? `Will sell ${totalSelected.toFixed(1)}L (includes full records)`
      : totalSelected < liters 
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

    try {
      // STEP 1: Mark records as sold in local cache IMMEDIATELY for instant UI feedback
      const recordIds = fifoPreview.records.map(({ record }) => record.id);
      await markMilkRecordsSold(farmId, recordIds);
      
      // Force milk inventory to re-read from cache
      queryClient.invalidateQueries({ queryKey: ["milk-inventory", farmId] });

      // STEP 2: Update each selected milking record in database
      for (const { record } of fifoPreview.records) {
        const saleAmount = record.liters * price;
        
        const { error } = await supabase
          .from("milking_records")
          .update({
            is_sold: true,
            price_per_liter: price,
            sale_amount: saleAmount,
          })
          .eq("id", record.id);

        if (error) throw error;
      }

      // Create single revenue record for the bulk sale
      await addRevenue.mutateAsync({
        farm_id: farmId,
        amount: totalAmount,
        source: "Milk Sales",
        transaction_date: format(new Date(), "yyyy-MM-dd"),
        linked_milk_log_id: fifoPreview.records[0].record.id,
        notes: notes || `Bulk sale: ${fifoPreview.totalLiters.toFixed(1)}L from ${fifoPreview.records.length} records @ ₱${price}/L`,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["milk-inventory", farmId] });
      queryClient.invalidateQueries({ queryKey: ["milk-sales-history", farmId] });
      queryClient.invalidateQueries({ queryKey: ["revenues", farmId] });
      queryClient.invalidateQueries({ queryKey: ["revenue-summary", farmId] });

      toast({
        title: "Sale Recorded",
        description: `Sold ${fifoPreview.totalLiters.toFixed(1)}L for ₱${totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      });

      // Reset form and close
      setLitersToSell("");
      setPricePerLiter(String(lastMilkPrice || ""));
      setNotes("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error recording milk sale:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record sale",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Milk Sale</DialogTitle>
          <DialogDescription>
            Sell from inventory using FIFO (oldest milk first)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Available Stock Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Available: <strong>{totalAvailable.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L</strong> from {availableItems.length} records
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
          </div>

          {/* FIFO Preview */}
          {fifoPreview.records.length > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium">Sale Preview (FIFO):</p>
              <div className="space-y-1 text-sm">
                {fifoPreview.records.slice(0, 5).map(({ record }) => (
                  <div key={record.id} className="flex justify-between text-muted-foreground">
                    <span>
                      {format(new Date(record.record_date), "MMM d")}: {record.animal_name || record.ear_tag}
                    </span>
                    <span>{record.liters.toFixed(1)} L</span>
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

        <DialogFooter className="gap-2 sm:gap-0">
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
