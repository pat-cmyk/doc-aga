import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Building2, Users, TrendingUp } from "lucide-react";
import { useRegionalInvestment } from "@/hooks/useRegionalInvestment";
import { formatPHP, formatNumber } from "@/lib/currency";
import { DataCategory } from "@/types/government";

interface RegionalInvestmentCardsProps {
  region?: string;
  province?: string;
  municipality?: string;
  dataCategory?: DataCategory;
}

export function RegionalInvestmentCards({ region, province, municipality, dataCategory = 'live' }: RegionalInvestmentCardsProps) {
  const { data, isLoading } = useRegionalInvestment(region, province, municipality, dataCategory);

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
          <p className="text-xl font-bold">{formatPHP(data.totalHerdInvestment)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(data.animalCount)} animals
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Building2 className="h-4 w-4" />
            <span className="text-xs">Avg per Farm</span>
          </div>
          <p className="text-xl font-bold">{formatPHP(data.averageInvestmentPerFarm)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(data.farmCount)} farms
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs">Avg per Animal</span>
          </div>
          <p className="text-xl font-bold">{formatPHP(data.averageInvestmentPerAnimal)}</p>
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
          <p className="text-xl font-bold">{formatPHP(data.avgPurchasePrice)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.purchasedAnimalCount.toLocaleString()} purchased
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
