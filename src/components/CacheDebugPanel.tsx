import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle, Bug, ChevronDown, ChevronRight, Database, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  getCachedFeedInventory, 
  getCachedDashboardStats,
  getCachedAnimals,
  updateFeedInventoryCache,
  clearAllCaches,
  refreshAllCaches,
} from '@/lib/dataCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { FeedInventoryItem } from '@/lib/feedInventory';
import type { FeedStockBreakdown } from '@/components/farm-dashboard/hooks/useDashboardStats';

/**
 * Cache debug data structure for comparison
 */
export interface CacheDebugData {
  feedInventory: {
    cache: {
      items: FeedInventoryItem[];
      dailyConsumption?: number;
      summary?: {
        totalKg: number;
        concentrateKg: number;
        roughageKg: number;
        mineralsKg: number;
        supplementsKg: number;
      };
      lastUpdated?: number;
    } | null;
    server: FeedInventoryItem[] | null;
    discrepancies: string[];
  };
  dashboardStats: {
    cache: {
      feedStockDays: number | null;
      feedStockBreakdown?: FeedStockBreakdown;
      totalAnimals: number;
      cacheVersion?: number;
      lastUpdated?: number;
    } | null;
    server: {
      feedStockDays: number | null;
      feedStockBreakdown?: FeedStockBreakdown;
      totalAnimals: number;
    } | null;
    discrepancies: string[];
  };
  animalCounts: {
    cached: Record<string, number>;
    live: Record<string, number>;
    discrepancies: string[];
  };
  cacheVersion: {
    local: number;
    expected: number;
    isStale: boolean;
  };
}

const EXPECTED_CACHE_VERSION = 3;

/**
 * Detect discrepancies between cached and server data
 */
export function detectCacheDiscrepancies(
  cache: CacheDebugData['feedInventory']['cache'],
  server: FeedInventoryItem[] | null
): string[] {
  const discrepancies: string[] = [];
  
  if (!cache && server && server.length > 0) {
    discrepancies.push('No cache exists but server has data');
    return discrepancies;
  }
  
  if (!cache || !server) return discrepancies;

  // Compare item counts
  if (cache.items.length !== server.length) {
    discrepancies.push(`Item count mismatch: cache=${cache.items.length}, server=${server.length}`);
  }

  // Compare totals by category
  const serverConcentrate = server
    .filter(i => i.category === 'concentrates')
    .reduce((sum, i) => sum + (i.quantity_kg || 0), 0);
  const serverRoughage = server
    .filter(i => i.category === 'roughage' || !i.category)
    .reduce((sum, i) => sum + (i.quantity_kg || 0), 0);

  if (cache.summary) {
    if (Math.abs(cache.summary.concentrateKg - serverConcentrate) > 0.1) {
      discrepancies.push(`Concentrate mismatch: cache=${cache.summary.concentrateKg}kg, server=${serverConcentrate}kg`);
    }
    if (Math.abs(cache.summary.roughageKg - serverRoughage) > 0.1) {
      discrepancies.push(`Roughage mismatch: cache=${cache.summary.roughageKg}kg, server=${serverRoughage}kg`);
    }
  }

  return discrepancies;
}

/**
 * Fetch debug data comparing cache vs server
 */
