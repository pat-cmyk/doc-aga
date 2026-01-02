import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SyncHealthMetrics {
  total_syncs_24h: number;
  total_syncs_7d: number;
  success_rate_24h: number;
  avg_duration_ms: number;
  failed_syncs_24h: number;
  farms_with_activity: number;
  by_type: Record<string, number> | null;
}

interface SyncAnalyticsRow {
  id: string;
  sync_type: string;
  items_processed: number | null;
  items_succeeded: number | null;
  items_failed: number | null;
  duration_ms: number | null;
  created_at: string;
  error_summary: string | null;
}

export const SyncMonitoringDashboard = () => {
  const { data: metrics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-sync-health'],
    queryFn: async () => {
      // Use any cast since types not yet regenerated
      const { data, error } = await (supabase as any).rpc('get_sync_health_metrics');
      if (error) throw error;
      return data as SyncHealthMetrics;
    },
    refetchInterval: 60000,
  });

  const { data: recentSyncs } = useQuery({
    queryKey: ['admin-recent-syncs'],
    queryFn: async () => {
      // Use any cast since table types not yet regenerated
      const { data, error } = await (supabase as any)
        .from('sync_analytics')
        .select('id, sync_type, items_processed, items_succeeded, items_failed, duration_ms, created_at, error_summary')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as SyncAnalyticsRow[];
    },
    refetchInterval: 30000,
  });

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-destructive';
  };

  const getSuccessRateBadge = (rate: number) => {
    if (rate >= 95) return { variant: 'default' as const, label: 'Healthy' };
    if (rate >= 80) return { variant: 'secondary' as const, label: 'Warning' };
    return { variant: 'destructive' as const, label: 'Critical' };
  };

  const getTrend = (current: number, threshold: number, inverse = false) => {
    const isGood = inverse ? current < threshold : current >= threshold;
    if (isGood) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (!inverse && current >= threshold * 0.8) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-destructive" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const successBadge = getSuccessRateBadge(metrics?.success_rate_24h || 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sync Monitoring</h3>
          <p className="text-sm text-muted-foreground">
            Real-time synchronization health across all farms
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total Syncs (24h)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{metrics?.total_syncs_24h || 0}</span>
              {getTrend(metrics?.total_syncs_24h || 0, 10)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.total_syncs_7d || 0} in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Success Rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${getSuccessRateColor(metrics?.success_rate_24h || 100)}`}>
                {metrics?.success_rate_24h || 100}%
              </span>
              <Badge variant={successBadge.variant}>{successBadge.label}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Duration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {metrics?.avg_duration_ms ? `${(metrics.avg_duration_ms / 1000).toFixed(1)}s` : '0s'}
              </span>
              {getTrend(metrics?.avg_duration_ms || 0, 5000, true)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed Syncs (24h)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-bold ${(metrics?.failed_syncs_24h || 0) > 0 ? 'text-destructive' : ''}`}>
                {metrics?.failed_syncs_24h || 0}
              </span>
              {(metrics?.failed_syncs_24h || 0) > 0 && (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.farms_with_activity || 0} active farms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Types Breakdown */}
      {metrics?.by_type && Object.keys(metrics.by_type).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Syncs by Type (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.by_type).map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Syncs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Sync Operations</CardTitle>
          <CardDescription>Last 10 sync operations across all farms</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSyncs && recentSyncs.length > 0 ? (
            <div className="space-y-2">
              {recentSyncs.map((sync) => (
                <div
                  key={sync.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {(sync.items_failed || 0) > 0 ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {sync.sync_type}
                        </Badge>
                        <span className="text-sm">
                          {sync.items_succeeded || 0}/{sync.items_processed || 0} items
                        </span>
                      </div>
                      {sync.error_summary && (
                        <p className="text-xs text-destructive mt-1">{sync.error_summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>{sync.duration_ms ? `${(sync.duration_ms / 1000).toFixed(1)}s` : '-'}</div>
                    <div className="text-xs">
                      {formatDistanceToNow(new Date(sync.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sync operations recorded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
