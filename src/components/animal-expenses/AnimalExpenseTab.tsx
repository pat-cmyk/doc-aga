import { useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useAnimalExpenses,
  useAnimalExpenseSummary,
  useDeleteAnimalExpense,
} from "@/hooks/useAnimalExpenses";
import { AnimalCostSummary } from "./AnimalCostSummary";
import { AddAnimalExpenseDialog } from "./AddAnimalExpenseDialog";
import { toast } from "sonner";

interface AnimalExpenseTabProps {
  animalId: string;
  farmId: string;
  animalName?: string;
  purchasePrice: number | null;
  grantSource: string | null;
  acquisitionType: string | null;
  isOnline: boolean;
  readOnly?: boolean;
}

export function AnimalExpenseTab({
  animalId,
  farmId,
  animalName,
  purchasePrice,
  grantSource,
  acquisitionType,
  isOnline,
  readOnly = false,
}: AnimalExpenseTabProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: expenses, isLoading: expensesLoading } =
    useAnimalExpenses(animalId);
  const { data: summary, isLoading: summaryLoading } =
    useAnimalExpenseSummary(animalId);
  const deleteExpense = useDeleteAnimalExpense();

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      await deleteExpense.mutateAsync({
        expenseId: deleteConfirmId,
        animalId,
      });
      toast.success("Expense deleted");
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error("Failed to delete expense");
      console.error(error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Cost Summary */}
      <AnimalCostSummary
        purchasePrice={purchasePrice}
        grantSource={grantSource}
        acquisitionType={acquisitionType}
        categoryBreakdown={summary?.categoryBreakdown || {}}
        totalExpenses={summary?.totalExpenses || 0}
        isLoading={summaryLoading}
      />

      {/* Expense History */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Expense History
          </CardTitle>
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              disabled={!isOnline}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : expenses && expenses.length > 0 ? (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {expense.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(expense.expense_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    {expense.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {expense.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {formatCurrency(expense.amount)}
                    </span>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(expense.id)}
                        disabled={!isOnline}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No expenses recorded yet</p>
              <p className="text-xs mt-1">
                Track veterinary costs, medicine, and other expenses
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      <AddAnimalExpenseDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        animalId={animalId}
        farmId={farmId}
        animalName={animalName}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
