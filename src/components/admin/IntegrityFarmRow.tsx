import { useState } from "react";
import { FarmIntegrityResult } from "@/hooks/useIntegrityScan";
import { IntegrityCheckCard } from "./IntegrityCheckCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, RefreshCw, Wrench, Loader2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";

interface IntegrityFarmRowProps {
  result: FarmIntegrityResult;
  onRescan: (farmId: string) => Promise<void>;
  onFixAll: (farmId: string, farmName: string, checks: FarmIntegrityResult['checks']) => Promise<void>;
  onFixWeight: (farmId: string, farmName: string) => Promise<void>;
  onFixMilkRevenue: (farmId: string, farmName: string) => Promise<void>;
  onFixValuation: (farmId: string, farmName: string) => Promise<void>;
  onRecalculateStats: (farmId: string) => Promise<void>;
}

export function IntegrityFarmRow({
  result,
  onRescan,
  onFixAll,
  onFixWeight,
  onFixMilkRevenue,
  onFixValuation,
  onRecalculateStats
}: IntegrityFarmRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);

  const handleFixAll = async () => {
    setIsFixingAll(true);
    try {
      await onFixAll(result.farmId, result.farmName, result.checks);
    } finally {
      setIsFixingAll(false);
    }
  };

  const handleRescan = async () => {
    setIsRescanning(true);
    try {
      await onRescan(result.farmId);
    } finally {
      setIsRescanning(false);
    }
  };

  const getStatusBadge = () => {
    switch (result.status) {
      case 'healthy':
        return <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Healthy</Badge>;
      case 'warning':
        return <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{result.failedCount} Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive">{result.failedCount} Critical</Badge>;
    }
  };

  const getFixHandler = (checkName: string) => {
    switch (checkName) {
      case 'Weight Sync':
        return () => onFixWeight(result.farmId, result.farmName);
      case 'Milk Revenue Sync':
        return () => onFixMilkRevenue(result.farmId, result.farmName);
      case 'Valuation Consistency':
        return () => onFixValuation(result.farmId, result.farmName);
      case 'Stats Consistency':
        return () => onRecalculateStats(result.farmId);
      default:
        return undefined;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="hover:bg-muted/50">
        <TableCell className="w-8">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="font-medium">{result.farmName}</TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="text-sm">{result.ownerName || 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">{result.ownerEmail || '-'}</span>
          </div>
        </TableCell>
        <TableCell className="text-center">{result.animalCount}</TableCell>
        <TableCell className="text-center">
          <span className={result.passedCount === result.checks.length ? 'text-green-600' : ''}>
            {result.passedCount}/{result.checks.length}
          </span>
        </TableCell>
        <TableCell>{getStatusBadge()}</TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7"
              onClick={handleRescan}
              disabled={isRescanning}
            >
              {isRescanning ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
            {result.status !== 'healthy' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs"
                onClick={handleFixAll}
                disabled={isFixingAll}
              >
                {isFixingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Wrench className="h-3 w-3 mr-1" />
                )}
                Fix All
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-muted/30 p-4 border-t">
              <div className="grid gap-2 md:grid-cols-2">
                {result.checks.map((check, i) => (
                  <IntegrityCheckCard
                    key={i}
                    check={check}
                    farmId={result.farmId}
                    farmName={result.farmName}
                    onFix={!check.passed ? getFixHandler(check.checkName) : undefined}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Last scanned: {result.lastScanned.toLocaleTimeString()}
              </p>
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}
