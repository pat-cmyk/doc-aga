import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Gift, ShoppingCart, Home } from "lucide-react";
import { useHerdInvestment } from "@/hooks/useHerdInvestment";

interface AcquisitionDistributionCardProps {
  farmId: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

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
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-700 dark:text-blue-300">Purchased</span>
                </div>
                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{purchasedPercent}%</p>
                {data.averagePurchasePrice > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Avg: {formatCurrency(data.averagePurchasePrice)}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs text-green-700 dark:text-green-300">Grant</span>
                </div>
                <p className="text-lg font-bold text-green-900 dark:text-green-100">{grantPercent}%</p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {data.grantCount} animals
                </p>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-amber-700 dark:text-amber-300">Born on Farm</span>
                </div>
                <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{bornPercent}%</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {data.bornOnFarmCount} animals
                </p>
              </div>
            </div>

            {/* Total Investment */}
            <div className="p-3 rounded-lg bg-muted/50 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Herd Investment</span>
              <span className="font-bold">{formatCurrency(data.totalInvestment)}</span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
