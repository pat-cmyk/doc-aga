import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseSummary } from "@/components/finance/ExpenseSummary";
import { ExpenseList } from "@/components/finance/ExpenseList";
import { AddExpenseDialog } from "@/components/finance/AddExpenseDialog";

interface FinanceTabProps {
  farmId: string;
  canManage: boolean;
}

export function FinanceTab({ farmId, canManage }: FinanceTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Finance</h2>
          <p className="text-muted-foreground">Track your farm expenses</p>
        </div>
        {canManage && (
          <AddExpenseDialog 
            farmId={farmId}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            }
          />
        )}
      </div>

      <ExpenseSummary farmId={farmId} />

      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Expenses</h3>
        <ExpenseList farmId={farmId} canManage={canManage} />
      </div>
    </div>
  );
}
