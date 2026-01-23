import { useEffect, useState } from "react";
import { Plus, TrendingDown, Package, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AddFeedStockDialog } from "./AddFeedStockDialog";
import { StockTransactionHistory } from "./StockTransactionHistory";
import { ExpiryBadge } from "./ExpiryBadge";
import { useFeedInventory } from "@/hooks/useFeedInventory";
import type { FeedInventoryItem } from "@/lib/feedInventory";
import { calculateStockoutDate, getStatusColor } from "@/lib/feedInventory";

interface FeedStockListProps {
  farmId: string;
  canManage: boolean;
  prefillFeedType?: string;
  onPrefillUsed?: () => void;
}

/**
 * Feed Stock List Component
 * Uses SSOT pattern via useFeedInventory hook for consistent data access
 */
export function FeedStockList({ farmId, canManage, prefillFeedType, onPrefillUsed }: FeedStockListProps) {
  // SSOT: Use unified feed inventory hook (handles cache, realtime, offline)
  const { inventory, summary, loading, isCached, dailyConsumption } = useFeedInventory(farmId);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FeedInventoryItem | null>(null);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);

  // Auto-open dialog if prefillFeedType is provided
  useEffect(() => {
    if (prefillFeedType && canManage) {
      setIsAddDialogOpen(true);
    }
  }, [prefillFeedType, canManage]);

  const handleEdit = (item: FeedInventoryItem) => {
    setEditingItem(item);
    setIsAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setEditingItem(null);
    if (onPrefillUsed) {
      onPrefillUsed();
    }
  };

  // Estimate per-item daily consumption (total consumption / number of items)
  const estimatedDailyConsumptionPerItem = dailyConsumption > 0 && inventory.length > 0
    ? dailyConsumption / inventory.length
    : 50; // Fallback to 50kg/day

  if (loading) {
    return <div className="text-center py-8">Loading inventory...</div>;
  }

  if (inventory.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Feed Stock Yet</h3>
        <p className="text-muted-foreground mb-4">
          Start by adding your first feed stock to track inventory and compare with forecasts.
        </p>
        {canManage && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Feed Stock
          </Button>
        )}
        <AddFeedStockDialog
          open={isAddDialogOpen}
          onOpenChange={handleDialogClose}
          farmId={farmId}
          editItem={editingItem}
          prefillFeedType={prefillFeedType}
          existingFeedTypes={inventory.map(item => item.feed_type)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Feeds</h3>
            {isCached && (
              <Badge variant="outline" className="text-xs gap-1">
                <CloudOff className="h-3 w-3" />
                Cached
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {inventory.length} feed type{inventory.length !== 1 ? 's' : ''} in stock
            {summary.totalKg > 0 && ` • ${summary.totalKg.toLocaleString()} kg total`}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Feed Stock
          </Button>
        )}
      </div>

      {/* Summary stats */}
      {summary.totalKg > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Roughage</div>
            <div className="text-lg font-semibold">{summary.roughageKg.toLocaleString()} kg</div>
            {summary.roughageDays !== null && (
              <div className="text-xs text-muted-foreground">{summary.roughageDays} days</div>
            )}
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Concentrates</div>
            <div className="text-lg font-semibold">{summary.concentrateKg.toLocaleString()} kg</div>
            {summary.concentrateDays !== null && (
              <div className="text-xs text-muted-foreground">{summary.concentrateDays} days</div>
            )}
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Total Value</div>
            <div className="text-lg font-semibold">₱{summary.totalValue.toLocaleString()}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Alerts</div>
            <div className="flex gap-2 text-lg font-semibold">
              {summary.expiringCount > 0 && (
                <span className="text-yellow-600">{summary.expiringCount} expiring</span>
              )}
              {summary.lowStockCount > 0 && (
                <span className="text-destructive">{summary.lowStockCount} low</span>
              )}
              {summary.expiringCount === 0 && summary.lowStockCount === 0 && (
                <span className="text-green-600">All good</span>
              )}
            </div>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inventory.map((item) => {
          const stockout = calculateStockoutDate(item.quantity_kg, estimatedDailyConsumptionPerItem);
          const stockPercentage = item.reorder_threshold 
            ? Math.min((item.quantity_kg / item.reorder_threshold) * 100, 100)
            : 100;

          return (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{item.feed_type}</CardTitle>
                    <CardDescription>
                      {item.supplier && `Supplier: ${item.supplier}`}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge className={getStatusColor(stockout.status)}>
                      {stockout.status}
                    </Badge>
                    <ExpiryBadge expiryDate={item.expiry_date || null} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Current Stock</span>
                    <span className="font-semibold">
                      {(() => {
                        const needsConversion = ['bags', 'bales', 'barrels'].includes(item.unit);
                        if (needsConversion && item.weight_per_unit) {
                          const unitCount = Math.round(item.quantity_kg / item.weight_per_unit);
                          return `${unitCount.toLocaleString()} ${item.unit} / ${item.quantity_kg.toLocaleString()} kg`;
                        }
                        return `${item.quantity_kg.toLocaleString()} ${item.unit}`;
                      })()}
                    </span>
                  </div>
                  {item.reorder_threshold && (
                    <Progress value={stockPercentage} className="h-2" />
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {stockout.daysRemaining === Infinity 
                      ? 'No consumption data'
                      : `${stockout.daysRemaining} days remaining`}
                  </span>
                </div>

                {item.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.notes}
                  </p>
                )}

                <div className="flex gap-2">
                  {canManage && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEdit(item)}
                    >
                      Edit
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setViewingHistory(item.id)}
                  >
                    History
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AddFeedStockDialog
        open={isAddDialogOpen}
        onOpenChange={handleDialogClose}
        farmId={farmId}
        editItem={editingItem}
        prefillFeedType={prefillFeedType}
        existingFeedTypes={inventory.map(item => item.feed_type)}
      />

      {viewingHistory && (
        <StockTransactionHistory
          feedInventoryId={viewingHistory}
          open={!!viewingHistory}
          onOpenChange={(open) => !open && setViewingHistory(null)}
        />
      )}
    </div>
  );
}
