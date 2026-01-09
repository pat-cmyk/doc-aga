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

  // Calculate totals using liters_sold
  const totalLiters = data.reduce((sum, r) => sum + r.liters_sold, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg bg-muted/50 p-3">
        <p className="text-sm text-muted-foreground">Total Sold</p>
        <p className="text-xl font-bold">{totalLiters.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L</p>
      </div>

      {/* Sales Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Animal</TableHead>
              <TableHead className="text-right">Original</TableHead>
              <TableHead className="text-right">Sold</TableHead>
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
                <TableCell className="text-right text-muted-foreground">
                  {sale.liters_original.toFixed(1)} L
                </TableCell>
                <TableCell className="text-right font-medium">
                  {sale.liters_sold.toFixed(1)} L
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
