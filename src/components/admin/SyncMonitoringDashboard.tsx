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
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SyncQueueItem {
  id: string;
  farm_id: string;
  table_name: string;
  operation_type: string;
  sync_status: string;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
}

export const SyncMonitoringDashboard = () => {
  // Calculate metrics directly from sync_queue table
  const { data: syncData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-sync-queue-health'],
    queryFn: async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get all sync records from last 7 days
      const { data: allSyncs, error } = await supabase
        .from('sync_queue')
        .select('id, farm_id, table_name, operation_type, sync_status, created_at, processed_at, error_message')
        .gte('created_at', lastWeek.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const syncs = (allSyncs || []) as SyncQueueItem[];
      
      // Calculate 24h metrics
      const syncs24h = syncs.filter(s => new Date(s.created_at) >= yesterday);
      const synced24h = syncs24h.filter(s => s.sync_status === 'synced');
      const failed24h = syncs24h.filter(s => s.sync_status === 'error');
      const pending24h = syncs24h.filter(s => s.sync_status === 'pending');

      // Success rate
      const successRate = syncs24h.length > 0 
        ? Math.round((synced24h.length / syncs24h.length) * 100 * 100) / 100
        : 100;

      // Farms with activity
      const activeFarms = new Set(syncs24h.map(s => s.farm_id)).size;

      // By table type
      const byType: Record<string, number> = {};
      syncs24h.forEach(s => {
        byType[s.table_name] = (byType[s.table_name] || 0) + 1;
      });

      return {
        total_syncs_24h: syncs24h.length,
        total_syncs_7d: syncs.length,
        success_rate_24h: successRate,
        synced_24h: synced24h.length,
        failed_24h: failed24h.length,
        pending_24h: pending24h.length,
        farms_with_activity: activeFarms,
        by_type: byType,
        recent_syncs: syncs.slice(0, 10)
      };
    },
    refetchInterval: 60000,
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'syncing':
        return <Activity className="h-4 w-4 text-blue-600" />;
      case 'conflict':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge variant="default">Synced</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'syncing':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Syncing</Badge>;
      case 'conflict':
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Conflict</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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

  const successBadge = getSuccessRateBadge(syncData?.success_rate_24h || 100);

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
              <span className="text-2xl font-bold">{syncData?.total_syncs_24h || 0}</span>
              {getTrend(syncData?.total_syncs_24h || 0, 10)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {syncData?.total_syncs_7d || 0} in last 7 days
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
              <span className={`text-2xl font-bold ${getSuccessRateColor(syncData?.success_rate_24h || 100)}`}>
                {syncData?.success_rate_24h || 100}%
              </span>
              <Badge variant={successBadge.variant}>{successBadge.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {syncData?.synced_24h || 0} synced, {syncData?.pending_24h || 0} pending
            </p>
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
              <span className={`text-2xl font-bold ${(syncData?.failed_24h || 0) > 0 ? 'text-destructive' : ''}`}>
                {syncData?.failed_24h || 0}
              </span>
              {(syncData?.failed_24h || 0) > 0 && (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Active Farms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{syncData?.farms_with_activity || 0}</span>
              {getTrend(syncData?.farms_with_activity || 0, 1)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Farms with sync activity (24h)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Types Breakdown */}
      {syncData?.by_type && Object.keys(syncData.by_type).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Syncs by Table (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(syncData.by_type).map(([table, count]) => (
                <Badge key={table} variant="secondary">
                  {table}: {count}
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
          {syncData?.recent_syncs && syncData.recent_syncs.length > 0 ? (
            <div className="space-y-2">
              {syncData.recent_syncs.map((sync) => (
                <div
                  key={sync.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(sync.sync_status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {sync.table_name}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {sync.operation_type}
                        </span>
                        {getStatusBadge(sync.sync_status)}
                      </div>
                      {sync.error_message && (
                        <p className="text-xs text-destructive mt-1 max-w-md truncate">
                          {sync.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="text-xs">
                      {formatDistanceToNow(new Date(sync.created_at), { addSuffix: true })}
                    </div>
                    {sync.processed_at && (
                      <div className="text-xs text-green-600">
                        Processed {formatDistanceToNow(new Date(sync.processed_at), { addSuffix: true })}
                      </div>
                    )}
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
