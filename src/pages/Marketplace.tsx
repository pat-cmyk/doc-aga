import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, Package } from "lucide-react";
import { useProducts, Product } from "@/hooks/useProducts";
import { ProductCard } from "@/components/marketplace/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { CartDrawer } from "@/components/marketplace/CartDrawer";
import { Badge } from "@/components/ui/badge";
import { AddToCartDialog } from "@/components/marketplace/AddToCartDialog";
import { RouteSeo } from "@/components/seo/RouteSeo";

const Marketplace = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [addToCartDialogOpen, setAddToCartDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { data: products, isLoading } = useProducts(searchQuery);
  const { addToCart, cart } = useCart();
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
    <div className="space-y-4">
      <RouteSeo
        title="Marketplace — Feed, supplies & livestock | Doc Aga"
        description="Browse feed, veterinary supplies, and livestock listings from verified Filipino farm distributors. Shop directly from local sellers in Taglish."
        path="/marketplace"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Doc Aga Marketplace",
          description: "Feed, veterinary supplies, and livestock products from verified Filipino distributors.",
          url: "https://doc-aga.goldenforage.com/marketplace",
        }}
      />

      {/* Actions row — the shell owns the page header (Phase 6) */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setCartOpen(true)}
          className="relative"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Cart
          {cart.length > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {cart.length}
            </Badge>
          )}
        </Button>
        <Button variant="outline" onClick={() => navigate("/orders")}>
          My Orders
        </Button>
      </div>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
      <AddToCartDialog
        open={addToCartDialogOpen}
        onOpenChange={setAddToCartDialogOpen}
        product={selectedProduct}
        onAddToCart={handleAddToCart}
      />

      {/* Search Bar */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for products, feeds, equipment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Main Content */}
      <div className="py-2">
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
      </div>
    </div>
  );
};

export default Marketplace;
