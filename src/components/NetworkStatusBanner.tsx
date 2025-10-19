import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPendingCount } from '@/lib/offlineQueue';
import { Badge } from '@/components/ui/badge';

export const NetworkStatusBanner = () => {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const updateCount = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 2000); // Update every 2s

    return () => clearInterval(interval);
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && pendingCount === 0) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount]);

  // Show success flash when back online and synced
  if (showSuccess) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 border-b-2 border-green-600 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-center gap-2 text-white">
          <Wifi className="h-5 w-5" />
          <span className="font-medium">✅ Back online and synced!</span>
        </div>
      </div>
    );
  }

  // Only show when offline
  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-100 border-b-2 border-yellow-400 px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <WifiOff className="h-5 w-5 text-yellow-700" />
          <span className="text-sm font-medium text-yellow-800">
            📡 You're offline. Data will sync when online.
          </span>
        </div>
        
        {pendingCount > 0 && (
          <Badge variant="secondary" className="bg-yellow-200 text-yellow-900 border-yellow-400">
            {pendingCount} {pendingCount === 1 ? 'item' : 'items'} queued
          </Badge>
        )}
      </div>
    </div>
  );
};
