import { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Settings, Database, Clock } from 'lucide-react';
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
import { toast } from '@/hooks/use-toast';
import { getCacheStats, clearAllCaches, refreshAllCaches, type CacheStats } from '@/lib/dataCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function CacheSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
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
    }
  }, [open]);

  const loadStats = async () => {
    const farmId = localStorage.getItem('selectedFarmId');
    if (farmId) {
      const stats = await getCacheStats(farmId);
      setCacheStats(stats);
    }
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Cache Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Offline Cache Settings</DialogTitle>
          <DialogDescription>
            Manage your offline data and cache preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          {/* Actions */}
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
              ⚠️ You're offline. Connect to refresh cache.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
