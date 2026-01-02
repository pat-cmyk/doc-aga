import { Loader2, Check, AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OptimisticSyncStatus } from "@/hooks/useOptimisticMutation";

interface OptimisticBadgeProps {
  status: OptimisticSyncStatus;
  onRetry?: () => void;
  className?: string;
  size?: "sm" | "default";
}

/**
 * Visual indicator for optimistic records showing sync status
 * 
 * Displays different states:
 * - pending: Amber badge with clock, waiting to sync
 * - syncing: Blue badge with spinner, actively syncing
 * - synced: Green check, briefly shown then hidden
 * - error: Red badge with retry option
 * - conflict: Orange badge indicating merge needed
 */
export function OptimisticBadge({ 
  status, 
  onRetry, 
  className,
  size = "default" 
}: OptimisticBadgeProps) {
  const isSmall = size === "sm";
  const iconSize = isSmall ? "h-3 w-3" : "h-3.5 w-3.5";
  
  switch (status) {
    case 'pending':
      return (
        <Badge 
          variant="outline" 
          className={cn(
            "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
            isSmall && "text-xs py-0 px-1.5",
            className
          )}
        >
          <RefreshCw className={cn(iconSize, "mr-1")} />
          {isSmall ? "Pending" : "Pending sync"}
        </Badge>
      );

    case 'syncing':
      return (
        <Badge 
          variant="outline" 
          className={cn(
            "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
            isSmall && "text-xs py-0 px-1.5",
            className
          )}
        >
          <Loader2 className={cn(iconSize, "mr-1 animate-spin")} />
          {isSmall ? "Syncing" : "Syncing..."}
        </Badge>
      );

    case 'synced':
      return (
        <Badge 
          variant="outline" 
          className={cn(
            "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
            isSmall && "text-xs py-0 px-1.5",
            className
          )}
        >
          <Check className={cn(iconSize, "mr-1")} />
          Synced
        </Badge>
      );

    case 'error':
      return (
        <div className={cn("flex items-center gap-1", className)}>
          <Badge 
            variant="outline" 
            className={cn(
              "bg-destructive/10 text-destructive border-destructive/30",
              isSmall && "text-xs py-0 px-1.5"
            )}
          >
            <AlertCircle className={cn(iconSize, "mr-1")} />
            {isSmall ? "Failed" : "Sync failed"}
          </Badge>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-6 px-2 text-xs"
            >
              Retry
            </Button>
          )}
        </div>
      );

    case 'conflict':
      return (
        <Badge 
          variant="outline" 
          className={cn(
            "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800",
            isSmall && "text-xs py-0 px-1.5",
            className
          )}
        >
          <AlertTriangle className={cn(iconSize, "mr-1")} />
          {isSmall ? "Conflict" : "Needs review"}
        </Badge>
      );

    default:
      return null;
  }
}

/**
 * Inline sync status indicator (minimal version)
 */
export function SyncStatusDot({ status }: { status: OptimisticSyncStatus }) {
  const baseClass = "w-2 h-2 rounded-full";
  
  switch (status) {
    case 'pending':
      return <span className={cn(baseClass, "bg-amber-500")} title="Pending sync" />;
    case 'syncing':
      return <span className={cn(baseClass, "bg-blue-500 animate-pulse")} title="Syncing" />;
    case 'synced':
      return <span className={cn(baseClass, "bg-green-500")} title="Synced" />;
    case 'error':
      return <span className={cn(baseClass, "bg-destructive")} title="Sync failed" />;
    case 'conflict':
      return <span className={cn(baseClass, "bg-orange-500")} title="Conflict" />;
    default:
      return null;
  }
}
