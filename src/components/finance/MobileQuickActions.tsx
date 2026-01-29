import { Plus, Coins, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { AddRevenueDialog } from "./AddRevenueDialog";
import { FinancialCapacityReport } from "./FinancialCapacityReport";

interface MobileQuickActionsProps {
  farmId: string;
  canManage: boolean;
}

export function MobileQuickActions({ farmId, canManage }: MobileQuickActionsProps) {
  // If user can manage, show all 3 buttons in a grid
  // If user cannot manage, show only the Report button centered
  if (!canManage) {
    return (
      <div className="flex justify-center">
        <FinancialCapacityReport
          farmId={farmId}
          trigger={
            <Button 
              variant="outline" 
              size="sm" 
              className="h-11 gap-1.5 text-xs font-medium px-6"
            >
              <FileText className="h-4 w-4" />
              Download Report
            </Button>
          }
        />
      </div>
    );
  }

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
