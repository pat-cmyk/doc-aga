import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Receipt, Stethoscope, Syringe, Heart, Package } from "lucide-react";

interface AnimalCostSummaryProps {
  purchasePrice: number | null;
  grantSource: string | null;
  acquisitionType: string | null;
  categoryBreakdown: Record<string, number>;
  totalExpenses: number;
  feedConsumptionCost: number;
  manualExpenses: number;
  isLoading?: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  "Veterinary Services": <Stethoscope className="h-4 w-4" />,
  "Medicine & Vaccines": <Syringe className="h-4 w-4" />,
  "Breeding Services": <Heart className="h-4 w-4" />,
  "Feed & Supplements": <Package className="h-4 w-4" />,
  Other: <Receipt className="h-4 w-4" />,
};

export function AnimalCostSummary({
  purchasePrice,
  grantSource,
  acquisitionType,
  categoryBreakdown,
  totalExpenses,
  feedConsumptionCost,
  manualExpenses,
  isLoading,
}: AnimalCostSummaryProps) {
  const acquisitionCost = purchasePrice || 0;
  const totalInvestment = acquisitionCost + totalExpenses;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAcquisitionLabel = () => {
    if (acquisitionType === "grant") {
      return `Grant from ${grantSource || "Unknown"}`;
    }
    if (acquisitionType === "purchased" && purchasePrice) {
      return formatCurrency(purchasePrice);
    }
    if (purchasePrice) {
      return formatCurrency(purchasePrice);
    }
    return "Not recorded";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Total Cost of Ownership
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Investment Highlight */}
        <div className="bg-primary/10 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Investment</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(totalInvestment)}
          </p>
        </div>

        {/* Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Acquisition Cost</span>
            <span className="font-medium">{getAcquisitionLabel()}</span>
          </div>

          {Object.entries(categoryBreakdown).map(([category, amount]) => (
            <div key={category} className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground flex items-center gap-2">
                {categoryIcons[category] || <Receipt className="h-4 w-4" />}
                {category}
              </span>
              <span className="font-medium">{formatCurrency(amount)}</span>
            </div>
          ))}

          {feedConsumptionCost > 0 && (
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Feed Consumption
              </span>
              <span className="font-medium">{formatCurrency(feedConsumptionCost)}</span>
            </div>
          )}

          {Object.keys(categoryBreakdown).length === 0 && feedConsumptionCost === 0 && (
            <div className="text-center py-2 text-muted-foreground">
              No expenses recorded yet
            </div>
          )}

          <div className="flex justify-between pt-2 font-semibold">
            <span>Recorded Expenses</span>
            <span>{formatCurrency(totalExpenses)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
