import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Truck } from "lucide-react";
import { useCoopFeedDisbursements } from "@/hooks/useCoopFeedDisbursement";
import { RecordFeedDisbursementDialog } from "./RecordFeedDisbursementDialog";
import { format } from "date-fns";

interface Props {
  cooperativeId: string;
}

export const CoopFeedDisbursement = ({ cooperativeId }: Props) => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: today,
    to: today,
  });

  const { data: disbursements, isLoading } = useCoopFeedDisbursements(cooperativeId, dateRange);

  const activeRecords = disbursements?.filter((d) => d.status === "active") || [];
  const totalKg = activeRecords.reduce((sum, d) => sum + d.quantity_kg, 0);
  const totalCost = activeRecords.reduce((sum, d) => sum + d.total_cost, 0);
  const uniqueFarms = new Set(activeRecords.map((d) => d.farm_id)).size;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Released</p>
            <p className="text-2xl font-bold">{totalKg.toFixed(1)} kg</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Cost</p>
            <p className="text-2xl font-bold">₱{totalCost.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Farms Served</p>
            <p className="text-2xl font-bold">{uniqueFarms}</p>
          </CardContent>
        </Card>
      </div>

      {/* Disbursement Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Feed Disbursement
          </CardTitle>
          <RecordFeedDisbursementDialog cooperativeId={cooperativeId} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date Filter */}
              <div className="flex gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {!disbursements || disbursements.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No feed disbursements for this period.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Farm</TableHead>
                        <TableHead>Feed Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty (kg)</TableHead>
                        <TableHead className="text-right">₱/kg</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disbursements.map((d) => (
                        <TableRow
                          key={d.id}
                          className={d.status === "reversed" ? "opacity-50 line-through" : ""}
                        >
                          <TableCell className="text-sm">
                            {format(new Date(d.disbursement_date), "MMM d")}
                          </TableCell>
                          <TableCell className="font-medium">{d.farm_name}</TableCell>
                          <TableCell>{d.feed_type}</TableCell>
                          <TableCell className="capitalize">{d.category}</TableCell>
                          <TableCell className="text-right">{d.quantity_kg.toFixed(1)}</TableCell>
                          <TableCell className="text-right">₱{d.cost_per_kg.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">
                            ₱{d.total_cost.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {d.entry_type === "correction" && (
                              <Badge variant="outline" className="text-xs">Correction</Badge>
                            )}
                            {d.entry_type === "reversal" && (
                              <Badge variant="destructive" className="text-xs">Reversal</Badge>
                            )}
                            {d.status === "reversed" && d.entry_type === "original" && (
                              <Badge variant="secondary" className="text-xs">Reversed</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
