import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Droplet } from "lucide-react";
import { useCoopMilkReceivings } from "@/hooks/useCoopMilkCollection";
import { RecordMilkReceiptDialog } from "./RecordMilkReceiptDialog";
import { CoopMilkReceivingLog } from "./CoopMilkReceivingLog";
import { format, startOfDay, endOfDay } from "date-fns";

interface Props {
  cooperativeId: string;
}

export const CoopMilkCollection = ({ cooperativeId }: Props) => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: today,
    to: today,
  });

  const { data: receivings, isLoading } = useCoopMilkReceivings(cooperativeId, dateRange);

  // Summary for active records only
  const activeReceivings = receivings?.filter((r) => r.status === "active") || [];
  const totalLiters = activeReceivings.reduce((sum, r) => sum + r.volume_liters, 0);
  const totalValue = activeReceivings.reduce((sum, r) => sum + r.total_value, 0);
  const uniqueFarms = new Set(activeReceivings.map((r) => r.farm_id)).size;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Liters</p>
            <p className="text-2xl font-bold">{totalLiters.toFixed(1)}L</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">₱{totalValue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Farms</p>
            <p className="text-2xl font-bold">{uniqueFarms}</p>
          </CardContent>
        </Card>
      </div>

      {/* Milk Collection Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5" />
            Milk Collection
          </CardTitle>
          <RecordMilkReceiptDialog cooperativeId={cooperativeId} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CoopMilkReceivingLog
              receivings={receivings || []}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
