import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, Droplet, Package, FileText } from "lucide-react";
import {
  useMyCoopMembership,
  useMyMilkDeliveries,
  useMyFeedReceipts,
  useMyCoopSOA,
} from "@/hooks/useMyCooperative";
import { format, subDays } from "date-fns";

interface Props {
  farmId: string;
}

export const MyCooperativeTab = ({ farmId }: Props) => {
  const { data: membership, isLoading: loadingMembership } = useMyCoopMembership(farmId);

  if (loadingMembership) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!membership) {
    return null; // Not a coop member — don't render anything
  }

  return (
    <div className="space-y-6">
      {/* Cooperative Header */}
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h3 className="text-lg font-bold">{membership.cooperative_name}</h3>
            <p className="text-sm text-muted-foreground">
              Member since {membership.accepted_at ? format(new Date(membership.accepted_at), "MMM d, yyyy") : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="deliveries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deliveries" className="gap-1.5">
            <Droplet className="h-4 w-4" />
            Milk Deliveries
          </TabsTrigger>
          <TabsTrigger value="feed" className="gap-1.5">
            <Package className="h-4 w-4" />
            Feed Receipts
          </TabsTrigger>
          <TabsTrigger value="soa" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Statements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deliveries">
          <MyMilkDeliveries farmId={farmId} />
        </TabsContent>
        <TabsContent value="feed">
          <MyFeedReceipts farmId={farmId} />
        </TabsContent>
        <TabsContent value="soa">
          <MyStatements farmId={farmId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// --- Sub-components ---

const MyMilkDeliveries = ({ farmId }: { farmId: string }) => {
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateRange, setDateRange] = useState({ from: thirtyDaysAgo, to: today });
  const { data: deliveries, isLoading } = useMyMilkDeliveries(farmId, dateRange);

  const activeDeliveries = deliveries?.filter((d) => d.status === "active") || [];
  const totalLiters = activeDeliveries.reduce((sum, d) => sum + d.volume_liters, 0);
  const totalValue = activeDeliveries.reduce((sum, d) => sum + d.total_value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My Milk Deliveries to Hub</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="h-8 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Delivered</p>
            <p className="text-lg font-bold">{totalLiters.toFixed(1)}L</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-lg font-bold">₱{totalValue.toLocaleString()}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !deliveries || deliveries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No deliveries for this period.</p>
        ) : (
          <div className="overflow-x-auto">
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
                {deliveries.filter((d) => d.status === "active").map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{format(new Date(d.receiving_date), "MMM d")}</TableCell>
                    <TableCell>{d.session}</TableCell>
                    <TableCell className="text-right">{d.volume_liters.toFixed(1)}</TableCell>
                    <TableCell className="text-right">₱{d.price_per_liter.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">₱{d.total_value.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MyFeedReceipts = ({ farmId }: { farmId: string }) => {
  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateRange, setDateRange] = useState({ from: thirtyDaysAgo, to: today });
  const { data: receipts, isLoading } = useMyFeedReceipts(farmId, dateRange);

  const activeReceipts = receipts?.filter((r) => r.status === "active") || [];
  const totalKg = activeReceipts.reduce((sum, r) => sum + r.quantity_kg, 0);
  const totalCost = activeReceipts.reduce((sum, r) => sum + r.total_cost, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Feed Received from Hub</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="h-8 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Feed</p>
            <p className="text-lg font-bold">{totalKg.toFixed(1)} kg</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Cost</p>
            <p className="text-lg font-bold">₱{totalCost.toLocaleString()}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !receipts || receipts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No feed receipts for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Feed Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">kg</TableHead>
                  <TableHead className="text-right">₱/kg</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.filter((r) => r.status === "active").map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{format(new Date(r.disbursement_date), "MMM d")}</TableCell>
                    <TableCell>{r.feed_type}</TableCell>
                    <TableCell className="capitalize">{r.category}</TableCell>
                    <TableCell className="text-right">{r.quantity_kg.toFixed(1)}</TableCell>
                    <TableCell className="text-right">₱{r.cost_per_kg.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">₱{r.total_cost.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MyStatements = ({ farmId }: { farmId: string }) => {
  const { data: soas, isLoading } = useMyCoopSOA(farmId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Statements of Account</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !soas || soas.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No statements available yet.</p>
        ) : (
          <div className="space-y-3">
            {soas.map((soa) => (
              <Card key={soa.id} className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(soa.period_start), "MMM d")} — {format(new Date(soa.period_end), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Revision {soa.revision_number}
                        {soa.status === "settled" && " · Settled"}
                      </p>
                    </div>
                    <Badge
                      variant={soa.status === "settled" ? "default" : soa.status === "finalized" ? "secondary" : "outline"}
                    >
                      {soa.status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Milk</p>
                      <p className="text-sm font-medium">₱{soa.total_milk_value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{soa.total_milk_liters.toFixed(1)}L</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Feed</p>
                      <p className="text-sm font-medium">₱{soa.total_feed_cost.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{soa.total_feed_kg.toFixed(1)}kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className={`text-sm font-bold ${soa.net_balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {soa.net_balance >= 0 ? "+" : ""}₱{soa.net_balance.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {soa.net_balance >= 0 ? "Payable to you" : "Collectible"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
