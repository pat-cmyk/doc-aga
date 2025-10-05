import { Order } from "@/hooks/useOrders";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface OrderDetailsProps {
  order: Order;
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
  received: "Received",
  in_process: "Processing",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const OrderDetails = ({ order, open, onOpenChange }: OrderDetailsProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
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
            {/* Merchant Info */}
            <div>
              <h3 className="font-semibold mb-2">Merchant</h3>
              <p>{order.merchant.business_name}</p>
              {order.merchant.contact_phone && (
                <p className="text-sm text-muted-foreground">
                  {order.merchant.contact_phone}
                </p>
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
                        {item.quantity} x PHP {item.unit_price.toLocaleString()} / {item.product.unit}
                      </p>
                    </div>
                    <p className="font-semibold">
                      PHP {item.subtotal.toLocaleString()}
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
                  <h3 className="font-semibold mb-2">Order Notes</h3>
                  <p className="text-sm text-muted-foreground">{order.notes}</p>
                </div>
                <Separator />
              </>
            )}

            {/* Summary */}
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
                <span>PHP {order.total_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
