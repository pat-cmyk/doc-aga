import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpenseSummary } from "@/components/finance/ExpenseSummary";
import { RevenueSummary } from "@/components/finance/RevenueSummary";
import { ExpenseList } from "@/components/finance/ExpenseList";
import { AddExpenseDialog } from "@/components/finance/AddExpenseDialog";
import { HerdValueChart } from "@/components/finance/HerdValueChart";
import { ProfitabilityThermometer } from "@/components/finance/ProfitabilityThermometer";
import { AnimalCostAnalysis } from "@/components/finance/AnimalCostAnalysis";

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
          <p className="text-muted-foreground">Track your farm income, expenses, and asset value</p>
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

      {/* Breakeven Dashboard - P&L Overview */}
      <ProfitabilityThermometer farmId={farmId} />

      {/* Biological Asset Valuation - The Living Bank Account */}
      <HerdValueChart farmId={farmId} />

      {/* Per-Animal Cost Analysis */}
      <AnimalCostAnalysis farmId={farmId} />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Revenue</h3>
        <RevenueSummary farmId={farmId} />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Expenses</h3>
        <ExpenseSummary farmId={farmId} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Expenses</h3>
        <ExpenseList farmId={farmId} canManage={canManage} />
      </div>
    </div>
  );
}
