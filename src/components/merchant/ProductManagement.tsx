import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";
import { ProductList } from "@/components/merchant/ProductList";
import { ProductFormDialog } from "@/components/merchant/ProductFormDialog";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  stock_quantity: number;
  is_active: boolean;
  image_url: string | null;
  category_id: string | null;
  merchant_id: string;
  created_at: string;
  updated_at: string;
}

export const ProductManagement = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in",
          variant: "destructive",
        });
        return;
      }

      // Get merchant ID
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!merchant) {
        toast({
          title: "Error",
          description: "Merchant profile not found",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProducts(data || []);
      setFilteredProducts(data || []);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });

      fetchProducts();
    } catch (error: any) {
      console.error("Error deleting product:", error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: !currentStatus })
        .eq("id", productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Product ${!currentStatus ? "activated" : "deactivated"}`,
      });

      fetchProducts();
    } catch (error: any) {
      console.error("Error updating product:", error);
      toast({
        title: "Error",
        description: "Failed to update product status",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Button onClick={handleAddProduct} className="w-full sm:w-auto min-h-[48px]">
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <ProductList
        products={filteredProducts}
        isLoading={isLoading}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        onToggleActive={handleToggleActive}
      />

      <ProductFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
        onSuccess={fetchProducts}
      />
    </div>
  );
};
