import { useCart } from "@/hooks/useCart";
import { Separator } from "@/components/ui/separator";

export const OrderSummary = () => {
  const { cart, getTotalPrice } = useCart();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {cart.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.name} x {item.quantity}
            </span>
            <span>PHP {(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
      </div>
      
      <Separator />
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>PHP {getTotalPrice().toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-semibold text-lg">
          <span>Total</span>
          <span>PHP {getTotalPrice().toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
