import { useState } from "react";
import { MerchantOrder } from "@/hooks/useMerchantOrders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderDetailsDialog } from "./OrderDetailsDialog";
import { format } from "date-fns";
import { Eye } from "lucide-react";

interface OrderTableProps {
  orders: MerchantOrder[];
}

const statusColors: Record<string, string> = {
  received: "bg-blue-500",
  in_process: "bg-yellow-500",
  in_transit: "bg-purple-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  received: "New",
  in_process: "Processing",
  in_transit: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const OrderTable = ({ orders }: OrderTableProps) => {
  const [selectedOrder, setSelectedOrder] = useState<MerchantOrder | null>(null);

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No orders found</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Order #</TableHead>
              <TableHead className="whitespace-nowrap">Customer</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="whitespace-nowrap">Items</TableHead>
              <TableHead className="whitespace-nowrap">Total</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium whitespace-nowrap">{order.order_number}</TableCell>
                <TableCell className="whitespace-nowrap">{order.farmer.full_name || "Customer"}</TableCell>
                <TableCell className="whitespace-nowrap">{format(new Date(order.created_at), "MMM dd, yyyy")}</TableCell>
                <TableCell>{order.order_items.length}</TableCell>
                <TableCell className="whitespace-nowrap">KES {order.total_amount.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge className={statusColors[order.status] || "bg-gray-500"}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedOrder(order)}
                    className="min-h-[44px] whitespace-nowrap"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedOrder && (
        <OrderDetailsDialog
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
        />
      )}
    </>
  );
};
