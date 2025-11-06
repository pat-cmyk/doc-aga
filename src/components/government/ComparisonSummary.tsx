import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { GovStatsWithGrowth } from "@/hooks/useGovernmentStats";

interface ComparisonSummaryProps {
  primaryStats?: GovStatsWithGrowth;
  comparisonStats?: GovStatsWithGrowth;
  primaryDateRange?: DateRange;
  comparisonDateRange?: DateRange;
  primaryRegion?: string;
  comparisonRegion?: string;
  isLoading: boolean;
  comparisonMode: boolean;
}

interface MetricChange {
  absolute: number;
  percentage: number;
}

const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

const calculateChange = (primary: number, comparison: number): MetricChange => {
  const absolute = primary - comparison;
  const percentage = comparison === 0 ? 0 : (absolute / comparison) * 100;
  
  return {
    absolute,
    percentage
  };
};

const ChangeIndicator = ({ change }: { change: MetricChange }) => {
  if (change.absolute === 0) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Minus className="h-4 w-4" />
        0%
      </span>
    );
  }
  
  const isPositive = change.absolute > 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  const colorClass = isPositive ? "text-green-600" : "text-red-600";
  
  return (
    <span className={`flex items-center gap-1 ${colorClass}`}>
      {isPositive ? '+' : ''}{formatNumber(change.absolute)} ({isPositive ? '+' : ''}{change.percentage.toFixed(1)}%)
      <Icon className="h-4 w-4" />
    </span>
  );
};

export const ComparisonSummary = ({
  primaryStats,
  comparisonStats,
  primaryDateRange,
  comparisonDateRange,
  primaryRegion,
  comparisonRegion,
  isLoading,
  comparisonMode
}: ComparisonSummaryProps) => {
  // Don't render if comparison mode is off
  if (!comparisonMode) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparison Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!primaryStats || !comparisonStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparison Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No data available for comparison
          </p>
        </CardContent>
      </Card>
    );
  }

  // Format date ranges
  const primaryDateText = primaryDateRange?.from && primaryDateRange?.to
    ? `${format(primaryDateRange.from, "MMM dd, yyyy")} - ${format(primaryDateRange.to, "MMM dd, yyyy")}`
    : "No date selected";
    
  const comparisonDateText = comparisonDateRange?.from && comparisonDateRange?.to
    ? `${format(comparisonDateRange.from, "MMM dd, yyyy")} - ${format(comparisonDateRange.to, "MMM dd, yyyy")}`
    : "No date selected";

  // Calculate changes
  const farmsChange = calculateChange(primaryStats.farm_count, comparisonStats.farm_count);
  const animalsChange = calculateChange(primaryStats.active_animal_count, comparisonStats.active_animal_count);
  const logsChange = calculateChange(primaryStats.daily_log_count, comparisonStats.daily_log_count);
  const healthChange = calculateChange(primaryStats.health_event_count, comparisonStats.health_event_count);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparison Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metadata Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary Dataset */}
          <div className="border rounded-lg p-4 space-y-2 bg-blue-50/50 dark:bg-blue-950/20">
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300">
              PRIMARY DATASET
            </Badge>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {primaryRegion || "All Regions"}
              </p>
              <p className="text-xs text-muted-foreground">
                {primaryDateText}
              </p>
            </div>
          </div>

          {/* Comparison Dataset */}
          <div className="border rounded-lg p-4 space-y-2 bg-orange-50/50 dark:bg-orange-950/20">
            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-300">
              COMPARISON DATASET
            </Badge>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {comparisonRegion || "All Regions"}
              </p>
              <p className="text-xs text-muted-foreground">
                {comparisonDateText}
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Comparison Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Metric</TableHead>
                <TableHead className="font-semibold text-right">Primary</TableHead>
                <TableHead className="font-semibold text-right">Comparison</TableHead>
                <TableHead className="font-semibold text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Active Farms</TableCell>
                <TableCell className="text-right">{formatNumber(primaryStats.farm_count)}</TableCell>
                <TableCell className="text-right">{formatNumber(comparisonStats.farm_count)}</TableCell>
                <TableCell className="text-right">
                  <ChangeIndicator change={farmsChange} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Active Animals</TableCell>
                <TableCell className="text-right">{formatNumber(primaryStats.active_animal_count)}</TableCell>
                <TableCell className="text-right">{formatNumber(comparisonStats.active_animal_count)}</TableCell>
                <TableCell className="text-right">
                  <ChangeIndicator change={animalsChange} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Daily Logs</TableCell>
                <TableCell className="text-right">{formatNumber(primaryStats.daily_log_count)}</TableCell>
                <TableCell className="text-right">{formatNumber(comparisonStats.daily_log_count)}</TableCell>
                <TableCell className="text-right">
                  <ChangeIndicator change={logsChange} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Health Events</TableCell>
                <TableCell className="text-right">{formatNumber(primaryStats.health_event_count)}</TableCell>
                <TableCell className="text-right">{formatNumber(comparisonStats.health_event_count)}</TableCell>
                <TableCell className="text-right">
                  <ChangeIndicator change={healthChange} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
