import { CartItem as CartItemType } from "@/hooks/useCart";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";

interface CartItemProps {
  item: CartItemType;
}

export const CartItem = ({ item }: CartItemProps) => {
  const { updateQuantity, removeFromCart } = useCart();

  return (
    <div className="flex gap-4 py-4 border-b">
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-20 h-20 object-cover rounded"
        />
      )}
      <div className="flex-1">
        <h4 className="font-semibold">{item.name}</h4>
        <p className="text-sm text-muted-foreground">
          {item.merchant.business_name}
        </p>
        <p className="text-sm font-medium mt-1">
          KES {item.price.toLocaleString()} / {item.unit}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeFromCart(item.id)}
          className="h-8 w-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => updateQuantity(item.id, item.quantity - 1)}
            className="h-8 w-8"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center">{item.quantity}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => updateQuantity(item.id, item.quantity + 1)}
            disabled={item.quantity >= item.stock_quantity}
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="font-semibold">
          KES {(item.price * item.quantity).toLocaleString()}
        </p>
      </div>
    </div>
  );
};
