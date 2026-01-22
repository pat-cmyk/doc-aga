import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Milk, Heart, Calendar, Wallet, ChevronRight, Wheat } from "lucide-react";
import type { DashboardStats as StatsType, DashboardStatsTrends } from "./hooks/useDashboardStats";
import { TrendIndicator } from "./TrendIndicator";
import { useHerdInvestment } from "@/hooks/useHerdInvestment";
import { HerdInvestmentSheet } from "./HerdInvestmentSheet";
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
  stats: StatsType;
  trends?: DashboardStatsTrends | null;
  farmId?: string;
}

const formatCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `₱${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `₱${(amount / 1000).toFixed(0)}K`;
  }
  return `₱${amount.toLocaleString()}`;
};

/**
 * Dashboard statistics cards showing key farm metrics with trend indicators
 */
export const DashboardStats = ({ stats, trends, farmId }: DashboardStatsProps) => {
  const { data: investmentData } = useHerdInvestment(farmId || "");
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card className="min-h-[100px] sm:min-h-[120px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Animals</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAnimals}</div>
            {trends && (
              <TrendIndicator
                current={stats.totalAnimals}
                previous={trends.prevTotalAnimals}
                positiveIsGood={true}
                className="mt-1"
              />
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[100px] sm:min-h-[120px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feed Stock</CardTitle>
            <Wheat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.feedStockDays !== null ? `${stats.feedStockDays}d` : "—"}
            </div>
            <p className={cn(
              "text-xs mt-1",
              stats.feedStockDays !== null && stats.feedStockDays <= 30 
                ? "text-destructive" 
                : stats.feedStockDays !== null && stats.feedStockDays <= 60 
                  ? "text-yellow-600" 
                  : "text-muted-foreground"
            )}>
              {stats.feedStockDays !== null 
                ? stats.feedStockDays <= 30 
                  ? "critically low" 
                  : stats.feedStockDays <= 60 
                    ? "reorder soon"
                    : "days remaining"
                : "no inventory"
              }
            </p>
          </CardContent>
        </Card>
        
        <Card className="min-h-[100px] sm:min-h-[120px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Daily Milk</CardTitle>
            <Milk className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDailyMilk.toFixed(1)}L</div>
            {trends && (
              <TrendIndicator
                current={stats.avgDailyMilk}
                previous={trends.prevAvgDailyMilk}
                positiveIsGood={true}
                className="mt-1"
              />
            )}
          </CardContent>
        </Card>
        
        <Card className="min-h-[100px] sm:min-h-[120px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pregnant</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pregnantCount}</div>
            {stats.pendingConfirmation > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                +{stats.pendingConfirmation} pending confirmation
              </p>
            )}
            {trends && !stats.pendingConfirmation && (
              <TrendIndicator
                current={stats.pregnantCount}
                previous={trends.prevPregnantCount}
                positiveIsGood={true}
                className="mt-1"
              />
            )}
          </CardContent>
        </Card>
        
        <Card className="min-h-[100px] sm:min-h-[120px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentHealthEvents}</div>
            {trends && (
              <TrendIndicator
                current={stats.recentHealthEvents}
                previous={trends.prevHealthEvents}
                positiveIsGood={false}
                className="mt-1"
              />
            )}
          </CardContent>
        </Card>

        {/* Clickable Herd Investment Card */}
        <Card 
          className="min-h-[100px] sm:min-h-[120px] cursor-pointer transition-colors hover:bg-accent/50"
          onClick={() => farmId && setSheetOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Herd Investment</CardTitle>
            <div className="flex items-center gap-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {investmentData ? formatCurrency(investmentData.totalInvestment) : "—"}
            </div>
            {investmentData && investmentData.purchasedCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {investmentData.purchasedCount} purchased, {investmentData.grantCount} grant
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {farmId && (
        <HerdInvestmentSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          farmId={farmId}
        />
      )}
    </>
  );
};
