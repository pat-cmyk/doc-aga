import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

interface OrderConfirmationProps {
  orderNumber: string;
}

export const OrderConfirmation = ({ orderNumber }: OrderConfirmationProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">Order Placed Successfully!</h2>
          <p className="text-muted-foreground">
            Your order <span className="font-semibold">{orderNumber}</span> has been received
            and is being processed.
          </p>
          <p className="text-sm text-muted-foreground">
            You will receive notifications about your order status.
          </p>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate("/marketplace")}
              className="flex-1"
            >
              Continue Shopping
            </Button>
            <Button
              onClick={() => navigate("/orders")}
              className="flex-1"
            >
              View Orders
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
