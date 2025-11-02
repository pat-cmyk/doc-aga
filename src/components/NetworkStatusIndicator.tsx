import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPendingCount } from '@/lib/offlineQueue';
import { getCacheStats, onCacheProgress, type CacheStats, type CacheProgress } from '@/lib/dataCache';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const NetworkStatusIndicator = () => {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheProgress, setCacheProgress] = useState<CacheProgress | null>(null);

  // Track cache progress
  useEffect(() => {
    const unsubscribe = onCacheProgress((progress) => {
      setCacheProgress(progress);
      
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
      setPendingCount(count);

      const farmId = localStorage.getItem('selectedFarmId');
      if (farmId) {
        const stats = await getCacheStats(farmId);
        setCacheStats(stats);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 2000);

    return () => clearInterval(interval);
  }, [isOnline]);

  // Determine status and color
  const isSyncing = isOnline && cacheProgress && cacheProgress.phase !== 'complete';
  const hasCachedData = cacheStats && cacheStats.animals.count > 0;
  
  let statusColor = 'bg-green-500'; // Online
  let icon = <Wifi className="h-3 w-3 text-white" />;
  let tooltipText = '✅ Online';

  if (isSyncing) {
    statusColor = 'bg-yellow-500 animate-pulse';
    icon = <Loader2 className="h-3 w-3 text-white animate-spin" />;
    tooltipText = `🔄 Syncing... ${cacheProgress?.current || 0}/${cacheProgress?.total || 0}`;
  } else if (!isOnline) {
    statusColor = 'bg-red-500';
    icon = <WifiOff className="h-3 w-3 text-white" />;
    tooltipText = hasCachedData 
      ? `📡 Offline • ${cacheStats.animals.count} animals cached`
      : '⚠️ Offline • No cached data';
  } else if (pendingCount > 0) {
    statusColor = 'bg-yellow-500';
    tooltipText = `✅ Online • ${pendingCount} item${pendingCount === 1 ? '' : 's'} syncing`;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`relative flex items-center justify-center h-8 w-8 rounded-full ${statusColor} shadow-sm cursor-pointer transition-all duration-300 hover:scale-110`}
            role="status"
            aria-label={tooltipText}
          >
            {icon}
            {pendingCount > 0 && !isSyncing && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-600 text-[10px] font-bold text-white">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[250px]">
          <p className="text-sm">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
