import { useMilkSalesHistory } from "@/hooks/useMilkInventory";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { History } from "lucide-react";

interface MilkSalesHistoryProps {
  farmId: string;
}

export function MilkSalesHistory({ farmId }: MilkSalesHistoryProps) {
  const { data, isLoading } = useMilkSalesHistory(farmId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No sales history yet</p>
        <p className="text-sm">Milk sales will appear here after recording</p>
      </div>
    );
  }

  // Calculate totals
  const totalLiters = data.reduce((sum, r) => sum + r.liters, 0);
  const totalRevenue = data.reduce((sum, r) => sum + (r.sale_amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">Total Sold</p>
          <p className="text-xl font-bold">{totalLiters.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-xl font-bold text-primary">
            ₱{totalRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Sales Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Animal</TableHead>
              <TableHead className="text-right">Liters</TableHead>
              <TableHead className="text-right">Price/L</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(sale.record_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {sale.animal_name || sale.ear_tag || "—"}
                </TableCell>
                <TableCell className="text-right">
                  {sale.liters.toFixed(1)}
                </TableCell>
                <TableCell className="text-right">
                  {sale.price_per_liter ? `₱${sale.price_per_liter.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {sale.sale_amount ? `₱${sale.sale_amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
