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
import { useAddRevenue } from "@/hooks/useRevenues";

const REVENUE_SOURCES = [
  "Milk Sale",
  "Animal Sale",
  "Government Subsidy",
  "Breeding Service",
  "Manure Sale",
  "Other Income",
] as const;

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
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddRevenueDialog({ 
  farmId, 
  defaultSource,
  trigger, 
  onSuccess 
}: AddRevenueDialogProps) {
  const [open, setOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const addRevenue = useAddRevenue();

  const form = useForm<RevenueFormData>({
    resolver: zodResolver(revenueSchema),
    defaultValues: {
      source: defaultSource || "",
      amount: "",
      transaction_date: new Date(),
      notes: "",
    },
  });

  // Reset form when dialog opens with new default source
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      form.reset({
        source: defaultSource || "",
        amount: "",
        transaction_date: new Date(),
        notes: "",
      });
    }
    setOpen(newOpen);
  };

  const onSubmit = async (data: RevenueFormData) => {
    await addRevenue.mutateAsync({
      farm_id: farmId,
      source: data.source,
      amount: Number(data.amount),
      transaction_date: format(data.transaction_date, "yyyy-MM-dd"),
      notes: data.notes || null,
    });

    form.reset();
    setOpen(false);
    onSuccess?.();
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "Milk Sale":
        return "🥛";
      case "Animal Sale":
        return "🐄";
      case "Government Subsidy":
        return "🏛️";
      case "Breeding Service":
        return "🧬";
      case "Manure Sale":
        return "🌱";
      default:
        return "💰";
    }
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Add Revenue
          </DialogTitle>
          <DialogDescription>
            Record income from farm activities
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Revenue Source</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REVENUE_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          <span className="flex items-center gap-2">
                            <span>{getSourceIcon(source)}</span>
                            <span>{source}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <Button type="submit" disabled={addRevenue.isPending}>
                Add Revenue
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
