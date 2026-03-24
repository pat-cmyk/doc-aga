import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { FeedInventoryItem } from "@/lib/feedInventory";

const adjustSchema = z.object({
  actual_count: z.coerce.number().nonnegative("Count must be 0 or positive"),
  reason: z.string().min(1, "Please provide a reason for the adjustment"),
});

type AdjustFormData = z.infer<typeof adjustSchema>;

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FeedInventoryItem;
}

export function AdjustStockDialog({ open, onOpenChange, item }: AdjustStockDialogProps) {
  const { toast } = useToast();

  const needsConversion = ['bags', 'bales', 'barrels'].includes(item.unit);
  const wpu = item.weight_per_unit ? Number(item.weight_per_unit) : 0;

  // Current stock in display units
  const currentDisplayQty = (needsConversion && wpu > 0)
    ? Math.round((item.quantity_kg / wpu) * 100) / 100
    : item.quantity_kg;

  const unitLabel = needsConversion
    ? item.unit
    : 'kg';

  const form = useForm<AdjustFormData>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      actual_count: currentDisplayQty,
      reason: "",
    },
  });

  const watchedCount = form.watch("actual_count");

  // Preview the difference in kg
  const diffPreview = useMemo(() => {
    if (watchedCount === undefined || watchedCount === null || isNaN(watchedCount)) return null;
    const actualKg = (needsConversion && wpu > 0)
      ? watchedCount * wpu
      : watchedCount;
    const diff = actualKg - item.quantity_kg;
    if (Math.abs(diff) < 0.01) return null;
    return {
      diff,
      label: diff > 0
        ? `+${diff.toLocaleString()} kg`
        : `${diff.toLocaleString()} kg`,
      isPositive: diff > 0,
    };
  }, [watchedCount, item.quantity_kg, needsConversion, wpu]);

  const onSubmit = async (data: AdjustFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Convert to kg if needed
      const actualKg = (needsConversion && wpu > 0)
        ? data.actual_count * wpu
        : data.actual_count;

      const diffKg = actualKg - item.quantity_kg;

      if (Math.abs(diffKg) < 0.01) {
        toast({ title: "No Change", description: "The count matches the current stock" });
        onOpenChange(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('feed_inventory')
        .update({
          quantity_kg: actualKg,
          last_updated: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      const { error: txError } = await supabase
        .from('feed_stock_transactions')
        .insert({
          feed_inventory_id: item.id,
          transaction_type: 'adjustment',
          quantity_change_kg: diffKg,
          balance_after: actualKg,
          notes: `Stock adjustment: ${data.reason}`,
          created_by: user.id,
        });

      if (txError) throw txError;

      toast({
        title: "Stock Adjusted",
        description: `${item.feed_type} updated to ${actualKg.toLocaleString()} kg`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast({
        title: "Error",
        description: "Failed to adjust stock",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {item.feed_type} — Enter the actual count from physical inventory
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">
          Current stock: <span className="font-semibold text-foreground">
            {currentDisplayQty.toLocaleString()} {unitLabel}
            {needsConversion && wpu > 0 && ` (${item.quantity_kg.toLocaleString()} kg)`}
          </span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="actual_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Actual Count ({unitLabel})</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0" {...field} />
                  </FormControl>
                  {diffPreview && (
                    <p className={`text-sm font-medium ${diffPreview.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      Change: {diffPreview.label}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Physical count reconciliation, spoilage, transfer..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Adjust Stock
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
