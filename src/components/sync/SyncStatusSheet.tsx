import { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Database, 
  Clock, 
  CheckCircle, 
  Cloud, 
  CloudOff, 
  Smartphone,
  ArrowUpDown,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useFarm } from '@/contexts/FarmContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { syncQueue } from '@/lib/syncService';
import { getPendingCount, getQueueCount } from '@/lib/offlineQueue';
import { getCacheStats, type CacheStats } from '@/lib/dataCache';
import { getAllSyncCheckpoints, type SyncCheckpoint } from '@/lib/syncCheckpoint';
import { getConflictCount } from '@/lib/conflictDetection';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export const SyncStatusSheet = () => {
  const { farmId } = useFarm();
  const isOnline = useOnlineStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [checkpoints, setCheckpoints] = useState<SyncCheckpoint[]>([]);

  const loadStats = async () => {
    if (!farmId) return;

    const [pending, total, conflicts, stats, syncCheckpoints] = await Promise.all([
      getPendingCount(),
      getQueueCount(),
      getConflictCount(farmId),
      getCacheStats(farmId),
      getAllSyncCheckpoints(farmId),
    ]);

    setPendingCount(pending);
    setQueueCount(total);
    setConflictCount(conflicts);
    setCacheStats(stats);
    setCheckpoints(syncCheckpoints);
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 3000);
    return () => clearInterval(interval);
  }, [farmId, isOpen]);

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }

    setIsSyncing(true);
    try {
      await syncQueue();
      await loadStats();
      toast.success('Sync completed');
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTableName = (name: string): string => {
    return name
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase());
  };

  const getSyncHealth = (): { status: 'good' | 'warning' | 'error'; label: string } => {
    if (conflictCount > 0) return { status: 'error', label: 'Conflicts detected' };
    if (pendingCount > 5) return { status: 'warning', label: 'Pending items' };
    if (!isOnline) return { status: 'warning', label: 'Offline' };
    return { status: 'good', label: 'All synced' };
  };

  const health = getSyncHealth();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
        >
          <Database className="h-4 w-4" />
          <span className="hidden sm:inline">Sync Status</span>
          {(pendingCount > 0 || conflictCount > 0) && (
            <Badge 
              variant={conflictCount > 0 ? "destructive" : "secondary"}
              className="h-5 min-w-5 flex items-center justify-center"
            >
              {conflictCount > 0 ? conflictCount : pendingCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Sync Status
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)] mt-4">
          <div className="space-y-4 pr-4">
            {/* Connection Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {isOnline ? (
                    <Cloud className="h-4 w-4 text-green-500" />
                  ) : (
                    <CloudOff className="h-4 w-4 text-red-500" />
                  )}
                  Connection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  <Badge variant={health.status === 'good' ? 'default' : health.status === 'warning' ? 'secondary' : 'destructive'}>
                    {health.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Sync Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={handleSync} 
                  disabled={!isOnline || isSyncing}
                  className="w-full"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </>
                  )}
                </Button>
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-muted rounded-md">
                    <div className="text-lg font-bold">{pendingCount}</div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </div>
                  <div className="p-2 bg-muted rounded-md">
                    <div className="text-lg font-bold">{queueCount}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="p-2 bg-muted rounded-md">
                    <div className={`text-lg font-bold ${conflictCount > 0 ? 'text-destructive' : ''}`}>
                      {conflictCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Conflicts</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cache Stats */}
            {cacheStats && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Local Cache
                  </CardTitle>
                  <CardDescription>
                    Data stored on this device
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Animals</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{cacheStats.animals.count}</span>
                        {cacheStats.animals.isFresh ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <Clock className="h-3 w-3 text-yellow-500" />
                        )}
                      </div>
                    </div>
                    {cacheStats.animals.lastUpdated && (
                      <p className="text-xs text-muted-foreground">
                        Updated {formatDistanceToNow(cacheStats.animals.lastUpdated, { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Records</span>
                      <span className="font-medium">{cacheStats.records.count}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sync Checkpoints */}
            {checkpoints.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Last Sync Times
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {checkpoints.map((checkpoint) => (
                      <div 
                        key={checkpoint.tableName} 
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span className="text-muted-foreground">
                          {formatTableName(checkpoint.tableName)}
                        </span>
                        <div className="text-right">
                          <div className="font-medium">
                            {checkpoint.recordsSynced} records
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(checkpoint.lastSyncAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  💡 Data is automatically synced when you're online. 
                  Changes made offline are queued and synced when connection is restored.
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
