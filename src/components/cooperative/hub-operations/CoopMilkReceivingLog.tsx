import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import type { CoopMilkReceiving } from "@/hooks/useCoopMilkCollection";

interface Props {
  receivings: CoopMilkReceiving[];
  dateRange: { from: string; to: string };
  onDateRangeChange: (range: { from: string; to: string }) => void;
}

export const CoopMilkReceivingLog = ({ receivings, dateRange, onDateRangeChange }: Props) => {
  return (
    <div className="space-y-4">
      {/* Date Range Filter */}
      <div className="flex gap-4">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={dateRange.from}
            onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={dateRange.to}
            onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Log Table */}
      {receivings.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No milk receivings for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Farm</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Species</TableHead>
                <TableHead className="text-right">Liters</TableHead>
                <TableHead className="text-right">₱/L</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivings.map((r) => (
                <TableRow
                  key={r.id}
                  className={r.status === "reversed" ? "opacity-50 line-through" : ""}
                >
                  <TableCell className="text-sm">
                    {format(new Date(r.receiving_date), "MMM d")}
                  </TableCell>
                  <TableCell className="font-medium">{r.farm_name}</TableCell>
                  <TableCell>{r.session}</TableCell>
                  <TableCell className="capitalize">{r.species}</TableCell>
                  <TableCell className="text-right">{r.volume_liters.toFixed(1)}</TableCell>
                  <TableCell className="text-right">₱{r.price_per_liter.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">₱{r.total_value.toFixed(2)}</TableCell>
                  <TableCell>
                    {r.entry_type === "correction" && (
                      <Badge variant="outline" className="text-xs">Correction</Badge>
                    )}
                    {r.entry_type === "reversal" && (
                      <Badge variant="destructive" className="text-xs">Reversal</Badge>
                    )}
                    {r.status === "reversed" && r.entry_type === "original" && (
                      <Badge variant="secondary" className="text-xs">Reversed</Badge>
                    )}
                    {r.milk_quality === "rejected" && (
                      <Badge variant="destructive" className="ml-1 text-xs">Rejected</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
