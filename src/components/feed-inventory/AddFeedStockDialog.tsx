import { useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import type { FeedInventoryItem } from "@/lib/feedInventory";

const formSchema = z.object({
  feed_type: z.string().min(1, "Feed type is required"),
  quantity_kg: z.coerce.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required"),
  cost_per_unit: z.coerce.number().nonnegative().optional(),
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
}

export function AddFeedStockDialog({
  open,
  onOpenChange,
  farmId,
  editItem,
}: AddFeedStockDialogProps) {
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      feed_type: "",
      quantity_kg: 0,
      unit: "kg",
      cost_per_unit: undefined,
      reorder_threshold: undefined,
      supplier: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (editItem) {
      form.reset({
        feed_type: editItem.feed_type,
        quantity_kg: Number(editItem.quantity_kg),
        unit: editItem.unit,
        cost_per_unit: editItem.cost_per_unit ? Number(editItem.cost_per_unit) : undefined,
        reorder_threshold: editItem.reorder_threshold ? Number(editItem.reorder_threshold) : undefined,
        supplier: editItem.supplier || "",
        notes: editItem.notes || "",
      });
    } else {
      form.reset({
        feed_type: "",
        quantity_kg: 0,
        unit: "kg",
        cost_per_unit: undefined,
        reorder_threshold: undefined,
        supplier: "",
        notes: "",
      });
    }
  }, [editItem, form]);

  const onSubmit = async (data: FormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editItem) {
        // Update existing item
        const quantityChange = Number(data.quantity_kg) - Number(editItem.quantity_kg);

        const { error: updateError } = await supabase
          .from('feed_inventory')
          .update({
            ...data,
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
              balance_after: data.quantity_kg,
              notes: `Stock adjusted from ${editItem.quantity_kg} to ${data.quantity_kg}`,
              created_by: user.id,
            });

          if (transactionError) throw transactionError;
        }

        toast({
          title: "Success",
          description: "Feed stock updated successfully",
        });
      } else {
        // Create new item
        const { data: newItem, error: insertError } = await supabase
          .from('feed_inventory')
          .insert([{
            feed_type: data.feed_type,
            quantity_kg: data.quantity_kg,
            unit: data.unit,
            cost_per_unit: data.cost_per_unit,
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
            quantity_change_kg: data.quantity_kg,
            balance_after: data.quantity_kg,
            notes: 'Initial stock',
            created_by: user.id,
          });

        if (transactionError) throw transactionError;

        toast({
          title: "Success",
          description: "Feed stock added successfully",
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Add'} Feed Stock</DialogTitle>
          <DialogDescription>
            {editItem ? 'Update' : 'Add'} feed inventory details for your farm
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="feed_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Feed Type *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Hay, Silage, Concentrates" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity_kg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cost_per_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost per Unit</FormLabel>
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
