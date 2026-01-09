import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MilkStockList } from "./MilkStockList";
import { MilkSalesHistory } from "./MilkSalesHistory";
import { useMilkInventory } from "@/hooks/useMilkInventory";
import { Milk, TrendingUp, History, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCacheManager, isCacheManagerReady } from "@/lib/cacheManager";

interface MilkInventoryTabProps {
  farmId: string;
  canManage?: boolean;
}

export function MilkInventoryTab({ farmId, canManage = true }: MilkInventoryTabProps) {
  const [activeSubTab, setActiveSubTab] = useState("stock");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data, isLoading, refetch } = useMilkInventory(farmId);
  const isOnline = useOnlineStatus();

  // Force fresh data on mount by invalidating caches
  useEffect(() => {
    if (farmId && isOnline && isCacheManagerReady()) {
      getCacheManager().invalidateForMutation('milk-record', farmId);
    }
  }, [farmId, isOnline]);

  const handleRefresh = async () => {
    if (!isOnline || isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (isCacheManagerReady()) {
        await getCacheManager().invalidateForMutation('milk-record', farmId);
      }
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Milk className="h-5 w-5 text-primary" />
            <CardTitle>Milk Inventory</CardTitle>
          </div>
          {isOnline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          )}
        </div>
        <CardDescription>
          Track unsold milk and record bulk sales with FIFO (oldest first) logic
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stock" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Current Stock
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Sales History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock">
            <MilkStockList 
              farmId={farmId} 
              data={data} 
              isLoading={isLoading}
              canManage={canManage}
            />
          </TabsContent>

          <TabsContent value="history">
            <MilkSalesHistory farmId={farmId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
