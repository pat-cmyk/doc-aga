import { useIntegrityScan } from "@/hooks/useIntegrityScan";
import { IntegrityFarmRow } from "./IntegrityFarmRow";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Clock,
  Loader2,
  Database
} from "lucide-react";

export function DataIntegrityDashboard() {
  const {
    results,
    isScanning,
    progress,
    lastScanTime,
    stats,
    autoRefreshInterval,
    setAutoRefreshInterval,
    scanAllFarms,
    scanSingleFarm,
    fixWeightSync,
    fixMilkRevenue,
    fixValuations,
    recalculateStats,
    fixAllForFarm
  } = useIntegrityScan();

  const sortedResults = [...results].sort((a, b) => {
    // Critical first, then warning, then healthy
    const statusOrder = { critical: 0, warning: 1, healthy: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Farms</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFarms}</div>
            <p className="text-xs text-muted-foreground">Scanned in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Farms with Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.farmsWithIssues}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({stats.issuePercentage}%)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.criticalFarms}</div>
            <p className="text-xs text-muted-foreground">3+ failed checks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy Farms</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.healthyFarms}</div>
            <p className="text-xs text-muted-foreground">All checks passed</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Data Integrity Scanner
              </CardTitle>
              <CardDescription>
                Run integrity checks across all farms to identify and fix data issues
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Auto-refresh:</span>
                <Select 
                  value={autoRefreshInterval?.toString() || "0"} 
                  onValueChange={(v) => setAutoRefreshInterval(v === "0" ? null : parseInt(v))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Off</SelectItem>
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={scanAllFarms} 
                disabled={isScanning}
                className="gap-2"
              >
                {isScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isScanning ? 'Scanning...' : 'Scan All Farms'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Progress Bar */}
        {isScanning && progress.total > 0 && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Scanning: {progress.currentFarm || '...'}
                </span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} />
            </div>
          </CardContent>
        )}

        {/* Last Scan Time */}
        {lastScanTime && !isScanning && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last scan: {lastScanTime.toLocaleString()}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Results Table */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Farm Integrity Results</CardTitle>
            <CardDescription>
              Click on a row to expand and see detailed check results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Farm</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-center">Animals</TableHead>
                    <TableHead className="text-center">Passed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((result) => (
                    <IntegrityFarmRow
                      key={result.farmId}
                      result={result}
                      onRescan={scanSingleFarm}
                      onFixAll={fixAllForFarm}
                      onFixWeight={fixWeightSync}
                      onFixMilkRevenue={fixMilkRevenue}
                      onFixValuation={fixValuations}
                      onRecalculateStats={recalculateStats}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {results.length === 0 && !isScanning && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Scan Results</h3>
            <p className="text-muted-foreground text-center mb-4">
              Click "Scan All Farms" to run integrity checks across all farms in the system.
            </p>
            <Button onClick={scanAllFarms}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Start Scan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
