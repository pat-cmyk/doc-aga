import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useVeterinaryExpenseHeatmap } from "@/hooks/useVeterinaryExpenseHeatmap";
import { Stethoscope, Pill, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPHP } from "@/lib/currency";
import { DataCategory } from "@/types/government";
import { PriorityLegend } from "@/components/government/PriorityLegend";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VeterinaryExpenseHeatmapProps {
  region?: string;
  province?: string;
  municipality?: string;
  dataCategory?: DataCategory;
}

const getSeverityColor = (costPerAnimal: number, avgCostPerAnimal: number) => {
  if (avgCostPerAnimal === 0) return "bg-muted";
  
  const ratio = costPerAnimal / avgCostPerAnimal;
  
  if (ratio >= 2) return "bg-red-500";
  if (ratio >= 1.5) return "bg-orange-500";
  if (ratio >= 1) return "bg-yellow-500";
  return "bg-green-500";
};

const getSeverityLabel = (costPerAnimal: number, avgCostPerAnimal: number) => {
  if (avgCostPerAnimal === 0) return "No data";
  
  const ratio = costPerAnimal / avgCostPerAnimal;
  
  if (ratio >= 2) return "Critical";
  if (ratio >= 1.5) return "High";
  if (ratio >= 1) return "Moderate";
  return "Low";
};

export const VeterinaryExpenseHeatmap = ({
  region,
  province,
  municipality,
  dataCategory = 'live',
}: VeterinaryExpenseHeatmapProps) => {
  const { data, isLoading, error } = useVeterinaryExpenseHeatmap(region, province, municipality, dataCategory);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Veterinary Expense Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load expense data</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Veterinary Expense Analysis</CardTitle>
          <CardDescription>Regional health cost hotspots</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.byLocation.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Veterinary Expense Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No veterinary expense data available for this region</p>
        </CardContent>
      </Card>
    );
  }

  const highCostAreas = data.byLocation.filter(
    loc => loc.costPerAnimal > data.avgCostPerAnimal * 1.5
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Veterinary Expense Analysis
            </CardTitle>
            <CardDescription>
              Identify regions with high veterinary and medicine costs
            </CardDescription>
          </div>
          {highCostAreas.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {highCostAreas.length} hotspot{highCostAreas.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Stethoscope className="h-4 w-4" />
                <span className="text-xs">Veterinary Services</span>
              </div>
              <p className="text-xl font-bold">{formatPHP(data.totalVetExpenses)}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Pill className="h-4 w-4" />
                <span className="text-xs">Medicine & Vaccines</span>
              </div>
              <p className="text-xl font-bold">{formatPHP(data.totalMedicineExpenses)}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Avg Cost/Animal</span>
              </div>
              <p className="text-xl font-bold">{formatPHP(data.avgCostPerAnimal)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Severity Legend with Tooltips */}
        <PriorityLegend type="veterinary_cost" />

        {/* Heatmap Table */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Municipality</TableHead>
                <TableHead>Province</TableHead>
                <TableHead className="text-right">Total Expenses</TableHead>
                <TableHead className="text-right">Animals</TableHead>
                <TableHead className="text-right">Cost/Animal</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byLocation.slice(0, 10).map((location, index) => {
                const severity = getSeverityLabel(location.costPerAnimal, data.avgCostPerAnimal);
                const severityColor = getSeverityColor(location.costPerAnimal, data.avgCostPerAnimal);
                
                return (
                  <TableRow key={`${location.municipality}-${index}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", severityColor)} />
                        {location.municipality}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.province}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPHP(location.combinedTotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {location.animalCount}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPHP(location.costPerAnimal)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={severity === "Critical" || severity === "High" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {severity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {data.byLocation.length > 10 && (
          <p className="text-xs text-muted-foreground text-center">
            Showing top 10 of {data.byLocation.length} locations
          </p>
        )}
      </CardContent>
    </Card>
  );
};
