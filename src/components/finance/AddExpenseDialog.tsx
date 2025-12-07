import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Building2, Home, Info } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, ALLOCATION_TYPES } from "@/lib/expenseCategories";
import { useAddExpense, useUpdateExpense, type Expense } from "@/hooks/useExpenses";

const expenseSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Amount must be greater than 0"
  ),
  expense_date: z.date({
    required_error: "Date is required",
  }).refine(
    (date) => date <= new Date(),
    "Date cannot be in the future"
  ),
  payment_method: z.string().optional(),
  description: z.string().optional(),
  allocation_type: z.enum(['Operational', 'Personal']),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface AddExpenseDialogProps {
  farmId: string;
  expense?: Expense;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddExpenseDialog({ farmId, expense, trigger, onSuccess }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPersonal, setIsPersonal] = useState(expense?.allocation_type === 'Personal');
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: expense?.category || "",
      amount: expense?.amount?.toString() || "",
      expense_date: expense ? new Date(expense.expense_date) : new Date(),
      payment_method: expense?.payment_method || "",
      description: expense?.description || "",
      allocation_type: expense?.allocation_type === 'Personal' ? 'Personal' : 'Operational',
    },
  });

  // Update form when toggle changes
  useEffect(() => {
    if (isPersonal) {
      form.setValue('allocation_type', 'Personal');
      form.setValue('category', 'Other');
    } else {
      form.setValue('allocation_type', 'Operational');
      // Only reset category if it was auto-set to 'Other'
      if (form.getValues('category') === 'Other' && !expense?.category) {
        form.setValue('category', '');
      }
    }
  }, [isPersonal, form, expense?.category]);

  const onSubmit = async (data: ExpenseFormData) => {
    const expenseData = {
      farm_id: farmId,
      category: isPersonal ? 'Other' : data.category,
      amount: Number(data.amount),
      expense_date: format(data.expense_date, "yyyy-MM-dd"),
      payment_method: data.payment_method || null,
      description: data.description || null,
      allocation_type: isPersonal ? ALLOCATION_TYPES.PERSONAL : ALLOCATION_TYPES.FARM,
    };

    if (expense) {
      await updateExpense.mutateAsync({
        id: expense.id,
        ...expenseData,
      });
    } else {
      await addExpense.mutateAsync(expenseData);
    }

    form.reset();
    setIsPersonal(false);
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Add Expense</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogDescription>
            {expense ? "Update the expense details" : "Enter the details for your expense"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Expense Type Toggle */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Expense Type</Label>
              <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Building2 className={cn(
                    "h-4 w-4 transition-colors",
                    !isPersonal ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    !isPersonal ? "text-foreground" : "text-muted-foreground"
                  )}>
                    Farm Business
                  </span>
                </div>
                <Switch
                  checked={isPersonal}
                  onCheckedChange={setIsPersonal}
                  aria-label="Toggle expense type"
                />
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    isPersonal ? "text-foreground" : "text-muted-foreground"
                  )}>
                    Personal
                  </span>
                  <Home className={cn(
                    "h-4 w-4 transition-colors",
                    isPersonal ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
              </div>
              
              {/* Info message for Personal expenses */}
              {isPersonal && (
                <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    This will be tracked in Cash Flow but excluded from Farm Profitability calculations.
                  </span>
                </div>
              )}
            </div>

            {/* Category - Hidden for Personal expenses */}
            {!isPersonal && (
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
              name="expense_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
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
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
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
              <Button type="submit" disabled={addExpense.isPending || updateExpense.isPending}>
                {expense ? "Update" : "Add"} Expense
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