export async function getCacheDebugData(farmId: string): Promise<CacheDebugData> {
  const debugData: CacheDebugData = {
    feedInventory: { cache: null, server: null, discrepancies: [] },
    dashboardStats: { cache: null, server: null, discrepancies: [] },
    animalCounts: { cached: {}, live: {}, discrepancies: [] },
    cacheVersion: { local: 0, expected: EXPECTED_CACHE_VERSION, isStale: false },
  };

  try {
    // Fetch all data in parallel
    const [feedCache, dashboardCache, animalsCache, feedServer, animalsServer] = await Promise.all([
      getCachedFeedInventory(farmId),
      getCachedDashboardStats(farmId),
      getCachedAnimals(farmId),
      supabase.from('feed_inventory').select('*').eq('farm_id', farmId),
      supabase.from('animals').select('livestock_type').eq('farm_id', farmId).eq('is_deleted', false),
    ]);

    // Feed Inventory
    if (feedCache) {
      const cacheData = feedCache as any;
      debugData.feedInventory.cache = {
        items: cacheData.items as FeedInventoryItem[],
        dailyConsumption: cacheData.dailyConsumption,
        summary: cacheData.summary,
        lastUpdated: cacheData.lastUpdated,
      };
    }
    debugData.feedInventory.server = (feedServer.data || []) as FeedInventoryItem[];
    debugData.feedInventory.discrepancies = detectCacheDiscrepancies(
      debugData.feedInventory.cache,
      debugData.feedInventory.server
    );

    // Dashboard Stats
    if (dashboardCache) {
      const statsData = dashboardCache.stats as any;
      debugData.dashboardStats.cache = {
        feedStockDays: statsData.feedStockDays ?? null,
        feedStockBreakdown: statsData.feedStockBreakdown,
        totalAnimals: statsData.totalAnimals ?? 0,
        cacheVersion: (dashboardCache as any).cacheVersion,
        lastUpdated: dashboardCache.lastUpdated,
      };
      debugData.cacheVersion.local = (dashboardCache as any).cacheVersion || 0;
      debugData.cacheVersion.isStale = debugData.cacheVersion.local < EXPECTED_CACHE_VERSION;
    }

    // Animal counts by livestock type
    const cachedCounts: Record<string, number> = {};
    const liveCounts: Record<string, number> = {};

    if (animalsCache?.data) {
      animalsCache.data.forEach(animal => {
        const type = animal.livestock_type || 'unknown';
        cachedCounts[type] = (cachedCounts[type] || 0) + 1;
      });
    }

    if (animalsServer.data) {
      animalsServer.data.forEach(animal => {
        const type = animal.livestock_type || 'unknown';
        liveCounts[type] = (liveCounts[type] || 0) + 1;
      });
    }

    debugData.animalCounts.cached = cachedCounts;
    debugData.animalCounts.live = liveCounts;

    // Check animal count discrepancies
    const allTypes = new Set([...Object.keys(cachedCounts), ...Object.keys(liveCounts)]);
    allTypes.forEach(type => {
      const cached = cachedCounts[type] || 0;
      const live = liveCounts[type] || 0;
      if (cached !== live) {
        debugData.animalCounts.discrepancies.push(
          `${type}: cache=${cached}, server=${live}`
        );
      }
    });

  } catch (error) {
    console.error('Error fetching cache debug data:', error);
  }

  return debugData;
}

interface CacheDebugPanelProps {
  farmId: string;
}

/**
 * Cache Debug Panel Component
 * Shows side-by-side comparison of cached vs server values
 * Accessible via ?debug=cache URL parameter or Debug tab in CacheSettingsDialog
 */
