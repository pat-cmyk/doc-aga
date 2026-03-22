import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, CalendarIcon, PackagePlus } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import type { FeedInventoryItem } from "@/lib/feedInventory";
import { FeedTypeCombobox } from "./FeedTypeCombobox";
import { normalizeFeedType } from "@/lib/feedTypeNormalization";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const FEED_CATEGORIES = [
  { value: 'concentrates', label: 'Concentrates (grains, pellets, dairy meal)' },
  { value: 'roughage', label: 'Roughage (hay, silage, grass)' },
  { value: 'minerals', label: 'Minerals & Vitamins' },
  { value: 'supplements', label: 'Supplements & Additives' },
] as const;

const formSchema = z.object({
  feed_type: z.string().min(1, "Feed type is required"),
  category: z.enum(['concentrates', 'roughage', 'minerals', 'supplements']),
  quantity_kg: z.coerce.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required"),
  weight_per_unit: z.coerce.number().positive("Weight per unit must be positive").optional(),
  cost_per_unit: z.coerce.number().nonnegative().optional(),
  purchase_date: z.date().optional(),
  expiry_date: z.date().optional(),
  batch_number: z.string().optional(),
  reorder_threshold: z.coerce.number().nonnegative().optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddFeedStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  editItem?: FeedInventoryItem | null;
  prefillFeedType?: string;
  existingInventory?: FeedInventoryItem[];
  /** @deprecated Use existingInventory instead */
  existingFeedTypes?: string[];
}

export function AddFeedStockDialog({
  open,
  onOpenChange,
  farmId,
  editItem,
  prefillFeedType,
  existingInventory = [],
  existingFeedTypes: existingFeedTypesProp,
}: AddFeedStockDialogProps) {
  // Derive feed type list from inventory (or use legacy prop)
  const existingFeedTypes = existingFeedTypesProp ?? existingInventory.map(item => item.feed_type);
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      feed_type: "",
      category: "roughage",
      quantity_kg: 0,
      unit: "kg",
      weight_per_unit: undefined,
      cost_per_unit: undefined,
      purchase_date: new Date(),
      expiry_date: undefined,
      batch_number: "",
      reorder_threshold: undefined,
      supplier: "",
      notes: "",
    },
  });

  const selectedUnit = form.watch("unit");
  const watchedQuantity = form.watch("quantity_kg");
  const watchedCostPerUnit = form.watch("cost_per_unit");
  const watchedWeightPerUnit = form.watch("weight_per_unit");
  const watchedFeedType = form.watch("feed_type");
  const watchedCategory = form.watch("category");

  // Detect if this feed type+category already exists in inventory (merge candidate)
  const mergeTarget = useMemo(() => {
    if (editItem || !watchedFeedType) return null;
    const normalized = normalizeFeedType(watchedFeedType);
    return existingInventory.find(item =>
      normalizeFeedType(item.feed_type) === normalized &&
      (item.category || 'roughage') === watchedCategory
    ) ?? null;
  }, [editItem, watchedFeedType, watchedCategory, existingInventory]);

  // Calculate total cost for expense preview
  const calculatedTotalCost = useMemo(() => {
    if (!watchedCostPerUnit || watchedCostPerUnit <= 0 || !watchedQuantity || watchedQuantity <= 0) {
      return null;
    }
    
    const needsConversion = selectedUnit === 'bags' || selectedUnit === 'bales' || selectedUnit === 'barrels';
    let actualQuantityKg = watchedQuantity;
    
    if (needsConversion && watchedWeightPerUnit) {
      actualQuantityKg = watchedQuantity * watchedWeightPerUnit;
    }
    
    return actualQuantityKg * watchedCostPerUnit;
  }, [watchedQuantity, watchedCostPerUnit, watchedWeightPerUnit, selectedUnit]);

  useEffect(() => {
    if (editItem) {
      // Convert quantity_kg back to original units for display
      const needsConversion = editItem.unit === 'bags' || editItem.unit === 'bales' || editItem.unit === 'barrels';
      const wpu = editItem.weight_per_unit ? Number(editItem.weight_per_unit) : 0;
      const displayQuantity = (needsConversion && wpu > 0)
        ? Math.round((Number(editItem.quantity_kg) / wpu) * 100) / 100
        : Number(editItem.quantity_kg);

      form.reset({
        feed_type: editItem.feed_type,
        category: (editItem as any).category || "roughage",
        quantity_kg: displayQuantity,
        unit: editItem.unit,
        weight_per_unit: wpu > 0 ? wpu : undefined,
        cost_per_unit: editItem.cost_per_unit ? Number(editItem.cost_per_unit) : undefined,
        purchase_date: (editItem as any).purchase_date ? new Date((editItem as any).purchase_date) : undefined,
        expiry_date: (editItem as any).expiry_date ? new Date((editItem as any).expiry_date) : undefined,
        batch_number: (editItem as any).batch_number || "",
        reorder_threshold: editItem.reorder_threshold ? Number(editItem.reorder_threshold) : undefined,
        supplier: editItem.supplier || "",
        notes: editItem.notes || "",
      });
    } else if (prefillFeedType) {
      form.reset({
        feed_type: prefillFeedType,
        category: "roughage",
        quantity_kg: 0,
        unit: "kg",
        weight_per_unit: undefined,
        cost_per_unit: undefined,
        purchase_date: new Date(),
        expiry_date: undefined,
        batch_number: "",
        reorder_threshold: undefined,
        supplier: "",
        notes: "",
      });
    } else {
      form.reset({
        feed_type: "",
        category: "roughage",
        quantity_kg: 0,
        unit: "kg",
        weight_per_unit: undefined,
        cost_per_unit: undefined,
        purchase_date: new Date(),
        expiry_date: undefined,
        batch_number: "",
        reorder_threshold: undefined,
        supplier: "",
        notes: "",
      });
    }
  }, [editItem, prefillFeedType, form]);

  const onSubmit = async (data: FormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Normalize feed type
      const normalizedFeedType = normalizeFeedType(data.feed_type);

      // Calculate actual quantity in kg
      const needsConversion = data.unit === 'bags' || data.unit === 'bales' || data.unit === 'barrels';
      let actualQuantityKg = data.quantity_kg;
      
      if (needsConversion && data.weight_per_unit) {
        actualQuantityKg = data.quantity_kg * data.weight_per_unit;
      }

      if (editItem) {
        // Update existing item
        const quantityChange = Number(actualQuantityKg) - Number(editItem.quantity_kg);

        const { error: updateError } = await supabase
          .from('feed_inventory')
          .update({
            feed_type: normalizedFeedType,
            category: data.category,
            quantity_kg: actualQuantityKg,
            unit: data.unit,
            weight_per_unit: data.weight_per_unit,
            cost_per_unit: data.cost_per_unit,
            purchase_date: data.purchase_date ? format(data.purchase_date, 'yyyy-MM-dd') : null,
            expiry_date: data.expiry_date ? format(data.expiry_date, 'yyyy-MM-dd') : null,
            batch_number: data.batch_number || null,
            reorder_threshold: data.reorder_threshold,
            supplier: data.supplier,
            notes: data.notes,
            last_updated: new Date().toISOString(),
          })
          .eq('id', editItem.id);

        if (updateError) throw updateError;

        // Create transaction record if quantity changed
        if (quantityChange !== 0) {
          const { error: transactionError } = await supabase
            .from('feed_stock_transactions')
            .insert({
              feed_inventory_id: editItem.id,
              transaction_type: 'adjustment',
              quantity_change_kg: quantityChange,
              balance_after: actualQuantityKg,
              notes: `Stock adjusted from ${editItem.quantity_kg} to ${actualQuantityKg} kg`,
              created_by: user.id,
            });

          if (transactionError) throw transactionError;
        }

        toast({
          title: "Success",
          description: "Feed stock updated successfully",
        });
      } else if (mergeTarget) {
        // Merge into existing inventory item (same feed_type + category)
        const oldQty = Number(mergeTarget.quantity_kg);
        const oldCost = Number(mergeTarget.cost_per_unit || 0);
        const newCost = Number(data.cost_per_unit || 0);
        const newTotalQty = oldQty + actualQuantityKg;

        // Weighted average cost per kg
        const weightedCost = newTotalQty > 0
          ? (oldQty * oldCost + actualQuantityKg * newCost) / newTotalQty
          : newCost;

        // Take latest expiry date
        const existingExpiry = mergeTarget.expiry_date ? new Date(mergeTarget.expiry_date) : null;
        const newExpiry = data.expiry_date || null;
        let latestExpiry: string | null = mergeTarget.expiry_date || null;
        if (newExpiry) {
          if (!existingExpiry || newExpiry > existingExpiry) {
            latestExpiry = format(newExpiry, 'yyyy-MM-dd');
          }
        }

        const { error: updateError } = await supabase
          .from('feed_inventory')
          .update({
            quantity_kg: newTotalQty,
            cost_per_unit: Math.round(weightedCost * 100) / 100,
            expiry_date: latestExpiry,
            supplier: data.supplier || mergeTarget.supplier,
            last_updated: new Date().toISOString(),
          })
          .eq('id', mergeTarget.id);

        if (updateError) throw updateError;

        // Record the repurchase as an addition transaction with purchase metadata
        const purchaseMetadata = [
          `Repurchase: +${actualQuantityKg.toLocaleString()} kg`,
          newCost > 0 ? `Cost: ₱${newCost}/kg` : null,
          data.supplier ? `Supplier: ${data.supplier}` : null,
          data.batch_number ? `Batch: ${data.batch_number}` : null,
          data.purchase_date ? `Date: ${format(data.purchase_date, 'yyyy-MM-dd')}` : null,
        ].filter(Boolean).join(' | ');

        const { error: txError } = await supabase
          .from('feed_stock_transactions')
          .insert({
            feed_inventory_id: mergeTarget.id,
            transaction_type: 'addition',
            quantity_change_kg: actualQuantityKg,
            balance_after: newTotalQty,
            notes: purchaseMetadata,
            created_by: user.id,
          });

        if (txError) throw txError;

        // Create purchase expense linked to existing inventory item
        const hasExpense = data.cost_per_unit && data.cost_per_unit > 0;
        if (hasExpense && calculatedTotalCost && calculatedTotalCost > 0) {
          const { error: expenseError } = await supabase
            .from('farm_expenses')
            .insert({
              farm_id: farmId,
              user_id: user.id,
              category: 'Feed & Supplements',
              amount: calculatedTotalCost,
              description: `Feed repurchase: ${normalizedFeedType}${data.batch_number ? ` (Batch: ${data.batch_number})` : ''}`,
              expense_date: data.purchase_date ? format(data.purchase_date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
              allocation_type: 'Capital',
              linked_feed_inventory_id: mergeTarget.id,
            });

          if (expenseError) {
            console.error('Failed to create purchase expense:', expenseError);
          }
        }

        toast({
          title: "Stock Updated",
          description: hasExpense
            ? "Feed merged into existing stock and expense recorded"
            : "Feed merged into existing stock",
        });
      } else {
        // Create new item
        const { data: newItem, error: insertError } = await supabase
          .from('feed_inventory')
          .insert([{
            feed_type: normalizedFeedType,
            category: data.category,
            quantity_kg: actualQuantityKg,
            unit: data.unit,
            weight_per_unit: data.weight_per_unit,
            cost_per_unit: data.cost_per_unit,
            purchase_date: data.purchase_date ? format(data.purchase_date, 'yyyy-MM-dd') : null,
            expiry_date: data.expiry_date ? format(data.expiry_date, 'yyyy-MM-dd') : null,
            batch_number: data.batch_number || null,
            reorder_threshold: data.reorder_threshold,
            supplier: data.supplier,
            notes: data.notes,
            farm_id: farmId,
            created_by: user.id,
          }])
          .select()
          .single();

        if (insertError) throw insertError;

        // Create initial transaction
        const { error: transactionError } = await supabase
          .from('feed_stock_transactions')
          .insert({
            feed_inventory_id: newItem.id,
            transaction_type: 'addition',
            quantity_change_kg: actualQuantityKg,
            balance_after: actualQuantityKg,
            notes: data.batch_number ? `Initial stock - Batch: ${data.batch_number}` : 'Initial stock',
            created_by: user.id,
          });

        if (transactionError) throw transactionError;

        // Create purchase expense record if cost is provided
        const hasExpense = data.cost_per_unit && data.cost_per_unit > 0;
        if (hasExpense && calculatedTotalCost && calculatedTotalCost > 0) {
          const { error: expenseError } = await supabase
            .from('farm_expenses')
            .insert({
              farm_id: farmId,
              user_id: user.id,
              category: 'Feed & Supplements',
              amount: calculatedTotalCost,
              description: `Feed purchase: ${normalizedFeedType}${data.batch_number ? ` (Batch: ${data.batch_number})` : ''}`,
              expense_date: data.purchase_date ? format(data.purchase_date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
              allocation_type: 'Capital',
              linked_feed_inventory_id: newItem.id,
            });

          if (expenseError) {
            console.error('Failed to create purchase expense:', expenseError);
          }
        }

        toast({
          title: "Success",
          description: hasExpense
            ? "Feed stock added and purchase expense recorded"
            : "Feed stock added successfully",
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving feed stock:', error);
      toast({
        title: "Error",
        description: "Failed to save feed stock",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Add'} Feed Stock</DialogTitle>
          <DialogDescription>
            {editItem ? 'Update' : 'Add'} feed details for your farm
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto space-y-4">
            <FormField
              control={form.control}
              name="feed_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Feed Type *</FormLabel>
                  <FormControl>
                    <FeedTypeCombobox
                      value={field.value}
                      onChange={field.onChange}
                      availableFeedTypes={existingFeedTypes}
                      placeholder="Select or type feed type..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FEED_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Merge preview — shown when feed_type+category matches an existing item */}
            {!editItem && mergeTarget && (
              <Alert className="bg-primary/5 border-primary/20">
                <PackagePlus className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  This feed already exists in your inventory ({mergeTarget.quantity_kg.toLocaleString()} kg).
                  The new quantity will be <span className="font-semibold">merged into existing stock</span>.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="quantity_kg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Quantity * 
                    {selectedUnit === 'bags' && ' (number of bags)'}
                    {selectedUnit === 'bales' && ' (number of bales)'}
                    {selectedUnit === 'barrels' && ' (number of barrels)'}
                    {selectedUnit === 'kg' && ' (kilograms)'}
                    {selectedUnit === 'tons' && ' (tons)'}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                        <SelectItem value="tons">Tons</SelectItem>
                        <SelectItem value="bags">Bags</SelectItem>
                        <SelectItem value="bales">Bales</SelectItem>
                        <SelectItem value="barrels">Barrel / Drum</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Conditional weight per unit field */}
            {(selectedUnit === "bags" || selectedUnit === "bales" || selectedUnit === "barrels") && (
              <FormField
                control={form.control}
                name="weight_per_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Average Weight per {selectedUnit === "bags" ? "Bag" : selectedUnit === "bales" ? "Bale" : "Barrel"} (kg) *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="e.g., 50" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the average weight in kilograms for conversion
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cost_per_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per kg (₱)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormDescription>Optional</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reorder_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Threshold</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription>Alert when below this</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Purchase & Expiry Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchase_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Purchase Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expiry Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Optional</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>For perishable feeds</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Batch & Supplier */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="batch_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch/Lot Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., LOT-2026-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <FormControl>
                      <Input placeholder="Supplier name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this feed stock"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Expense Preview Alert - only show for new items with cost */}
            {!editItem && calculatedTotalCost && calculatedTotalCost > 0 && (
              <Alert className="bg-primary/5 border-primary/20">
                <Wallet className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  <span className="font-medium">Expense will be recorded automatically:</span>
                  <br />
                  <span className="text-lg font-bold text-primary">
                    ₱{calculatedTotalCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    (Feed & Supplements • Operational)
                  </span>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editItem ? 'Update' : 'Add'} Stock
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
