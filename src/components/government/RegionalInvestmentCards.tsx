import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Building2, Users, TrendingUp } from "lucide-react";
import { useRegionalInvestment } from "@/hooks/useRegionalInvestment";

interface RegionalInvestmentCardsProps {
  region?: string;
  province?: string;
  municipality?: string;
}

const formatCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `₱${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `₱${(amount / 1000).toFixed(0)}K`;
  }
  return `₱${amount.toLocaleString()}`;
};

export function RegionalInvestmentCards({ region, province, municipality }: RegionalInvestmentCardsProps) {
  const { data, isLoading } = useRegionalInvestment(region, province, municipality);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs">Total Investment</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.totalHerdInvestment)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.animalCount.toLocaleString()} animals
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Building2 className="h-4 w-4" />
            <span className="text-xs">Avg per Farm</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.averageInvestmentPerFarm)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.farmCount.toLocaleString()} farms
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs">Avg per Animal</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.averageInvestmentPerAnimal)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            cost per head
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Avg Purchase Price</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.avgPurchasePrice)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.purchasedAnimalCount.toLocaleString()} purchased
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
