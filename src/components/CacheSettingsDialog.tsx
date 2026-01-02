import { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Settings, Database, Clock, Activity, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { getCacheStats, clearAllCaches, refreshAllCaches, type CacheStats } from '@/lib/dataCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPendingCount, clearCompleted, getAllPending, resetForRetry } from '@/lib/offlineQueue';
import { getSyncHealth, diagnoseSyncIssues, repairSyncState, type SyncHealthStatus, type SyncDiagnostic } from '@/lib/syncHealthCheck';

export function CacheSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncHealth, setSyncHealth] = useState<SyncHealthStatus | null>(null);
  const [syncIssues, setSyncIssues] = useState<SyncDiagnostic[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const isOnline = useOnlineStatus();
  
  // Auto-cache settings (stored in localStorage)
  const [autoCache, setAutoCache] = useState(() => 
    localStorage.getItem('autoCache') !== 'false'
  );
  const [autoCacheOnView, setAutoCacheOnView] = useState(() => 
    localStorage.getItem('autoCacheOnView') !== 'false'
  );

  useEffect(() => {
    if (open) {
      loadStats();
      loadSyncHealth();
    }
  }, [open]);

  const loadStats = async () => {
    const farmId = localStorage.getItem('selectedFarmId');
    if (farmId) {
      const stats = await getCacheStats(farmId);
      setCacheStats(stats);
    }
    const count = await getPendingCount();
    setPendingCount(count);
  };

  const loadSyncHealth = async () => {
    const farmId = localStorage.getItem('selectedFarmId');
    const health = await getSyncHealth(farmId);
    setSyncHealth(health);
    const issues = await diagnoseSyncIssues(farmId);
    setSyncIssues(issues);
  };

  const handleRefreshCache = async () => {
    setLoading(true);
    const farmId = localStorage.getItem('selectedFarmId');
    
    if (!farmId) {
      toast({
        title: "❌ No farm selected",
        description: "Please select a farm first",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      await refreshAllCaches(farmId, isOnline);
      await loadStats();
      
      toast({
        title: "✅ Cache refreshed!",
        description: "All data has been updated",
      });
    } catch (error) {
      toast({
        title: "❌ Refresh failed",
        description: "Could not refresh cache",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const handleClearCache = async () => {
    setLoading(true);
    
    try {
      await clearAllCaches();
      await loadStats();
      
      toast({
        title: "🗑️ Cache cleared",
        description: "All cached data has been removed",
      });
    } catch (error) {
      toast({
        title: "❌ Clear failed",
        description: "Could not clear cache",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const handleClearPendingQueue = async () => {
    setLoading(true);
    
    try {
      await clearCompleted();
      await loadStats();
      
      toast({
        title: "🗑️ Queue cleaned",
        description: "Completed items have been removed",
      });
    } catch (error) {
      toast({
        title: "❌ Clear failed",
        description: "Could not clear pending queue",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const handleForceSync = async () => {
    if (!isOnline) {
      toast({
        title: "❌ Offline",
        description: "Connect to sync pending items",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Trigger sync by requesting background sync
      const { requestBackgroundSync } = await import('@/lib/swBridge');
      await requestBackgroundSync();
      await loadStats();
      await loadSyncHealth();
      
      toast({
        title: "✅ Sync triggered",
        description: "Syncing pending items in background",
      });
    } catch (error) {
      toast({
        title: "❌ Sync failed",
        description: "Could not trigger sync",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const handleRepairSync = async () => {
    setLoading(true);
    
    try {
      const result = await repairSyncState();
      await loadStats();
      await loadSyncHealth();
      
      if (result.success) {
        toast({
          title: "✅ Repair complete",
          description: result.message,
        });
      } else {
        toast({
          title: "⚠️ Repair issue",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Repair failed",
        description: "Could not repair sync state",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const getHealthIcon = (healthy: boolean) => {
    return healthy 
      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
      : <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getOverallHealth = () => {
    if (!syncHealth) return 'unknown';
    return syncHealth.overall;
  };

  const isQueueHealthy = () => {
    if (!syncHealth) return true;
    return !syncHealth.queue.hasStuckItems && syncHealth.queue.pendingCount < 50;
  };

  const isCacheHealthy = () => {
    if (!syncHealth) return false;
    return syncHealth.cache.hasCachedData;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Cache Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Offline & Sync Settings</DialogTitle>
          <DialogDescription>
            Manage your offline data, cache, and sync preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sync Health Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Sync Health
                <Badge 
                  variant={getOverallHealth() === 'healthy' ? 'default' : 'destructive'}
                  className="ml-auto"
                >
                  {getOverallHealth()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">IndexedDB:</span>
                <div className="flex items-center gap-1">
                  {getHealthIcon(syncHealth?.indexedDB.available ?? false)}
                  <span>{syncHealth?.indexedDB.available ? 'Available' : 'Unavailable'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Service Worker:</span>
                <div className="flex items-center gap-1">
                  {getHealthIcon(syncHealth?.serviceWorker.registered ?? false)}
                  <span>{syncHealth?.serviceWorker.registered ? 'Registered' : 'Not registered'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending Queue:</span>
                <div className="flex items-center gap-1">
                  {getHealthIcon(isQueueHealthy())}
                  <span>{pendingCount} items</span>
                </div>
              </div>
              {syncIssues.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-orange-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Issues detected:
                    </span>
                    {syncIssues.map((diagnostic, i) => (
                      <p key={i} className="text-xs text-muted-foreground pl-4">• {diagnostic.issue}</p>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cache Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Cache Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Animals cached:</span>
                <span className="font-medium">{cacheStats?.animals.count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Records cached:</span>
                <span className="font-medium">{cacheStats?.records.count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Feed items cached:</span>
                <span className="font-medium">{cacheStats?.feedInventory.itemCount || 0}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last updated:</span>
                <span className="font-medium">{getTimeAgo(cacheStats?.animals.lastUpdated || null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-medium ${cacheStats?.animals.isFresh ? 'text-green-600' : 'text-orange-600'}`}>
                  {cacheStats?.animals.isFresh ? '🟢 Fresh' : '🟡 Stale'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Cache Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Auto-Cache Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="auto-cache">Cache on farm selection</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically cache all animals when selecting a farm
                  </p>
                </div>
                <Switch
                  id="auto-cache"
                  checked={autoCache}
                  onCheckedChange={(checked) => {
                    setAutoCache(checked);
                    localStorage.setItem('autoCache', String(checked));
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="auto-cache-view">Cache on animal view</Label>
                  <p className="text-xs text-muted-foreground">
                    Cache animal details when viewing them
                  </p>
                </div>
                <Switch
                  id="auto-cache-view"
                  checked={autoCacheOnView}
                  onCheckedChange={(checked) => {
                    setAutoCacheOnView(checked);
                    localStorage.setItem('autoCacheOnView', String(checked));
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sync Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Sync Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleForceSync}
                disabled={loading || !isOnline || pendingCount === 0}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Force Sync Now
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="ml-auto">{pendingCount}</Badge>
                )}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-orange-600 hover:text-orange-700"
                    disabled={loading || pendingCount === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Pending Queue
                    {pendingCount > 0 && (
                      <Badge variant="secondary" className="ml-auto">{pendingCount}</Badge>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Pending Queue?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {pendingCount} pending items that haven't been synced yet. 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearPendingQueue}>
                      Clear Queue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {syncIssues.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-blue-600 hover:text-blue-700"
                  onClick={handleRepairSync}
                  disabled={loading}
                >
                  <Activity className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Repair Sync State
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Cache Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleRefreshCache}
              disabled={loading || !isOnline}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Cache
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClearCache}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cache
            </Button>
          </div>

          {!isOnline && (
            <p className="text-xs text-muted-foreground text-center">
              ⚠️ You're offline. Connect to sync and refresh cache.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
