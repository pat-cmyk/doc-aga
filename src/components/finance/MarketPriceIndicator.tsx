import { useCurrentMarketPrice, getSourceLabel } from "@/hooks/useMarketPrices";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface MarketPriceIndicatorProps {
  farmId: string;
  livestockType: string;
  showDetails?: boolean;
  previousPrice?: number;
}

const SOURCE_COLORS: Record<string, string> = {
  farmer_sale: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  farmer_input: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  regional_aggregate: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  da_bulletin: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  system_default: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
};

export function MarketPriceIndicator({
  farmId,
  livestockType,
  showDetails = true,
  previousPrice,
}: MarketPriceIndicatorProps) {
  const { data: priceData, isLoading } = useCurrentMarketPrice(farmId, livestockType);

  if (isLoading) {
    return <Skeleton className="h-6 w-24" />;
  }

  if (!priceData) {
    return null;
  }

  const priceChange = previousPrice ? priceData.price - previousPrice : 0;
  const priceChangePercent = previousPrice ? (priceChange / previousPrice) * 100 : 0;

  const TrendIcon = priceChange > 0 ? TrendingUp : priceChange < 0 ? TrendingDown : Minus;
  const trendColor = priceChange > 0 ? "text-green-600" : priceChange < 0 ? "text-red-600" : "text-muted-foreground";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-2">
            <span className="font-semibold text-lg">
              ₱{priceData.price.toFixed(0)}/kg
            </span>
            
            {previousPrice && priceChange !== 0 && (
              <span className={`inline-flex items-center gap-0.5 text-xs ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {Math.abs(priceChangePercent).toFixed(1)}%
              </span>
            )}

            {showDetails && (
              <Badge 
                variant="secondary" 
                className={`text-xs ${SOURCE_COLORS[priceData.source] || ""}`}
              >
                {getSourceLabel(priceData.source)}
              </Badge>
            )}

            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1 text-sm">
            <p className="font-medium">Price Source: {getSourceLabel(priceData.source)}</p>
            <p className="text-muted-foreground">
              As of {format(new Date(priceData.effective_date), "MMMM d, yyyy")}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {priceData.source === "farmer_sale" && "Based on your most recent animal sale"}
              {priceData.source === "farmer_input" && "Based on your reported local market price"}
              {priceData.source === "regional_aggregate" && "Average of sales in your province"}
              {priceData.source === "da_bulletin" && "From Department of Agriculture price bulletin"}
              {priceData.source === "system_default" && "Default estimate - update with local prices for accuracy"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
