import { MerchantOrder, useMerchantOrders } from "@/hooks/useMerchantOrders";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface OrderStatusUpdateProps {
  order: MerchantOrder;
  onClose: () => void;
}

export const OrderStatusUpdate = ({ order, onClose }: OrderStatusUpdateProps) => {
  const { updateStatus, isUpdating } = useMerchantOrders();
  const { toast } = useToast();

  const handleStatusUpdate = (newStatus: string) => {
    updateStatus(
      { orderId: order.id, status: newStatus },
      {
        onSuccess: () => {
          toast({
            title: "Status Updated",
            description: `Order status changed to ${newStatus}`,
          });
          onClose();
        },
        onError: (error: any) => {
          toast({
            title: "Update Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const getAvailableActions = () => {
    switch (order.status) {
      case "received":
        return [
          { label: "Start Processing", status: "in_process", variant: "default" as const },
          { label: "Cancel Order", status: "cancelled", variant: "destructive" as const },
        ];
      case "in_process":
        return [
          { label: "Mark as Shipped", status: "in_transit", variant: "default" as const },
          { label: "Cancel Order", status: "cancelled", variant: "destructive" as const },
        ];
      case "in_transit":
        return [
          { label: "Confirm Delivery", status: "delivered", variant: "default" as const },
        ];
      default:
        return [];
    }
  };

  const actions = getAvailableActions();

  if (actions.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="font-semibold mb-3">Update Order Status</h3>
      <div className="flex gap-2">
        {actions.map((action) => (
          <Button
            key={action.status}
            variant={action.variant}
            onClick={() => handleStatusUpdate(action.status)}
            disabled={isUpdating}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
