import { useEffect, useState } from "react";
import { Plus, TrendingDown, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AddFeedStockDialog } from "./AddFeedStockDialog";
import { StockTransactionHistory } from "./StockTransactionHistory";
import type { FeedInventoryItem } from "@/lib/feedInventory";
import { calculateStockoutDate, getStatusColor } from "@/lib/feedInventory";
import { useToast } from "@/hooks/use-toast";

interface FeedStockListProps {
  farmId: string;
  canManage: boolean;
}

export function FeedStockList({ farmId, canManage }: FeedStockListProps) {
  const [inventory, setInventory] = useState<FeedInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FeedInventoryItem | null>(null);
  const [viewingHistory, setViewingHistory] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchInventory();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('feed-inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feed_inventory',
          filter: `farm_id=eq.${farmId}`
        },
        () => {
          fetchInventory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [farmId]);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('feed_inventory')
        .select('*')
        .eq('farm_id', farmId)
        .order('feed_type');

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast({
        title: "Error",
        description: "Failed to load feed inventory",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: FeedInventoryItem) => {
    setEditingItem(item);
    setIsAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsAddDialogOpen(false);
    setEditingItem(null);
  };

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
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Feed Inventory</h3>
          <p className="text-sm text-muted-foreground">
            {inventory.length} feed type{inventory.length !== 1 ? 's' : ''} in stock
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Feed Stock
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inventory.map((item) => {
          const dailyConsumption = 50; // Simplified - should come from forecast
          const stockout = calculateStockoutDate(item.quantity_kg, dailyConsumption);
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
                  <Badge className={getStatusColor(stockout.status)}>
                    {stockout.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Current Stock</span>
                    <span className="font-semibold">
                      {item.quantity_kg.toLocaleString()} {item.unit}
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
