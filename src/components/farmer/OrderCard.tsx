import { useState } from "react";
import { Order } from "@/hooks/useOrders";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderDetails } from "./OrderDetails";
import { format } from "date-fns";

interface OrderCardProps {
  order: Order;
}

const statusColors: Record<string, string> = {
  received: "bg-blue-500",
  in_process: "bg-yellow-500",
  in_transit: "bg-purple-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  received: "Received",
  in_process: "Processing",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const OrderCard = ({ order }: OrderCardProps) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowDetails(true)}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{order.order_number}</h3>
              <p className="text-sm text-muted-foreground">
                {order.merchant.business_name}
              </p>
            </div>
            <Badge className={statusColors[order.status] || "bg-gray-500"}>
              {statusLabels[order.status] || order.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order Date</span>
              <span>{format(new Date(order.created_at), "MMM dd, yyyy")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span>{order.order_items.length} products</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>KES {order.total_amount.toLocaleString()}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-4" onClick={(e) => {
            e.stopPropagation();
            setShowDetails(true);
          }}>
            View Details
          </Button>
        </CardContent>
      </Card>

      <OrderDetails
        order={order}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
};
