import { ChevronDown } from "lucide-react";
import { FinancialHealthSummary } from "@/components/finance/FinancialHealthSummary";
import { QuickActionsBar } from "@/components/finance/QuickActionsBar";
import { RevenueExpenseComparison } from "@/components/finance/RevenueExpenseComparison";
import { ExpenseList } from "@/components/finance/ExpenseList";
import { HerdValueChart } from "@/components/finance/HerdValueChart";
import { ProfitabilityThermometer } from "@/components/finance/ProfitabilityThermometer";
import { AnimalCostAnalysis } from "@/components/finance/AnimalCostAnalysis";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FinanceTabProps {
  farmId: string;
  canManage: boolean;
}

export function FinanceTab({ farmId, canManage }: FinanceTabProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [transactionsOpen, setTransactionsOpen] = useState(false);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Finance</h2>
          <p className="text-muted-foreground text-sm">
            Track your farm income, expenses, and asset value
          </p>
        </div>
        <QuickActionsBar farmId={farmId} canManage={canManage} />
      </div>

      {/* HERO: Financial Health Summary - The 15-second answer */}
      <FinancialHealthSummary farmId={farmId} />

      {/* NEW: Money In vs Money Out Comparison */}
      <RevenueExpenseComparison farmId={farmId} />

      {/* Biological Asset Value - Important for farmers */}
      <HerdValueChart farmId={farmId} />

      {/* Collapsible Details Section */}
      <div className="space-y-3">
        {/* Advanced Details */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors border border-border">
            <span className="font-semibold text-sm">Detailed P&L Analysis</span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              detailsOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-4">
            <ProfitabilityThermometer farmId={farmId} />
            <AnimalCostAnalysis farmId={farmId} />
          </CollapsibleContent>
        </Collapsible>

        {/* Recent Transactions */}
        <Collapsible open={transactionsOpen} onOpenChange={setTransactionsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors border border-border">
            <span className="font-semibold text-sm">Recent Expenses</span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              transactionsOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <ExpenseList farmId={farmId} canManage={canManage} />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
