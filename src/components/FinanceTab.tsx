import { ChevronDown } from "lucide-react";
import { FinancialHealthSummary } from "@/components/finance/FinancialHealthSummary";
import { QuickActionsBar } from "@/components/finance/QuickActionsBar";
import { MobileQuickActions } from "@/components/finance/MobileQuickActions";
import { ContextualInsights } from "@/components/finance/ContextualInsights";
import { RevenueExpenseComparison } from "@/components/finance/RevenueExpenseComparison";
import { ExpenseList } from "@/components/finance/ExpenseList";
import { HerdValueChart } from "@/components/finance/HerdValueChart";
import { ProfitabilityThermometer } from "@/components/finance/ProfitabilityThermometer";
import { AnimalCostAnalysis } from "@/components/finance/AnimalCostAnalysis";
import { DataCompletenessIndicator } from "@/components/finance/DataCompletenessIndicator";
import { FinanceDateRangePicker, DateRange, getPresetRange } from "@/components/finance/FinanceDateRangePicker";
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
  onNavigateToTab?: (tab: string) => void;
}

export function FinanceTab({ farmId, canManage, onNavigateToTab }: FinanceTabProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange("this_month"));

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 md:pb-0">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Finance</h2>
          <p className="text-muted-foreground text-sm">
            Track your farm income, expenses, and asset value
          </p>
        </div>
        {/* Desktop Quick Actions - always visible */}
        <div className="hidden md:block">
          <QuickActionsBar farmId={farmId} canManage={canManage} />
        </div>
      </div>

      {/* Date Range Picker */}
      <FinanceDateRangePicker 
        dateRange={dateRange} 
        onDateRangeChange={setDateRange} 
      />

      {/* HERO: Financial Health Summary - The 15-second answer */}
      <FinancialHealthSummary farmId={farmId} dateRange={dateRange} />

      {/* Data Completeness Indicator - Shows missing data for financial reports */}
      <DataCompletenessIndicator farmId={farmId} onNavigateToTab={onNavigateToTab} />

      {/* Contextual Insights - Smart tips based on data */}
      <ContextualInsights farmId={farmId} dateRange={dateRange} />

      {/* 2-Column Grid on Desktop for comparison charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RevenueExpenseComparison farmId={farmId} dateRange={dateRange} />
        <HerdValueChart farmId={farmId} />
      </div>

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
            <ProfitabilityThermometer farmId={farmId} dateRange={dateRange} />
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

      {/* Mobile Sticky Bottom Quick Actions Bar - always visible, actions conditional */}
      <div className="fixed bottom-16 left-0 right-0 md:hidden z-40 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3">
        <MobileQuickActions farmId={farmId} canManage={canManage} />
      </div>
    </div>
  );
}
