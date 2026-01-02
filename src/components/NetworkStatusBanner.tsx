import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2, X, RefreshCw, ChevronRight } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPendingCount, getAllPending } from '@/lib/offlineQueue';
import { requestBackgroundSync } from '@/lib/swBridge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCacheStats, onCacheProgress, type CacheStats, type CacheProgress } from '@/lib/dataCache';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

export const NetworkStatusBanner = () => {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheProgress, setCacheProgress] = useState<CacheProgress | null>(null);
  const [hasShownSuccess, setHasShownSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Track cache progress
  useEffect(() => {
    const unsubscribe = onCacheProgress((progress) => {
      setCacheProgress(progress);
      
      // Clear progress when complete
      if (progress.phase === 'complete') {
        setTimeout(() => setCacheProgress(null), 2000);
      }
    });

    return unsubscribe;
  }, []);

  // Update cache stats and pending count
  useEffect(() => {
    const updateStats = async () => {
      const count = await getPendingCount();
      const prevCount = pendingCount;
      setPendingCount(count);
      
      // Update last sync time if count decreased (items were processed)
      if (isOnline && prevCount > 0 && count < prevCount) {
        setLastSyncTime(new Date());
      }

      // Get cache stats (use localStorage to get farmId)
      const farmId = localStorage.getItem('selectedFarmId');
      if (farmId) {
        const stats = await getCacheStats(farmId);
        setCacheStats(stats);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 2000); // Update every 2s

    return () => clearInterval(interval);
  }, [isOnline, pendingCount]);

  // Reset success flag when going offline
  useEffect(() => {
    if (!isOnline) {
      setHasShownSuccess(false);
    }
  }, [isOnline]);

  // Show success banner only once per online session
  useEffect(() => {
    if (isOnline && pendingCount === 0 && !hasShownSuccess) {
      setShowSuccess(true);
      setHasShownSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, hasShownSuccess]);

  // Sync now action
  const handleSyncNow = async () => {
    if (!isOnline || isSyncing || pendingCount === 0) return;
    
    setIsSyncing(true);
    try {
      await requestBackgroundSync();
      toast({
        title: "✅ Sync triggered",
        description: `Syncing ${pendingCount} pending items in background`,
      });
      setLastSyncTime(new Date());
    } catch (error) {
      toast({
        title: "❌ Sync failed",
        description: "Could not trigger sync",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Show caching progress (when online)
  if (isOnline && cacheProgress && cacheProgress.phase !== 'complete') {
    const progressPercent = cacheProgress.total > 0 
      ? (cacheProgress.current / cacheProgress.total) * 100 
      : 0;

    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-50 border-b-2 border-blue-300 px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-blue-900">
                🔄 {cacheProgress.message}
              </span>
              <span className="text-xs text-blue-700">
                {cacheProgress.current}/{cacheProgress.total}
              </span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        </div>
      </div>
    );
  }

  // Show syncing progress banner
  if (isOnline && isSyncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-blue-50 border-b-2 border-blue-300 px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
          <span className="text-sm font-medium text-blue-900">
            🔄 Syncing {pendingCount} pending items...
          </span>
        </div>
      </div>
    );
  }

  // Show success flash when back online and synced
  if (showSuccess) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 border-b-2 border-green-600 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-2 flex-1">
            <Wifi className="h-5 w-5" />
            <span className="font-medium">✅ Back online and synced!</span>
            {lastSyncTime && (
              <span className="text-xs opacity-90">
                {lastSyncTime.toLocaleTimeString()}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowSuccess(false)}
            className="hover:bg-green-600 rounded-full p-1 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Show pending sync banner when online with pending items
  if (isOnline && pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b-2 border-amber-300 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <RefreshCw className="h-5 w-5 text-amber-700" />
            <span className="text-sm font-medium text-amber-900">
              {pendingCount} {pendingCount === 1 ? 'item' : 'items'} pending sync
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-amber-100 border-amber-400 text-amber-900 hover:bg-amber-200"
              onClick={handleSyncNow}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
            <button
              onClick={() => setPendingCount(0)} // Dismiss temporarily
              className="hover:bg-amber-200 rounded-full p-1 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-amber-700" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only show when offline
  if (isOnline) return null;

  // Format last update time
  const getTimeAgo = (date: Date | null) => {
    if (!date) return 'never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  // Determine banner state based on cache
  const hasCachedData = cacheStats && cacheStats.animals.count > 0;
  const isCacheStale = cacheStats && !cacheStats.animals.isFresh;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 border-b-2 px-4 py-3 shadow-lg ${
      hasCachedData 
        ? 'bg-yellow-100 border-yellow-400' 
        : 'bg-orange-100 border-orange-400'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <WifiOff className={`h-5 w-5 ${hasCachedData ? 'text-yellow-700' : 'text-orange-700'}`} />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">
              📡 You're offline
            </div>
            {hasCachedData ? (
              <div className="text-xs text-gray-700 mt-0.5">
                ✅ {cacheStats.animals.count} animals cached 
                {cacheStats.animals.lastUpdated && (
                  <span className={isCacheStale ? 'text-orange-700 font-medium' : ''}>
                    {' '}• updated {getTimeAgo(cacheStats.animals.lastUpdated)}
                  </span>
                )}
                {cacheStats.records.count > 0 && (
                  <span> • {cacheStats.records.count} records available</span>
                )}
              </div>
            ) : (
              <div className="text-xs text-orange-800 mt-0.5">
                ⚠️ No cached data available. Connect to download data.
              </div>
            )}
          </div>
        </div>
        
        {pendingCount > 0 && (
          <Badge variant="secondary" className={`${
            hasCachedData 
              ? 'bg-yellow-200 text-yellow-900 border-yellow-400' 
              : 'bg-orange-200 text-orange-900 border-orange-400'
          }`}>
            {pendingCount} {pendingCount === 1 ? 'item' : 'items'} queued
          </Badge>
        )}
      </div>
    </div>
  );
};
