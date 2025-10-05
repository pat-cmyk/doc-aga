import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { DeliveryForm } from "@/components/checkout/DeliveryForm";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { OrderConfirmation } from "@/components/checkout/OrderConfirmation";
import { useToast } from "@/hooks/use-toast";

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, getTotalPrice, clearCart } = useCart();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a delivery address",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Group cart items by merchant
      const merchantOrders = cart.reduce((acc, item) => {
        const merchantId = item.merchant.id;
        if (!acc[merchantId]) {
          acc[merchantId] = [];
        }
        acc[merchantId].push(item);
        return acc;
      }, {} as Record<string, typeof cart>);

      // Create separate order for each merchant
      for (const [merchantId, items] of Object.entries(merchantOrders)) {
        const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // Generate order number
        const { data: orderNumberData, error: orderNumberError } = await supabase
          .rpc('generate_order_number');
        
        if (orderNumberError) throw orderNumberError;

        // Create order
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            farmer_id: user.id,
            merchant_id: merchantId,
            order_number: orderNumberData,
            total_amount: totalAmount,
            delivery_address: deliveryAddress,
            notes: notes || null,
            status: "received",
          })
          .select()
          .single();

        if (orderError) throw orderError;
        setOrderNumber(orderNumberData);

        // Create order items
        const orderItems = items.map((item) => ({
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.price * item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      clearCart();
      toast({
        title: "Order Placed Successfully!",
        description: "You will receive updates on your order status",
      });
    } catch (error: any) {
      console.error("Order placement error:", error);
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (orderNumber) {
    return <OrderConfirmation orderNumber={orderNumber} />;
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Marketplace
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-4">
                Add some products to your cart before checking out
              </p>
              <Button onClick={() => navigate("/marketplace")}>
                Continue Shopping
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Marketplace
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Information</CardTitle>
              </CardHeader>
              <CardContent>
                <DeliveryForm
                  deliveryAddress={deliveryAddress}
                  setDeliveryAddress={setDeliveryAddress}
                  notes={notes}
                  setNotes={setNotes}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderSummary />
                <Button
                  className="w-full mt-6 min-h-[48px]"
                  size="lg"
                  onClick={handlePlaceOrder}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Place Order"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
