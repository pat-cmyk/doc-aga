import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedStockList } from "./feed-inventory/FeedStockList";
import { FeedInventoryComparison } from "./feed-inventory/FeedInventoryComparison";
import { FeedForecast } from "./FeedForecast";
import { InventoryAuditReport } from "./feed-inventory/InventoryAuditReport";
import type { MonthlyFeedForecast } from "@/lib/feedForecast";

interface FeedInventoryTabProps {
  farmId: string;
  forecasts: MonthlyFeedForecast[];
  canManage: boolean;
  prefillFeedType?: string;
  onPrefillUsed?: () => void;
}

export function FeedInventoryTab({ farmId, forecasts, canManage, prefillFeedType, onPrefillUsed }: FeedInventoryTabProps) {
  const [activeTab, setActiveTab] = useState("stock");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <FeedStockList 
            farmId={farmId} 
            canManage={canManage} 
            prefillFeedType={prefillFeedType}
            onPrefillUsed={onPrefillUsed}
          />
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <FeedForecast forecasts={forecasts} />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <FeedInventoryComparison farmId={farmId} forecasts={forecasts} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <InventoryAuditReport farmId={farmId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