export function CacheDebugPanel({ farmId }: CacheDebugPanelProps) {
  const [debugData, setDebugData] = useState<CacheDebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    feed: true,
    dashboard: false,
    animals: false,
  });
  const isOnline = useOnlineStatus();

  const loadDebugData = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const data = await getCacheDebugData(farmId);
      setDebugData(data);
    } catch (error) {
      console.error('Failed to load debug data:', error);
    }
    setLoading(false);
  }, [farmId]);

  useEffect(() => {
    loadDebugData();
  }, [loadDebugData]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleRefreshSection = async (section: 'feed' | 'all') => {
    if (!isOnline) {
      toast({
        title: "Offline",
        description: "Connect to refresh cache",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (section === 'feed') {
        await updateFeedInventoryCache(farmId);
      } else {
        await refreshAllCaches(farmId, true);
      }
      await loadDebugData();
      toast({
        title: "✅ Cache refreshed",
        description: `${section === 'feed' ? 'Feed inventory' : 'All caches'} updated`,
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

  const handleClearAndRefetch = async () => {
    setLoading(true);
    try {
      await clearAllCaches();
      if (isOnline) {
        await refreshAllCaches(farmId, true);
      }
      await loadDebugData();
      toast({
        title: "🗑️ Cache cleared & refreshed",
        description: "All data reloaded from server",
      });
    } catch (error) {
      toast({
        title: "❌ Operation failed",
        description: "Could not clear and refresh cache",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return 'Never';
    const date = new Date(ts);
    return date.toLocaleString();
  };

  const getDiscrepancyBadge = (count: number) => {
    if (count === 0) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">✓ In Sync</Badge>;
    }
    return <Badge variant="destructive">{count} Issues</Badge>;
  };

  if (!debugData) {
    return (
      <Card className="border-dashed border-orange-300 bg-orange-50/50">
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-orange-600 mr-2" />
          <span className="text-orange-700">Loading debug data...</span>
        </CardContent>
      </Card>
    );
  }

  const totalDiscrepancies = 
    debugData.feedInventory.discrepancies.length +
    debugData.dashboardStats.discrepancies.length +
    debugData.animalCounts.discrepancies.length +
    (debugData.cacheVersion.isStale ? 1 : 0);

  return (
    <Card className="border-dashed border-orange-300 bg-orange-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bug className="h-4 w-4 text-orange-600" />
          Cache Debug Panel
          {getDiscrepancyBadge(totalDiscrepancies)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cache Version Status */}
        {debugData.cacheVersion.isStale && (
          <div className="flex items-center gap-2 p-2 bg-red-100 rounded-md text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Cache version outdated: v{debugData.cacheVersion.local} (expected v{debugData.cacheVersion.expected})
            </span>
          </div>
        )}

        <ScrollArea className="h-[300px] pr-4">
          {/* Feed Inventory Section */}
          <Collapsible open={openSections.feed} onOpenChange={() => toggleSection('feed')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                {openSections.feed ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Database className="h-4 w-4" />
                <span className="font-medium">Feed Inventory</span>
              </div>
              {getDiscrepancyBadge(debugData.feedInventory.discrepancies.length)}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-6 pt-2 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
                <span>Field</span>
                <span>Cache</span>
                <span>Server</span>
              </div>
              
              <ComparisonRow 
                label="Item Count"
                cache={debugData.feedInventory.cache?.items.length ?? 0}
                server={debugData.feedInventory.server?.length ?? 0}
              />
              <ComparisonRow 
                label="Roughage (kg)"
                cache={debugData.feedInventory.cache?.summary?.roughageKg ?? 0}
                server={debugData.feedInventory.server
                  ?.filter(i => i.category === 'roughage' || !i.category)
                  .reduce((sum, i) => sum + (i.quantity_kg || 0), 0) ?? 0}
              />
              <ComparisonRow 
                label="Concentrates (kg)"
                cache={debugData.feedInventory.cache?.summary?.concentrateKg ?? 0}
                server={debugData.feedInventory.server
                  ?.filter(i => i.category === 'concentrates')
                  .reduce((sum, i) => sum + (i.quantity_kg || 0), 0) ?? 0}
              />
              <ComparisonRow 
                label="Daily Consumption"
                cache={debugData.feedInventory.cache?.dailyConsumption ?? 0}
                server="N/A (computed)"
                isComputed
              />
              <div className="text-xs text-muted-foreground pt-1">
                Last cached: {formatTimestamp(debugData.feedInventory.cache?.lastUpdated)}
              </div>
              
              {debugData.feedInventory.discrepancies.map((d, i) => (
                <div key={i} className="flex items-center gap-1 text-xs text-red-600">
                  <XCircle className="h-3 w-3" />
                  {d}
                </div>
              ))}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => handleRefreshSection('feed')}
                disabled={loading || !isOnline}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh Feed Cache
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Dashboard Stats Section */}
          <Collapsible open={openSections.dashboard} onOpenChange={() => toggleSection('dashboard')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                {openSections.dashboard ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Database className="h-4 w-4" />
                <span className="font-medium">Dashboard Stats</span>
              </div>
              {getDiscrepancyBadge(debugData.dashboardStats.discrepancies.length)}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-6 pt-2 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
                <span>Field</span>
                <span>Cache</span>
                <span>Server</span>
              </div>
              
              <ComparisonRow 
                label="Feed Stock Days"
                cache={debugData.dashboardStats.cache?.feedStockDays ?? 'null'}
                server={debugData.dashboardStats.server?.feedStockDays ?? 'N/A'}
              />
              <ComparisonRow 
                label="Roughage Days"
                cache={debugData.dashboardStats.cache?.feedStockBreakdown?.roughageDays ?? 'null'}
                server={debugData.dashboardStats.server?.feedStockBreakdown?.roughageDays ?? 'N/A'}
              />
              <ComparisonRow 
                label="Concentrate Days"
                cache={debugData.dashboardStats.cache?.feedStockBreakdown?.concentrateDays ?? 'null'}
                server={debugData.dashboardStats.server?.feedStockBreakdown?.concentrateDays ?? 'N/A'}
              />
              <ComparisonRow 
                label="Total Animals"
                cache={debugData.dashboardStats.cache?.totalAnimals ?? 0}
                server={debugData.dashboardStats.server?.totalAnimals ?? 'N/A'}
              />
              <ComparisonRow 
                label="Cache Version"
                cache={`v${debugData.cacheVersion.local}`}
                server={`v${debugData.cacheVersion.expected} (expected)`}
                isMismatch={debugData.cacheVersion.isStale}
              />
              <div className="text-xs text-muted-foreground pt-1">
                Last cached: {formatTimestamp(debugData.dashboardStats.cache?.lastUpdated)}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Animal Counts Section */}
          <Collapsible open={openSections.animals} onOpenChange={() => toggleSection('animals')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                {openSections.animals ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Database className="h-4 w-4" />
                <span className="font-medium">Animal Counts by Type</span>
              </div>
              {getDiscrepancyBadge(debugData.animalCounts.discrepancies.length)}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-6 pt-2 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
                <span>Livestock Type</span>
                <span>Cache</span>
                <span>Server</span>
              </div>
              
              {Object.keys({ ...debugData.animalCounts.cached, ...debugData.animalCounts.live }).map(type => (
                <ComparisonRow 
                  key={type}
                  label={type}
                  cache={debugData.animalCounts.cached[type] ?? 0}
                  server={debugData.animalCounts.live[type] ?? 0}
                />
              ))}
              
              {debugData.animalCounts.discrepancies.map((d, i) => (
                <div key={i} className="flex items-center gap-1 text-xs text-red-600">
                  <XCircle className="h-3 w-3" />
                  {d}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </ScrollArea>

        <Separator />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => handleRefreshSection('all')}
            disabled={loading || !isOnline}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Force Refresh All
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-red-600 hover:text-red-700"
            onClick={handleClearAndRefetch}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear & Refetch
          </Button>
        </div>

        {!isOnline && (
          <p className="text-xs text-muted-foreground text-center">
            ⚠️ Offline - some actions unavailable
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ComparisonRowProps {
  label: string;
  cache: string | number;
  server: string | number;
  isComputed?: boolean;
  isMismatch?: boolean;
}

function ComparisonRow({ label, cache, server, isComputed, isMismatch }: ComparisonRowProps) {
  const cacheVal = typeof cache === 'number' ? cache.toLocaleString() : cache;
  const serverVal = typeof server === 'number' ? server.toLocaleString() : server;
  
  const isMatch = isComputed || cacheVal === serverVal || 
    (typeof cache === 'number' && typeof server === 'number' && Math.abs(cache - server) < 0.1);
  const showMismatch = isMismatch ?? !isMatch;

  return (
    <div className={`grid grid-cols-3 gap-2 text-xs py-1 ${showMismatch ? 'bg-red-50' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={showMismatch ? 'text-red-600 font-medium' : ''}>{cacheVal}</span>
      <span className={showMismatch && !isComputed ? 'text-red-600 font-medium' : ''}>
        {serverVal}
        {isMatch && !isComputed && <CheckCircle2 className="inline h-3 w-3 ml-1 text-green-600" />}
      </span>
    </div>
  );
}

export default CacheDebugPanel;
