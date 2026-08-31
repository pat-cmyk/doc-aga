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
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Purchased</span>
              <Badge variant="secondary" className="text-xs">{data.purchasedCount}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Grant</span>
              <Badge variant="secondary" className="text-xs">{data.grantCount}</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
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
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${purchasedPercent}%` }}
                />
              )}
              {data.grantCount > 0 && (
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${grantPercent}%` }}
                />
              )}
              {data.bornOnFarmCount > 0 && (
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{ width: `${bornPercent}%` }}
                />
              )}
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-700">Purchased</span>
                </div>
                <p className="text-lg font-bold text-blue-900">{purchasedPercent}%</p>
                {data.averagePurchasePrice > 0 && (
                  <p className="text-xs text-blue-600">
                    Avg: {formatPHP(data.averagePurchasePrice)}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-700">Grant</span>
                </div>
                <p className="text-lg font-bold text-green-900">{grantPercent}%</p>
                <p className="text-xs text-green-600">
                  {data.grantCount} animals
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-amber-700">Born on Farm</span>
                </div>
                <p className="text-lg font-bold text-amber-900">{bornPercent}%</p>
                <p className="text-xs text-amber-600">
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
