import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRegionalMarketPrices } from "@/hooks/useRegionalMarketPrices";
import { TrendingUp, TrendingDown, Minus, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketPriceAnalyticsCardProps {
  startDate: Date;
  endDate: Date;
  region?: string;
}

export const MarketPriceAnalyticsCard = ({
  startDate,
  endDate,
  region,
}: MarketPriceAnalyticsCardProps) => {
  const { data, isLoading, error } = useRegionalMarketPrices(startDate, endDate, region);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load market price data.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.overallTrends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Market Price Intelligence</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No market price data available for the selected period.</p>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = ({ trend }: { trend: "rising" | "falling" | "stable" }) => {
    if (trend === "rising") return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === "falling") return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = (trend: "rising" | "falling" | "stable") => {
    if (trend === "rising") return "text-green-600 bg-green-500/10 border-green-500/20";
    if (trend === "falling") return "text-red-600 bg-red-500/10 border-red-500/20";
    return "text-muted-foreground bg-muted";
  };

  // Sort by livestock type for consistent display
  const sortedTrends = [...data.overallTrends].sort((a, b) => 
    a.livestock_type.localeCompare(b.livestock_type)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <CardTitle>Market Price Intelligence</CardTitle>
        </div>
        <CardDescription>
          Farmer-reported prices and market trends by species
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Price Trend Cards */}
        <div className="grid gap-3">
          {sortedTrends.map((item) => (
            <div
              key={item.livestock_type}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold">{item.livestock_type}</div>
                <Badge
                  variant="outline"
                  className={cn("gap-1", getTrendColor(item.trend))}
                >
                  <TrendIcon trend={item.trend} />
                  <span className="capitalize">{item.trend}</span>
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">₱{item.avg_price.toFixed(2)}/kg</div>
                <div className="text-xs text-muted-foreground">
                  {item.sample_count} reports
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Regional Details */}
        {Object.keys(data.bySpecies).length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-sm font-medium">Price Details by Region</h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {Object.entries(data.bySpecies).flatMap(([type, items]) =>
                items.map((item, idx) => (
                  <div
                    key={`${type}-${item.region}-${idx}`}
                    className="flex items-center justify-between p-2 rounded border text-sm"
                  >
                    <div>
                      <span className="font-medium">{type}</span>
                      <span className="text-muted-foreground"> · {item.region}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        ₱{item.min_price.toFixed(0)} - ₱{item.max_price.toFixed(0)}
                      </span>
                      <span className="font-medium">₱{item.latest_price.toFixed(2)}</span>
                      <TrendIcon trend={item.price_trend} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
