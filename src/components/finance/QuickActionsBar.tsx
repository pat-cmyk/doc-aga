import { Plus, Coins, ShoppingCart, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { AddRevenueDialog } from "./AddRevenueDialog";

interface QuickActionsBarProps {
  farmId: string;
  canManage: boolean;
}

export function QuickActionsBar({ farmId, canManage }: QuickActionsBarProps) {
  if (!canManage) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AddExpenseDialog
        farmId={farmId}
        trigger={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span> Expense
          </Button>
        }
      />
      
      <AddRevenueDialog
        farmId={farmId}
        trigger={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Coins className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span> Revenue
          </Button>
        }
      />

      <AddRevenueDialog
        farmId={farmId}
        defaultSource="Animal Sale"
        trigger={
          <Button variant="outline" size="sm" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            Record Sale
          </Button>
        }
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <AddRevenueDialog
            farmId={farmId}
            defaultSource="Milk Sale"
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Record Milk Sale
              </DropdownMenuItem>
            }
          />
          <AddRevenueDialog
            farmId={farmId}
            defaultSource="Government Subsidy"
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Record Subsidy
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
