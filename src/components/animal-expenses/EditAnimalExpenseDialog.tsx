import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEditAnimalExpense, AnimalExpense } from "@/hooks/useAnimalExpenses";
import { ANIMAL_EXPENSE_CATEGORIES } from "@/lib/animalExpenseCategories";
import { PAYMENT_METHODS } from "@/lib/expenseCategories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface EditAnimalExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: AnimalExpense;
  farmId: string;
  animalName?: string;
}

export function EditAnimalExpenseDialog({
  open,
  onOpenChange,
  expense,
  farmId,
  animalName,
}: EditAnimalExpenseDialogProps) {
  const [category, setCategory] = useState(expense.category);
  const [amount, setAmount] = useState(String(expense.amount));
  const [date, setDate] = useState<Date>(new Date(expense.expense_date));
  const [paymentMethod, setPaymentMethod] = useState(expense.payment_method || "");
  const [description, setDescription] = useState(expense.description || "");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const isOnline = useOnlineStatus();

  const editExpense = useEditAnimalExpense();

  // Sync form when expense changes
  useEffect(() => {
    setCategory(expense.category);
    setAmount(String(expense.amount));
    setDate(new Date(expense.expense_date));
    setPaymentMethod(expense.payment_method || "");
    setDescription(expense.description || "");
  }, [expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !amount) {
      toast.error("Please fill in required fields");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await editExpense.mutateAsync({
        expenseId: expense.id,
        animalId: expense.animal_id,
        farmId,
        category,
        amount: parsedAmount,
        expense_date: format(date, "yyyy-MM-dd"),
        payment_method: paymentMethod || undefined,
        description: description || undefined,
      });

      toast.success("Expense updated");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update expense");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Edit Expense {animalName ? `for ${animalName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 px-1">
          <div className="space-y-2">
            <Label htmlFor="edit-category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {ANIMAL_EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-amount">Amount (PHP) *</Label>
            <Input
              id="edit-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d);
                      setDatePopoverOpen(false);
                    }
                  }}
                  disabled={(d) => d > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-paymentMethod">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method (optional)" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <div className="flex gap-2">
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Deworming treatment, Vitamin injection..."
                rows={2}
                className="flex-1"
              />
              <VoiceInputButton
                onTranscription={(text) => setDescription(prev => prev ? `${prev} ${text}` : text)}
                disabled={!isOnline}
                className="self-start"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={editExpense.isPending}
              className="flex-1"
            >
              {editExpense.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
