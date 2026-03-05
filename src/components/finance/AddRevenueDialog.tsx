import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAddRevenue, useUpdateRevenue, type Revenue } from "@/hooks/useRevenues";
import { REVENUE_SOURCES, getRevenueSourceIcon } from "@/lib/revenueCategories";

const revenueSchema = z.object({
  source: z.string().min(1, "Source is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Amount must be greater than 0"
  ),
  transaction_date: z.date({
    required_error: "Date is required",
  }).refine(
    (date) => date <= new Date(),
    "Date cannot be in the future"
  ),
  notes: z.string().optional(),
});

type RevenueFormData = z.infer<typeof revenueSchema>;

interface AddRevenueDialogProps {
  farmId: string;
  defaultSource?: string;
  revenue?: Revenue;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddRevenueDialog({
  farmId,
  defaultSource,
  revenue,
  trigger,
  onSuccess
}: AddRevenueDialogProps) {
  const isEditing = !!revenue;
  const isSystemGenerated = !!(revenue?.linked_milk_log_id || revenue?.linked_animal_id);
  const [open, setOpen] = useState(isEditing);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const addRevenue = useAddRevenue();
  const updateRevenue = useUpdateRevenue();

  const form = useForm<RevenueFormData>({
    resolver: zodResolver(revenueSchema),
    defaultValues: {
      source: revenue?.source || defaultSource || "",
      amount: revenue?.amount?.toString() || "",
      transaction_date: revenue ? new Date(revenue.transaction_date) : new Date(),
      notes: revenue?.notes || "",
    },
  });

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      form.reset({
        source: revenue?.source || defaultSource || "",
        amount: revenue?.amount?.toString() || "",
        transaction_date: revenue ? new Date(revenue.transaction_date) : new Date(),
        notes: revenue?.notes || "",
      });
    } else if (isEditing) {
      onSuccess?.();
    }
    setOpen(newOpen);
  };

  const onSubmit = async (data: RevenueFormData) => {
    if (isEditing && revenue) {
      await updateRevenue.mutateAsync({
        id: revenue.id,
        source: data.source,
        amount: Number(data.amount),
        transaction_date: format(data.transaction_date, "yyyy-MM-dd"),
        notes: data.notes || null,
      });
    } else {
      await addRevenue.mutateAsync({
        farm_id: farmId,
        source: data.source,
        amount: Number(data.amount),
        transaction_date: format(data.transaction_date, "yyyy-MM-dd"),
        notes: data.notes || undefined,
      });
    }

    form.reset();
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Coins className="h-4 w-4" />
            Add Revenue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Revenue" : "Add Revenue"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update revenue details" : "Record income from farm activities"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto space-y-4 px-1">
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Revenue Source</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSystemGenerated}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REVENUE_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          <span className="flex items-center gap-2">
                            <span>{getRevenueSourceIcon(source)}</span>
                            <span>{source}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSystemGenerated && (
                    <p className="text-xs text-muted-foreground">
                      Source cannot be changed for system-generated revenue
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (PHP)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transaction_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "pl-3 text-left font-normal",
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
                        onSelect={(date) => {
                          field.onChange(date);
                          setDatePopoverOpen(false);
                        }}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter additional details..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addRevenue.isPending || updateRevenue.isPending}>
                {isEditing ? "Update Revenue" : "Add Revenue"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
