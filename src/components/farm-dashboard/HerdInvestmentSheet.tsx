import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHerdInvestment } from "@/hooks/useHerdInvestment";
import { ShoppingCart, Gift, Home } from "lucide-react";

interface HerdInvestmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
}

const formatCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `₱${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `₱${(amount / 1000).toFixed(0)}K`;
  }
  return `₱${amount.toLocaleString()}`;
};

export const HerdInvestmentSheet = ({ open, onOpenChange, farmId }: HerdInvestmentSheetProps) => {
  const { data: investmentData, isLoading } = useHerdInvestment(farmId);

  if (isLoading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Herd Investment Details</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-8 w-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!investmentData) {
    return null;
  }

  const totalAnimals = investmentData.purchasedCount + investmentData.grantCount + investmentData.bornOnFarmCount;
  const purchasedPercent = totalAnimals > 0 ? (investmentData.purchasedCount / totalAnimals) * 100 : 0;
  const grantPercent = totalAnimals > 0 ? (investmentData.grantCount / totalAnimals) * 100 : 0;
  const bornPercent = totalAnimals > 0 ? (investmentData.bornOnFarmCount / totalAnimals) * 100 : 0;

  const sources = [
    {
      label: "Purchased",
      count: investmentData.purchasedCount,
      percent: purchasedPercent,
      icon: ShoppingCart,
      color: "bg-primary",
      textColor: "text-primary",
      avgPrice: investmentData.averagePurchasePrice,
    },
    {
      label: "Grant",
      count: investmentData.grantCount,
      percent: grantPercent,
      icon: Gift,
      color: "bg-emerald-500",
      textColor: "text-emerald-600",
      avgPrice: null,
    },
    {
      label: "Born on Farm",
      count: investmentData.bornOnFarmCount,
      percent: bornPercent,
      icon: Home,
      color: "bg-amber-500",
      textColor: "text-amber-600",
      avgPrice: null,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Herd Investment Details</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Total Investment */}
          <div className="text-center py-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Investment</p>
            <p className="text-3xl font-bold">{formatCurrency(investmentData.totalInvestment)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAnimals} animal{totalAnimals !== 1 ? "s" : ""} in herd
            </p>
          </div>

          {/* Distribution Bar */}
          {totalAnimals > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Acquisition Distribution</p>
              <div className="h-4 rounded-full overflow-hidden flex bg-muted">
                {purchasedPercent > 0 && (
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${purchasedPercent}%` }}
                  />
                )}
                {grantPercent > 0 && (
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${grantPercent}%` }}
                  />
                )}
                {bornPercent > 0 && (
                  <div
                    className="bg-amber-500 h-full transition-all"
                    style={{ width: `${bornPercent}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                {sources.map((source) => (
                  source.count > 0 && (
                    <span key={source.label} className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${source.color}`} />
                      {source.label} ({source.percent.toFixed(0)}%)
                    </span>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Source Cards */}
          <div className="grid grid-cols-3 gap-3">
            {sources.map((source) => {
              const Icon = source.icon;
              return (
                <Card key={source.label} className="text-center">
                  <CardContent className="pt-4 pb-3 px-2">
                    <Icon className={`h-5 w-5 mx-auto mb-2 ${source.textColor}`} />
                    <p className="text-xs text-muted-foreground">{source.label}</p>
                    <p className="text-xl font-bold">{source.count}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.percent.toFixed(0)}%
                    </p>
                    {source.avgPrice !== null && source.avgPrice > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Avg: {formatCurrency(source.avgPrice)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Cost Breakdown */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Purchase Costs</span>
              <span className="font-medium">{formatCurrency(investmentData.totalPurchasePrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Animal Expenses</span>
              <span className="font-medium">{formatCurrency(investmentData.totalAnimalExpenses)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium pt-2 border-t">
              <span>Total Investment</span>
              <span>{formatCurrency(investmentData.totalInvestment)}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
