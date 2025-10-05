import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  stock_quantity: number;
  merchant: {
    business_name: string;
    business_logo_url: string | null;
  };
  onOrderClick: (productId: string) => void;
}

export const ProductCard = ({
  id,
  name,
  description,
  price,
  unit,
  image_url,
  stock_quantity,
  merchant,
  onOrderClick,
}: ProductCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="p-0">
        <div className="aspect-square bg-muted relative overflow-hidden">
          {image_url ? (
            <img
              src={image_url}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
          {stock_quantity <= 0 && (
            <Badge className="absolute top-2 right-2" variant="destructive">
              Out of Stock
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-start gap-2 mb-2">
          {merchant.business_logo_url && (
            <img
              src={merchant.business_logo_url}
              alt={merchant.business_name}
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              by {merchant.business_name}
            </p>
          </div>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {description}
          </p>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            PHP {price.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">per {unit}</span>
        </div>
        {stock_quantity > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {stock_quantity} {unit}(s) available
          </p>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full"
          onClick={() => onOrderClick(id)}
          disabled={stock_quantity <= 0}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {stock_quantity > 0 ? "Order Now" : "Out of Stock"}
        </Button>
      </CardFooter>
    </Card>
  );
};
