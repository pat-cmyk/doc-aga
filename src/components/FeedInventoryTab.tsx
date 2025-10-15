import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedStockList } from "./feed-inventory/FeedStockList";
import { FeedInventoryComparison } from "./feed-inventory/FeedInventoryComparison";
import { FeedForecast } from "./FeedForecast";
import type { MonthlyFeedForecast } from "@/lib/feedForecast";

interface FeedInventoryTabProps {
  farmId: string;
  forecasts: MonthlyFeedForecast[];
  canManage: boolean;
}

export function FeedInventoryTab({ farmId, forecasts, canManage }: FeedInventoryTabProps) {
  const [activeTab, setActiveTab] = useState("stock");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <FeedStockList farmId={farmId} canManage={canManage} />
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <FeedForecast forecasts={forecasts} />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <FeedInventoryComparison farmId={farmId} forecasts={forecasts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
