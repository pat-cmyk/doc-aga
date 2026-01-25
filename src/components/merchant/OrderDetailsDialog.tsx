import { MerchantOrder } from "@/hooks/useMerchantOrders";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { OrderStatusUpdate } from "./OrderStatusUpdate";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OrderDetailsDialogProps {
  order: MerchantOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export const OrderDetailsDialog = ({ order, open, onOpenChange }: OrderDetailsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Order {order.order_number}</span>
            <Badge className={statusColors[order.status] || "bg-gray-500"}>
              {statusLabels[order.status] || order.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <div className="space-y-6">
            {/* Customer Info */}
            <div>
              <h3 className="font-semibold mb-2">Customer</h3>
              <p>{order.farmer.full_name || "Customer"}</p>
              {order.farmer.phone && (
                <p className="text-sm text-muted-foreground">{order.farmer.phone}</p>
              )}
            </div>

            <Separator />

            {/* Order Items */}
            <div>
              <h3 className="font-semibold mb-3">Items</h3>
              <div className="space-y-3">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    {item.product.image_url && (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} x ₱{item.unit_price.toLocaleString()} / {item.product.unit}
                      </p>
                    </div>
                    <p className="font-semibold">
                      ₱{item.subtotal.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Delivery Info */}
            {order.delivery_address && (
              <>
                <div>
                  <h3 className="font-semibold mb-2">Delivery Address</h3>
                  <p className="text-sm">{order.delivery_address}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Notes */}
            {order.notes && (
              <>
                <div>
                  <h3 className="font-semibold mb-2">Customer Notes</h3>
                  <p className="text-sm text-muted-foreground">{order.notes}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Order Summary */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Order Date</span>
                <span>{format(new Date(order.created_at), "PPP")}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{format(new Date(order.updated_at), "PPP")}</span>
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total Amount</span>
                <span>₱{order.total_amount.toLocaleString()}</span>
              </div>
            </div>

            <Separator />

            {/* Status Update */}
            <OrderStatusUpdate order={order} onClose={() => onOpenChange(false)} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
