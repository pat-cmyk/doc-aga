import { useState } from "react";
import { FileText, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useFinancialReport } from "@/hooks/useFinancialReport";
import { exportReportToPDF, exportReportToCSV } from "@/lib/financialReportExport";
import { formatCurrency } from "@/lib/financialReportGenerator";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface FinancialCapacityReportProps {
  farmId: string;
  trigger?: React.ReactNode;
}

export function FinancialCapacityReport({ farmId, trigger }: FinancialCapacityReportProps) {
  const [open, setOpen] = useState(false);
  const [periodMonths, setPeriodMonths] = useState<number>(6);
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null);

  const { data: report, isLoading, refetch } = useFinancialReport(farmId, periodMonths);

  const handlePeriodChange = (value: string) => {
    setPeriodMonths(Number(value));
  };

  const handleExportPDF = async () => {
    if (!report) return;
    setExporting("pdf");
    try {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Allow UI to update
      exportReportToPDF(report);
    } finally {
      setExporting(null);
    }
  };

  const handleExportCSV = async () => {
    if (!report) return;
    setExporting("csv");
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      exportReportToCSV(report);
    } finally {
      setExporting(null);
    }
  };

  const getCompletenessColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const getCompletenessBarColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Financial</span> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Farmer Financial Capacity Report
          </DialogTitle>
          <DialogDescription>
            Generate a bank-ready financial report based on your farm data
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Report Period:</span>
            <Select value={String(periodMonths)} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!report || isLoading || exporting !== null}
            >
              {exporting === "csv" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              )}
              CSV
            </Button>
            <Button
              size="sm"
              onClick={handleExportPDF}
              disabled={!report || isLoading || exporting !== null}
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              Download PDF
            </Button>
          </div>
        </div>

        <Separator />

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating report...</p>
            </div>
          ) : report ? (
            <div className="space-y-4 py-4">
              {/* Data Completeness Score */}
              <Card className={cn(
                "border-l-4",
                report.dataCompleteness.completenessScore >= 80 
                  ? "border-l-green-500" 
                  : report.dataCompleteness.completenessScore >= 50 
                  ? "border-l-amber-500"
                  : "border-l-red-500"
              )}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Data Completeness</span>
                    <span className={cn("text-lg font-bold", getCompletenessColor(report.dataCompleteness.completenessScore))}>
                      {report.dataCompleteness.completenessScore.toFixed(0)}%
                    </span>
                  </div>
                  <Progress 
                    value={report.dataCompleteness.completenessScore} 
                    className="h-2"
                  />
                  <div className={cn("h-2 rounded-full -mt-2", getCompletenessBarColor(report.dataCompleteness.completenessScore))} 
                    style={{ width: `${report.dataCompleteness.completenessScore}%` }} 
                  />
                  {report.dataCompleteness.missingItems.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {report.dataCompleteness.missingItems.map((item, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-muted">
                          <AlertCircle className="h-3 w-3 mr-1 text-amber-500" />
                          {item}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Farm Profile Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Farm Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="text-muted-foreground">Farm Name</div>
                    <div className="font-medium">{report.farmProfile.farmName}</div>
                    <div className="text-muted-foreground">Owner</div>
                    <div className="font-medium">{report.farmProfile.ownerName}</div>
                    <div className="text-muted-foreground">Location</div>
                    <div className="font-medium">
                      {[report.farmProfile.municipality, report.farmProfile.province]
                        .filter(Boolean)
                        .join(", ") || "Not specified"}
                    </div>
                    <div className="text-muted-foreground">Livestock</div>
                    <div className="font-medium">{report.farmProfile.livestockType}</div>
                    <div className="text-muted-foreground">Active Animals</div>
                    <div className="font-medium">{report.farmProfile.totalActiveAnimals} head</div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Gross Revenue</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(report.cashFlow.grossRevenue)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Total Costs</div>
                    <div className="text-lg font-bold text-red-600">
                      {formatCurrency(report.cashFlow.operationalCosts)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Net Income</div>
                    <div className={cn(
                      "text-lg font-bold",
                      report.cashFlow.netFarmIncome >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(report.cashFlow.netFarmIncome)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Herd Value</div>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(report.herdSummary.totalValue)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Key Ratios */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Key Financial Ratios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Return on Investment</div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-lg font-bold",
                          report.financialRatios.roi >= 15 ? "text-green-600" : "text-amber-600"
                        )}>
                          {report.financialRatios.roi.toFixed(1)}%
                        </span>
                        {report.financialRatios.roi >= 15 && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">Target: 15-25%</div>
                    </div>
                    
                    {report.financialRatios.breakevenPricePerLiter && (
                      <div>
                        <div className="text-muted-foreground">Breakeven Price</div>
                        <div className="text-lg font-bold">
                          ₱{report.financialRatios.breakevenPricePerLiter.toFixed(2)}/L
                        </div>
                        {report.financialRatios.currentSellingPrice && (
                          <div className="text-xs text-muted-foreground">
                            Selling at ₱{report.financialRatios.currentSellingPrice.toFixed(2)}/L
                          </div>
                        )}
                      </div>
                    )}

                    {report.financialRatios.priceMargin && (
                      <div>
                        <div className="text-muted-foreground">Price Margin</div>
                        <div className={cn(
                          "text-lg font-bold",
                          report.financialRatios.priceMargin > 20 ? "text-green-600" : "text-amber-600"
                        )}>
                          {report.financialRatios.priceMargin.toFixed(1)}%
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-muted-foreground">Mortality Rate</div>
                      <div className={cn(
                        "text-lg font-bold",
                        report.productionMetrics.mortalityRate < 3 ? "text-green-600" : "text-red-600"
                      )}>
                        {report.productionMetrics.mortalityRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Target: &lt;3%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Checklist Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Evidence Checklist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <CheckItem checked={report.dataCompleteness.hasGeoLocation} label="GPS Location" />
                    <CheckItem checked={report.dataCompleteness.hasAnimalInventory} label="Animal Inventory" />
                    <CheckItem checked={report.dataCompleteness.hasWeightRecords} label="Weight Records" />
                    <CheckItem checked={report.dataCompleteness.hasProductionRecords} label="Production Data" />
                    <CheckItem checked={report.dataCompleteness.hasExpenseTracking} label="Expense Records" />
                    <CheckItem checked={report.dataCompleteness.hasRevenueDocumentation} label="Revenue Records" />
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                Report period: {format(new Date(report.periodStart), "MMM d, yyyy")} - {format(new Date(report.periodEnd), "MMM d, yyyy")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Unable to generate report</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CheckItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      )}
      <span className={checked ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
