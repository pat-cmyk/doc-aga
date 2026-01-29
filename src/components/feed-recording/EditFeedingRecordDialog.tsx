import { useState, useEffect, useMemo } from "react";
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
import { Loader2, Pencil, CalendarIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticSelection, hapticNotification } from "@/lib/haptics";
import { useFarm } from "@/contexts/FarmContext";
import { validateRecordDate } from "@/lib/recordValidation";
import { calculateCostPerKg } from "@/lib/feedSplitCalculation";

export interface FeedingRecordWithDetails {
  id: string;
  animal_id: string;
  feed_type: string | null;
  kilograms: number | null;
  notes: string | null;
  record_datetime: string;
  feed_inventory_id: string | null;
  cost_per_kg_at_time: number | null;
}

interface EditFeedingRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: FeedingRecordWithDetails;
  farmId: string;
  animalName: string;
  animalFarmEntryDate?: string | null;
  onSuccess?: () => void;
}

const FRESH_CUT_OPTION = "Fresh Cut and Carry";

export function EditFeedingRecordDialog({
  open,
  onOpenChange,
  record,
  farmId,
  animalName,
  animalFarmEntryDate,
  onSuccess,
}: EditFeedingRecordDialogProps) {
  const [recordDate, setRecordDate] = useState<Date>(new Date());
  const [feedType, setFeedType] = useState("");
  const [kilograms, setKilograms] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { maxBackdateDays } = useFarm();

  // Store original values for inventory reversal calculations
  const [originalValues, setOriginalValues] = useState({
    feedInventoryId: record.feed_inventory_id,
    kilograms: record.kilograms || 0,
    costPerKg: record.cost_per_kg_at_time || 0,
  });

  // Fetch feed inventory
  const { data: feedInventory = [], isLoading: isLoadingInventory } = useQuery({
    queryKey: ['feed-inventory-types', farmId],
    queryFn: async () => {
      if (!farmId) return [];
      const { data, error } = await supabase
        .from('feed_inventory')
        .select('id, feed_type, quantity_kg, cost_per_unit, unit, weight_per_unit, category')
        .eq('farm_id', farmId)
        .order('feed_type');
      if (error) throw error;
      return data || [];
    },
    enabled: !!farmId && open,
  });

  // Reset form when record changes or dialog opens
  useEffect(() => {
    if (open && record) {
      setRecordDate(new Date(record.record_datetime));
      setKilograms(record.kilograms?.toString() || "");
      setNotes(record.notes || "");
      
      // Set feed type - either inventory ID or Fresh Cut
      if (record.feed_inventory_id) {
        setFeedType(record.feed_inventory_id);
      } else {
        setFeedType(FRESH_CUT_OPTION);
      }
      
      // Store original values
      setOriginalValues({
        feedInventoryId: record.feed_inventory_id,
        kilograms: record.kilograms || 0,
        costPerKg: record.cost_per_kg_at_time || 0,
      });
      
      hapticImpact('light');
    }
  }, [open, record]);

  // Get selected feed inventory item
  const selectedFeedInventory = useMemo(() => {
    if (!feedType || feedType === FRESH_CUT_OPTION) return null;
    return feedInventory.find(f => f.id === feedType);
  }, [feedType, feedInventory]);

  // Calculate cost per kg for new feed type
  const costPerKg = useMemo(() => {
    if (!selectedFeedInventory) return 0;
    return calculateCostPerKg(
      selectedFeedInventory.cost_per_unit,
      selectedFeedInventory.weight_per_unit,
      selectedFeedInventory.unit
    );
  }, [selectedFeedInventory]);

  // Calculate effective available stock (current stock + original deduction if same item)
  const effectiveAvailableStock = useMemo(() => {
    if (!selectedFeedInventory) return 0;
    let available = selectedFeedInventory.quantity_kg;
    
    // If editing the same feed type, add back the original deduction
    if (originalValues.feedInventoryId === selectedFeedInventory.id) {
      available += originalValues.kilograms;
    }
    
    return available;
  }, [selectedFeedInventory, originalValues]);

  // Check if over stock
  const isOverStock = useMemo(() => {
    if (!selectedFeedInventory) return false;
    const kg = parseFloat(kilograms);
    return !isNaN(kg) && kg > effectiveAvailableStock;
  }, [selectedFeedInventory, kilograms, effectiveAvailableStock]);

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

    const newKg = parseFloat(kilograms);
    if (isNaN(newKg) || newKg <= 0) {
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

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const dateTime = format(recordDate, "yyyy-MM-dd'T'HH:mm:ss");
      const isFreshCut = feedType === FRESH_CUT_OPTION;
      const newFeedInventoryId = isFreshCut ? null : feedType;
      const feedTypeName = isFreshCut
        ? FRESH_CUT_OPTION
        : selectedFeedInventory?.feed_type || feedType;

      // Determine scenario
      const originalWasFreshCut = !originalValues.feedInventoryId;
      const sameFeedType = originalValues.feedInventoryId === newFeedInventoryId;

      // ==========================================
      // Step 1: Handle inventory adjustments
      // ==========================================

      // Scenario A: Same feed type (inventory item), quantity changed
      if (sameFeedType && !originalWasFreshCut && !isFreshCut) {
        const delta = newKg - originalValues.kilograms;
        if (delta !== 0 && selectedFeedInventory) {
          const newQuantity = Math.max(0, selectedFeedInventory.quantity_kg - delta);
          
          await supabase
            .from('feed_inventory')
            .update({
              quantity_kg: newQuantity,
              last_updated: new Date().toISOString()
            })
            .eq('id', selectedFeedInventory.id);

          // Create adjustment transaction
          await supabase
            .from('feed_stock_transactions')
            .insert({
              feed_inventory_id: selectedFeedInventory.id,
              transaction_type: 'adjustment',
              quantity_change_kg: -delta,
              balance_after: newQuantity,
              notes: `Edit feeding record for ${animalName}: ${delta > 0 ? '+' : ''}${delta.toFixed(2)}kg`,
              created_by: user?.id,
            });
        }
      }

      // Scenario B: Different feed type (both inventory items)
      if (!sameFeedType && !originalWasFreshCut && !isFreshCut) {
        // Restore original inventory
        const originalInventory = feedInventory.find(f => f.id === originalValues.feedInventoryId);
        if (originalInventory) {
          const restoredQuantity = originalInventory.quantity_kg + originalValues.kilograms;
          
          await supabase
            .from('feed_inventory')
            .update({
              quantity_kg: restoredQuantity,
              last_updated: new Date().toISOString()
            })
            .eq('id', originalValues.feedInventoryId);

          await supabase
            .from('feed_stock_transactions')
            .insert({
              feed_inventory_id: originalValues.feedInventoryId!,
              transaction_type: 'adjustment',
              quantity_change_kg: originalValues.kilograms,
              balance_after: restoredQuantity,
              notes: `Reversed feeding record edit for ${animalName}`,
              created_by: user?.id,
            });
        }

        // Deduct from new inventory
        if (selectedFeedInventory) {
          const newQuantity = Math.max(0, selectedFeedInventory.quantity_kg - newKg);
          
          await supabase
            .from('feed_inventory')
            .update({
              quantity_kg: newQuantity,
              last_updated: new Date().toISOString()
            })
            .eq('id', selectedFeedInventory.id);

          await supabase
            .from('feed_stock_transactions')
            .insert({
              feed_inventory_id: selectedFeedInventory.id,
              transaction_type: 'consumption',
              quantity_change_kg: -newKg,
              balance_after: newQuantity,
              notes: `Edit feeding: ${animalName}`,
              created_by: user?.id,
            });
        }
      }

      // Scenario C1: Changed FROM Fresh Cut TO inventory item
      if (originalWasFreshCut && !isFreshCut && selectedFeedInventory) {
        const newQuantity = Math.max(0, selectedFeedInventory.quantity_kg - newKg);
        
        await supabase
          .from('feed_inventory')
          .update({
            quantity_kg: newQuantity,
            last_updated: new Date().toISOString()
          })
          .eq('id', selectedFeedInventory.id);

        await supabase
          .from('feed_stock_transactions')
          .insert({
            feed_inventory_id: selectedFeedInventory.id,
            transaction_type: 'consumption',
            quantity_change_kg: -newKg,
            balance_after: newQuantity,
            notes: `Edit feeding (from Fresh Cut): ${animalName}`,
            created_by: user?.id,
          });
      }

      // Scenario C2: Changed TO Fresh Cut FROM inventory item
      if (!originalWasFreshCut && isFreshCut) {
        const originalInventory = feedInventory.find(f => f.id === originalValues.feedInventoryId);
        if (originalInventory) {
          const restoredQuantity = originalInventory.quantity_kg + originalValues.kilograms;
          
          await supabase
            .from('feed_inventory')
            .update({
              quantity_kg: restoredQuantity,
              last_updated: new Date().toISOString()
            })
            .eq('id', originalValues.feedInventoryId);

          await supabase
            .from('feed_stock_transactions')
            .insert({
              feed_inventory_id: originalValues.feedInventoryId!,
              transaction_type: 'adjustment',
              quantity_change_kg: originalValues.kilograms,
              balance_after: restoredQuantity,
              notes: `Reversed to Fresh Cut for ${animalName}`,
              created_by: user?.id,
            });
        }
      }

      // ==========================================
      // Step 2: Update feeding_records
      // ==========================================
      const newCostPerKg = isFreshCut ? null : (sameFeedType ? originalValues.costPerKg : costPerKg);
      
      const { error: updateError } = await supabase
        .from("feeding_records")
        .update({
          record_datetime: dateTime,
          kilograms: newKg,
          feed_type: feedTypeName,
          feed_inventory_id: newFeedInventoryId,
          cost_per_kg_at_time: newCostPerKg,
          notes: notes.trim() || null,
        })
        .eq("id", record.id);

      if (updateError) throw updateError;

      // ==========================================
      // Step 3: Handle expense records
      // ==========================================
      const newCost = !isFreshCut && newCostPerKg ? Math.round(newKg * newCostPerKg * 100) / 100 : 0;

      // Find existing expense record
      const { data: existingExpenses } = await supabase
        .from('farm_expenses')
        .select('id')
        .eq('animal_id', record.animal_id)
        .eq('linked_feed_inventory_id', originalValues.feedInventoryId)
        .ilike('description', `%${originalValues.kilograms.toFixed(2)} kg%`)
        .limit(1);

      const existingExpenseId = existingExpenses?.[0]?.id;

      if (isFreshCut && existingExpenseId) {
        // Delete expense if changed to Fresh Cut
        await supabase
          .from('farm_expenses')
          .delete()
          .eq('id', existingExpenseId);
      } else if (!isFreshCut && newCost > 0 && user?.id) {
        if (existingExpenseId) {
          // Update existing expense
          await supabase
            .from('farm_expenses')
            .update({
              amount: newCost,
              description: `${feedTypeName} feeding: ${newKg.toFixed(2)} kg`,
              expense_date: format(recordDate, 'yyyy-MM-dd'),
              linked_feed_inventory_id: newFeedInventoryId,
            })
            .eq('id', existingExpenseId);
        } else {
          // Create new expense
          await supabase
            .from('farm_expenses')
            .insert({
              animal_id: record.animal_id,
              farm_id: farmId,
              user_id: user.id,
              category: 'Feed & Supplements',
              amount: newCost,
              description: `${feedTypeName} feeding: ${newKg.toFixed(2)} kg`,
              expense_date: format(recordDate, 'yyyy-MM-dd'),
              allocation_type: 'Operational',
              linked_feed_inventory_id: newFeedInventoryId,
            });
        }
      }

      // ==========================================
      // Step 4: Invalidate queries
      // ==========================================
      queryClient.invalidateQueries({ queryKey: ["feeding-records"] });
      queryClient.invalidateQueries({ queryKey: ["feed-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["feed-inventory-types"] });
      queryClient.invalidateQueries({ queryKey: ["animal-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });

      hapticNotification('success');
      toast({
        title: "Record Updated",
        description: `Updated to ${newKg}kg of ${feedTypeName}`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating feeding record:", error);
      hapticNotification('error');
      toast({
        title: "Error",
        description: "Failed to update feeding record",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = feedType && parseFloat(kilograms) > 0 && !isOverStock;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Feeding Record
          </DialogTitle>
          <DialogDescription>
            Update feeding record for {animalName}
          </DialogDescription>
        </DialogHeader>

        {isLoadingInventory ? (
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
                      date > new Date() || date < subDays(new Date(), maxBackdateDays)
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
                  {feedInventory.map((feed) => (
                    <SelectItem key={feed.id} value={feed.id}>
                      <div className="flex flex-col">
                        <span>{feed.feed_type}</span>
                        <span className="text-xs text-muted-foreground">
                          Available: {feed.quantity_kg.toFixed(1)} kg
                          {originalValues.feedInventoryId === feed.id && (
                            <> (+{originalValues.kilograms.toFixed(1)} kg reserved)</>
                          )}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedFeedInventory && (
                <p className="text-xs text-muted-foreground">
                  Effective available: {effectiveAvailableStock.toFixed(1)} kg
                </p>
              )}
            </div>

            {/* Kilograms Input */}
            <div className="space-y-2">
              <Label htmlFor="edit-kilograms">Kilograms</Label>
              <Input
                id="edit-kilograms"
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
                    Amount exceeds available stock ({effectiveAvailableStock.toFixed(1)} kg).
                    Reduce quantity or add more stock first.
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes (Optional)</Label>
              <Textarea
                id="edit-notes"
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
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
