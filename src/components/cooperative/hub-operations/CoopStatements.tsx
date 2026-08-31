import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, CheckCircle, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { useCooperativeMemberFarms } from "@/hooks/useCooperative";
import {
  useCoopSOAPeriods,
  useComputeCoopSOA,
  useFinalizeCoopSOA,
  useSettleCoopSOA,
  getBimonthlyPeriod,
  type SOAComputeResult,
} from "@/hooks/useCoopSOA";
import { format, subMonths } from "date-fns";

interface Props {
  cooperativeId: string;
}

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
  draft: { variant: "outline", label: "Draft" },
  finalized: { variant: "secondary", label: "Finalized" },
  settled: { variant: "default", label: "Settled" },
};

export const CoopStatements = ({ cooperativeId }: Props) => {
  const { toast } = useToast();
  const { data: memberFarms } = useCooperativeMemberFarms(cooperativeId);
  const { data: soaPeriods, isLoading } = useCoopSOAPeriods(cooperativeId);
  const computeSOA = useComputeCoopSOA();
  const finalizeSOA = useFinalizeCoopSOA();
  const settleSOA = useSettleCoopSOA();

  const [selectedFarm, setSelectedFarm] = useState("");
  const [soaPreview, setSOAPreview] = useState<SOAComputeResult | null>(null);
  const [previewPeriod, setPreviewPeriod] = useState<{ start: string; end: string } | null>(null);

  const acceptedFarms = memberFarms?.filter((f: any) => f.invitation_status === "accepted") || [];

  // Generate bi-monthly period options for the last 3 months
  const periodOptions: { start: string; end: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const refDate = i === 0 ? new Date() : subMonths(new Date(), Math.floor(i / 2));
    const adjustedDate = i % 2 === 0 ? refDate : new Date(refDate.getFullYear(), refDate.getMonth(), 16);
    const period = getBimonthlyPeriod(adjustedDate);
    const label = `${format(new Date(period.start), "MMM d")} – ${format(new Date(period.end), "MMM d, yyyy")}`;
    if (!periodOptions.find((p) => p.start === period.start)) {
      periodOptions.push({ ...period, label });
    }
  }

  const handleComputePreview = async (periodStart: string, periodEnd: string) => {
    if (!selectedFarm) {
      toast({ title: "Select a farm first", variant: "destructive" });
      return;
    }

    try {
      const result = await computeSOA.mutateAsync({
        cooperativeId,
        farmId: selectedFarm,
        periodStart,
        periodEnd,
      });
      setSOAPreview(result);
      setPreviewPeriod({ start: periodStart, end: periodEnd });
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "computing SOA");
    }
  };

  const handleFinalize = async () => {
    if (!selectedFarm || !previewPeriod) return;

    try {
      const result = await finalizeSOA.mutateAsync({
        cooperativeId,
        farmId: selectedFarm,
        periodStart: previewPeriod.start,
        periodEnd: previewPeriod.end,
      });

      if (result === "success") {
        toast({ title: "SOA Finalized", description: "Statement has been locked." });
        setSOAPreview(null);
        setPreviewPeriod(null);
      } else {
        toast({ title: "Error", description: String(result), variant: "destructive" });
      }
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "finalizing SOA");
    }
  };

  const handleSettle = async (farmId: string, periodStart: string) => {
    try {
      const result = await settleSOA.mutateAsync({
        cooperativeId,
        farmId,
        periodStart,
      });

      if (result === "success") {
        toast({ title: "SOA Settled", description: "Payment recorded." });
      } else {
        toast({ title: "Error", description: String(result), variant: "destructive" });
      }
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "settling SOA");
    }
  };

  return (
    <div className="space-y-6">
      {/* SOA Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Statement of Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Member Farm</label>
              <Select value={selectedFarm} onValueChange={setSelectedFarm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select farm" />
                </SelectTrigger>
                <SelectContent>
                  {acceptedFarms.map((farm: any) => (
                    <SelectItem key={farm.farm_id} value={farm.farm_id}>
                      {farm.farm_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <div className="flex flex-wrap gap-2">
                {periodOptions.slice(0, 4).map((period) => (
                  <Button
                    key={period.start}
                    size="sm"
                    variant="outline"
                    disabled={!selectedFarm || computeSOA.isPending}
                    onClick={() => handleComputePreview(period.start, period.end)}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {computeSOA.isPending && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {/* SOA Preview */}
          {soaPreview && previewPeriod && (
            <Card className="border-2 border-primary/20">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">
                    SOA Preview: {format(new Date(previewPeriod.start), "MMM d")} – {format(new Date(previewPeriod.end), "MMM d, yyyy")}
                  </h4>
                  <Button size="sm" onClick={handleFinalize} disabled={finalizeSOA.isPending}>
                    {finalizeSOA.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <><Lock className="mr-1 h-4 w-4" /> Finalize</>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs text-muted-foreground">Milk Revenue</p>
                    <p className="text-lg font-bold">₱{soaPreview.total_milk_value.toLocaleString()}</p>
                    <p className="text-xs">{soaPreview.total_milk_liters.toFixed(1)}L</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs text-muted-foreground">Feed Cost</p>
                    <p className="text-lg font-bold">₱{soaPreview.total_feed_cost.toLocaleString()}</p>
                    <p className="text-xs">{soaPreview.total_feed_kg.toFixed(1)}kg</p>
                  </div>
                  <div className={`rounded-lg p-3 ${soaPreview.net_balance >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                    <p className="text-xs text-muted-foreground">Net Balance</p>
                    <p className={`text-lg font-bold ${soaPreview.net_balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {soaPreview.net_balance >= 0 ? "+" : ""}₱{soaPreview.net_balance.toLocaleString()}
                    </p>
                    <p className="text-xs">{soaPreview.net_balance >= 0 ? "Payable to farmer" : "Collectible"}</p>
                  </div>
                </div>

                {/* Milk Line Items */}
                {soaPreview.milk_line_items.length > 0 && (
                  <div>
                    <h5 className="mb-2 text-sm font-medium">Milk Deliveries</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Session</TableHead>
                          <TableHead className="text-right">Liters</TableHead>
                          <TableHead className="text-right">₱/L</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {soaPreview.milk_line_items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{format(new Date(item.receiving_date), "MMM d")}</TableCell>
                            <TableCell>{item.session}</TableCell>
                            <TableCell className="text-right">{item.volume_liters.toFixed(1)}</TableCell>
                            <TableCell className="text-right">₱{item.price_per_liter.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">₱{item.total_value.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Feed Line Items */}
                {soaPreview.feed_line_items.length > 0 && (
                  <div>
                    <h5 className="mb-2 text-sm font-medium">Feed Released</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Feed</TableHead>
                          <TableHead className="text-right">kg</TableHead>
                          <TableHead className="text-right">₱/kg</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {soaPreview.feed_line_items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{format(new Date(item.disbursement_date), "MMM d")}</TableCell>
                            <TableCell>{item.feed_type}</TableCell>
                            <TableCell className="text-right">{item.quantity_kg.toFixed(1)}</TableCell>
                            <TableCell className="text-right">₱{item.cost_per_kg.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">₱{item.total_cost.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Existing SOAs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statement History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !soaPeriods || soaPeriods.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No statements generated yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Farm</TableHead>
                    <TableHead className="text-right">Milk Value</TableHead>
                    <TableHead className="text-right">Feed Cost</TableHead>
                    <TableHead className="text-right">Net Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soaPeriods.map((soa) => {
                    const badge = STATUS_BADGES[soa.status] || STATUS_BADGES.draft;
                    return (
                      <TableRow key={soa.id}>
                        <TableCell className="text-sm">
                          {format(new Date(soa.period_start), "MMM d")} – {format(new Date(soa.period_end), "MMM d")}
                          {soa.revision_number > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">v{soa.revision_number}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{soa.farm_name}</TableCell>
                        <TableCell className="text-right">₱{soa.total_milk_value.toLocaleString()}</TableCell>
                        <TableCell className="text-right">₱{soa.total_feed_cost.toLocaleString()}</TableCell>
                        <TableCell className={`text-right font-medium ${soa.net_balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {soa.net_balance >= 0 ? "+" : ""}₱{soa.net_balance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {soa.status === "finalized" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSettle(soa.farm_id, soa.period_start)}
                              disabled={settleSOA.isPending}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Settle
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
