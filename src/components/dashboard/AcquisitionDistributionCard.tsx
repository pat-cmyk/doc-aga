import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Gift, ShoppingCart, Home } from "lucide-react";
import { useHerdInvestment } from "@/hooks/useHerdInvestment";
import { formatPHP } from "@/lib/currency";

interface AcquisitionDistributionCardProps {
  farmId: string;
}

export function AcquisitionDistributionCard({ farmId }: AcquisitionDistributionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading } = useHerdInvestment(farmId);

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const total = data.purchasedCount + data.grantCount + data.bornOnFarmCount;
  if (total === 0) return null;

  const purchasedPercent = total > 0 ? ((data.purchasedCount / total) * 100).toFixed(0) : 0;
  const grantPercent = total > 0 ? ((data.grantCount / total) * 100).toFixed(0) : 0;
  const bornPercent = total > 0 ? ((data.bornOnFarmCount / total) * 100).toFixed(0) : 0;

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="text-base">Herd Acquisition Sources</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        {/* Always visible summary */}
        <CardContent className="pt-0 pb-3">
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-info" />
              <span className="text-muted-foreground">Purchased</span>
              <Badge variant="secondary" className="text-xs">{data.purchasedCount}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-muted-foreground">Grant</span>
              <Badge variant="secondary" className="text-xs">{data.grantCount}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <span className="text-muted-foreground">Born</span>
              <Badge variant="secondary" className="text-xs">{data.bornOnFarmCount}</Badge>
            </div>
          </div>
        </CardContent>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Distribution Bar */}
            <div className="h-3 rounded-full overflow-hidden flex bg-muted">
              {data.purchasedCount > 0 && (
                <div
                  className="bg-info h-full transition-all"
                  style={{ width: `${purchasedPercent}%` }}
                />
              )}
              {data.grantCount > 0 && (
                <div
                  className="bg-success h-full transition-all"
                  style={{ width: `${grantPercent}%` }}
                />
              )}
              {data.bornOnFarmCount > 0 && (
                <div
                  className="bg-warning h-full transition-all"
                  style={{ width: `${bornPercent}%` }}
                />
              )}
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-info-soft/60 border border-info/20">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="h-4 w-4 text-info" />
                  <span className="text-xs text-info">Purchased</span>
                </div>
                <p className="text-lg font-bold text-info-soft-foreground">{purchasedPercent}%</p>
                {data.averagePurchasePrice > 0 && (
                  <p className="text-xs text-info">
                    Avg: {formatPHP(data.averagePurchasePrice)}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-success-soft/60 border border-success/20">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-4 w-4 text-success" />
                  <span className="text-xs text-success">Grant</span>
                </div>
                <p className="text-lg font-bold text-success-soft-foreground">{grantPercent}%</p>
                <p className="text-xs text-success">
                  {data.grantCount} animals
                </p>
              </div>

              <div className="p-3 rounded-lg bg-warning-soft/60 border border-warning/30">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="h-4 w-4 text-warning" />
                  <span className="text-xs text-warning">Born on Farm</span>
                </div>
                <p className="text-lg font-bold text-warning-soft-foreground">{bornPercent}%</p>
                <p className="text-xs text-warning">
                  {data.bornOnFarmCount} animals
                </p>
              </div>
            </div>

            {/* Total Investment */}
            <div className="p-3 rounded-lg bg-muted/50 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Herd Investment</span>
              <span className="font-bold">{formatPHP(data.totalInvestment)}</span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
