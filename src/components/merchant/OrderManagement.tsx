import { useState } from "react";
import { useMerchantOrders } from "@/hooks/useMerchantOrders";
import { OrderTable } from "./OrderTable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export const OrderManagement = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const { orders, isLoading } = useMerchantOrders(statusFilter);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All Orders</TabsTrigger>
          <TabsTrigger value="received">New</TabsTrigger>
          <TabsTrigger value="in_process">Processing</TabsTrigger>
          <TabsTrigger value="in_transit">Shipped</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      <OrderTable orders={orders} />
    </div>
  );
};
