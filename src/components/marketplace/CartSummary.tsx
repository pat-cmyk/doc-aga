import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CartSummaryProps {
  onClose: () => void;
}

export const CartSummary = ({ onClose }: CartSummaryProps) => {
  const { getTotalPrice, getTotalItems } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    onClose();
    navigate("/checkout");
  };

  return (
    <div className="border-t pt-4 space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal ({getTotalItems()} items)</span>
          <span>PHP {getTotalPrice().toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-semibold text-lg">
          <span>Total</span>
          <span>PHP {getTotalPrice().toLocaleString()}</span>
        </div>
      </div>
      <Button
        className="w-full"
        size="lg"
        onClick={handleCheckout}
        disabled={getTotalItems() === 0}
      >
        Proceed to Checkout
      </Button>
    </div>
  );
};
