import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useGrantEffectiveness, AcquisitionMetrics } from "@/hooks/useGrantEffectiveness";
import { TrendingUp, TrendingDown, Minus, Heart, Milk, Activity, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface GrantEffectivenessPanelProps {
  region?: string;
  province?: string;
  municipality?: string;
}

const MetricComparison = ({ 
  label, 
  grantValue, 
  purchasedValue,
  lowerIsBetter = false,
  unit = "",
  icon: Icon,
}: { 
  label: string; 
  grantValue: number; 
  purchasedValue: number;
  lowerIsBetter?: boolean;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
}) => {
  const diff = grantValue - purchasedValue;
  const percentDiff = purchasedValue !== 0 ? ((diff / purchasedValue) * 100) : 0;
  
  let grantWins: boolean;
  if (lowerIsBetter) {
    grantWins = grantValue < purchasedValue;
  } else {
    grantWins = grantValue > purchasedValue;
  }
  
  const isEqual = Math.abs(diff) < 0.1;

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className={cn(
          "text-sm font-mono",
          !isEqual && grantWins && "text-green-600 font-semibold",
          !isEqual && !grantWins && "text-muted-foreground"
        )}>
          {grantValue.toFixed(1)}{unit}
        </div>
        <div className="w-6 flex justify-center">
          {isEqual ? (
            <Minus className="h-4 w-4 text-muted-foreground" />
          ) : grantWins ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </div>
        <div className={cn(
          "text-sm font-mono",
          !isEqual && !grantWins && "text-green-600 font-semibold",
          !isEqual && grantWins && "text-muted-foreground"
        )}>
          {purchasedValue.toFixed(1)}{unit}
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ 
  title, 
  metrics, 
  color 
}: { 
  title: string; 
  metrics: AcquisitionMetrics;
  color: string;
}) => (
  <Card className={cn("border-l-4", color)}>
    <CardHeader className="pb-2">
      <CardTitle className="text-base">{title}</CardTitle>
      <p className="text-2xl font-bold">{metrics.count} animals</p>
    </CardHeader>
    <CardContent className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Health Events/Animal</span>
        <span className="font-mono">{metrics.avgHealthEvents}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Milk L/Animal</span>
        <span className="font-mono">{metrics.avgMilkProduction}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Mortality Rate</span>
        <span className="font-mono">{metrics.mortalityRate}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Breeding Success</span>
        <span className="font-mono">{metrics.breedingSuccessRate}%</span>
      </div>
    </CardContent>
  </Card>
);

export const GrantEffectivenessPanel = ({
  region,
  province,
  municipality,
}: GrantEffectivenessPanelProps) => {
  const { data, isLoading, error } = useGrantEffectiveness(region, province, municipality);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Grant Program Effectiveness</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load effectiveness data</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Grant Program Effectiveness</CardTitle>
          <CardDescription>Comparing outcomes: Grant vs Purchased animals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const grant = data?.grantAnimals;
  const purchased = data?.purchasedAnimals;

  if (!grant || !purchased) {
    return null;
  }

  const totalAnimals = grant.count + purchased.count + (data?.bornOnFarmAnimals?.count || 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Grant Program Effectiveness
            </CardTitle>
            <CardDescription>
              Comparing health, productivity, and breeding outcomes
            </CardDescription>
          </div>
          <Badge variant="secondary">{totalAnimals} total animals</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <MetricCard 
            title="Grant Recipients" 
            metrics={grant} 
            color="border-l-green-500"
          />
          <MetricCard 
            title="Purchased" 
            metrics={purchased} 
            color="border-l-blue-500"
          />
          <MetricCard 
            title="Born on Farm" 
            metrics={data.bornOnFarmAnimals} 
            color="border-l-amber-500"
          />
        </div>

        {/* Head-to-Head Comparison */}
        {grant.count > 0 && purchased.count > 0 && (
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Grant vs Purchased: Head-to-Head</CardTitle>
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Grant ({grant.count})</span>
                <span>Purchased ({purchased.count})</span>
              </div>
            </CardHeader>
            <CardContent>
              <MetricComparison
                label="Health Events/Animal"
                grantValue={grant.avgHealthEvents}
                purchasedValue={purchased.avgHealthEvents}
                lowerIsBetter={true}
                icon={Heart}
              />
              <MetricComparison
                label="Milk Production (L)"
                grantValue={grant.avgMilkProduction}
                purchasedValue={purchased.avgMilkProduction}
                unit="L"
                icon={Milk}
              />
              <MetricComparison
                label="Mortality Rate"
                grantValue={grant.mortalityRate}
                purchasedValue={purchased.mortalityRate}
                lowerIsBetter={true}
                unit="%"
                icon={Activity}
              />
              <MetricComparison
                label="Breeding Success"
                grantValue={grant.breedingSuccessRate}
                purchasedValue={purchased.breedingSuccessRate}
                unit="%"
                icon={Target}
              />
            </CardContent>
          </Card>
        )}

        {/* By Grant Source */}
        {data.byGrantSource.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Performance by Grant Source</h4>
            <div className="space-y-2">
              {data.byGrantSource.slice(0, 5).map((source) => (
                <div 
                  key={source.source} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{source.count}</Badge>
                    <span className="font-medium">{source.source}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Mortality: {source.mortalityRate}%</span>
                    <span>Milk: {source.avgMilkProduction}L</span>
                    <span>Breeding: {source.breedingSuccessRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
