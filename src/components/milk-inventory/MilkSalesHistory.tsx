import { useMilkSalesHistory } from "@/hooks/useMilkInventory";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { History } from "lucide-react";

interface MilkSalesHistoryProps {
  farmId: string;
}

const SPECIES_ICONS: Record<string, string> = {
  cattle: "🐄",
  goat: "🐐",
  carabao: "🐃",
  sheep: "🐑",
};

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

  // Group by species for summary
  const bySpecies = data.reduce((acc, r) => {
    const type = r.livestock_type || 'cattle';
    if (!acc[type]) acc[type] = 0;
    acc[type] += r.liters_sold;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
        <div>
          <p className="text-sm text-muted-foreground">Total Sold</p>
          <p className="text-xl font-bold">{totalLiters.toLocaleString("en-PH", { maximumFractionDigits: 1 })} L</p>
        </div>
        {Object.keys(bySpecies).length > 1 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {Object.entries(bySpecies).map(([species, liters]) => (
              <Badge key={species} variant="secondary" className="gap-1">
                <span>{SPECIES_ICONS[species] || "🐄"}</span>
                <span className="capitalize">{species}:</span>
                <span>{liters.toFixed(1)} L</span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Sales Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Animal</TableHead>
              <TableHead>Type</TableHead>
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
                <TableCell>
                  <span className="flex items-center gap-1">
                    <span>{SPECIES_ICONS[sale.livestock_type] || "🐄"}</span>
                    <span className="text-xs capitalize text-muted-foreground">{sale.livestock_type}</span>
                  </span>
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
