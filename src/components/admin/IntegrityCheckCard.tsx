import { IntegrityCheckResult } from "@/test-utils/data-integrity-helpers";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Wrench, Loader2 } from "lucide-react";
import { useState } from "react";

interface IntegrityCheckCardProps {
  check: IntegrityCheckResult;
  farmId: string;
  farmName: string;
  onFix?: () => Promise<void>;
}

export function IntegrityCheckCard({ check, farmId, farmName, onFix }: IntegrityCheckCardProps) {
  const [isFixing, setIsFixing] = useState(false);

  const handleFix = async () => {
    if (!onFix) return;
    setIsFixing(true);
    try {
      await onFix();
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${
      check.passed 
        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
        : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {check.passed ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          )}
          <span className="font-medium text-sm">{check.checkName}</span>
        </div>
        
        {!check.passed && onFix && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleFix}
            disabled={isFixing}
            className="h-7 text-xs"
          >
            {isFixing ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Wrench className="h-3 w-3 mr-1" />
            )}
            Fix
          </Button>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground mt-1 ml-6">
        {check.details}
      </p>
      
      {!check.passed && check.discrepancies.length > 0 && (
        <div className="mt-2 ml-6 space-y-1">
          {check.discrepancies.slice(0, 3).map((d, i) => (
            <div key={i} className="text-xs bg-background/50 p-1.5 rounded">
              <span className="text-muted-foreground">{d.field}:</span>{' '}
              <span className="text-red-600 dark:text-red-400">Expected {d.expected}</span>
              {' → '}
              <span className="text-amber-600 dark:text-amber-400">Got {d.actual}</span>
            </div>
          ))}
          {check.discrepancies.length > 3 && (
            <p className="text-xs text-muted-foreground">
              ... and {check.discrepancies.length - 3} more issues
            </p>
          )}
        </div>
      )}
    </div>
  );
}
