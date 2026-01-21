import { Plus, Coins, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { AddRevenueDialog } from "./AddRevenueDialog";
import { FinancialCapacityReport } from "./FinancialCapacityReport";

interface MobileQuickActionsProps {
  farmId: string;
}

export function MobileQuickActions({ farmId }: MobileQuickActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <AddExpenseDialog
        farmId={farmId}
        trigger={
          <Button 
            variant="default" 
            size="sm" 
            className="w-full h-11 gap-1.5 text-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            Expense
          </Button>
        }
      />
      
      <AddRevenueDialog
        farmId={farmId}
        trigger={
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full h-11 gap-1.5 text-xs font-medium"
          >
            <Coins className="h-4 w-4" />
            Revenue
          </Button>
        }
      />

      <FinancialCapacityReport
        farmId={farmId}
        trigger={
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full h-11 gap-1.5 text-xs font-medium"
          >
            <FileText className="h-4 w-4" />
            Report
          </Button>
        }
      />
    </div>
  );
}
