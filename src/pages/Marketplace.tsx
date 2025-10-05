import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, ArrowLeft, Package } from "lucide-react";
import { useProducts, Product } from "@/hooks/useProducts";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { CartDrawer } from "@/components/marketplace/CartDrawer";
import { Badge } from "@/components/ui/badge";
import { AddToCartDialog } from "@/components/marketplace/AddToCartDialog";

const Marketplace = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [addToCartDialogOpen, setAddToCartDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { data: products, isLoading } = useProducts(searchQuery);
  const { addToCart, getTotalItems } = useCart();
  const { toast } = useToast();

  const handleOrderClick = (productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      if (product.stock_quantity <= 0) {
        toast({
          title: "Out of Stock",
          description: "This product is currently unavailable",
          variant: "destructive",
        });
        return;
      }
      setSelectedProduct(product);
      setAddToCartDialogOpen(true);
    }
  };

  const handleAddToCart = (quantity: number) => {
    if (selectedProduct) {
      addToCart(selectedProduct, quantity);
      toast({
        title: "Added to Cart",
        description: `${quantity} x ${selectedProduct.name} added to your cart`,
      });
      setCartOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="shrink-0 min-h-[44px]">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <h1 className="text-lg sm:text-2xl font-bold truncate">Marketplace</h1>
            </div>
            <div className="flex gap-1 sm:gap-2 shrink-0">
              <Button 
                variant="outline" 
                onClick={() => setCartOpen(true)} 
                className="relative min-h-[44px] px-3 sm:px-4"
              >
                <ShoppingCart className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cart</span>
                {getTotalItems() > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {getTotalItems()}
                  </Badge>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/orders")}
                className="hidden sm:flex min-h-[44px]"
              >
                My Orders
              </Button>
            </div>
          </div>
        </div>
      </header>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
      <AddToCartDialog
        open={addToCartDialogOpen}
        onOpenChange={setAddToCartDialogOpen}
        product={selectedProduct}
        onAddToCart={handleAddToCart}
      />

      {/* Search Bar */}
      <div className="container mx-auto px-4 py-6">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for products, feeds, equipment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                {...product}
                onOrderClick={handleOrderClick}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search terms"
                : "No products are currently available"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Marketplace;
