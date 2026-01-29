import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { CameraPhotoInput } from "@/components/ui/camera-photo-input";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

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
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess: () => void;
}

export const ProductFormDialog = ({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ProductFormDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const isOnline = useOnlineStatus();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("kg");
  const [stockQuantity, setStockQuantity] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || "");
      setPrice(product.price.toString());
      setUnit(product.unit);
      setStockQuantity(product.stock_quantity.toString());
      setIsActive(product.is_active);
      setImageUrl(product.image_url || "");
      setCategoryId(product.category_id || "");
    } else {
      resetForm();
    }
  }, [product, open]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setUnit("kg");
    setStockQuantity("");
    setIsActive(true);
    setImageUrl("");
    setCategoryId("");
  };

  const handleImageUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      setImageUrl(data.publicUrl);

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !price || !stockQuantity) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get merchant ID
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!merchant) throw new Error("Merchant not found");

      const productData = {
        name,
        description: description || null,
        price: parseFloat(price),
        unit,
        stock_quantity: parseFloat(stockQuantity),
        is_active: isActive,
        image_url: imageUrl || null,
        category_id: categoryId || null,
        merchant_id: merchant.id,
      };

      if (product) {
        // Update existing product
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        // Create new product
        const { error } = await supabase
          .from("products")
          .insert(productData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Product created successfully",
        });
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save product",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription>
            {product
              ? "Update your product information"
              : "Fill in the details to create a new product"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product Image */}
          <div className="space-y-2">
            <Label>Product Image</Label>
            {imageUrl ? (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <img src={imageUrl} alt="Product" className="object-cover w-full h-full" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => setImageUrl("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <CameraPhotoInput
                  onPhotoSelected={handleImageUpload}
                  onError={(error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" })}
                  variant="outline"
                  label={isUploadingImage ? "Uploading..." : "Upload Image"}
                  disabled={isUploadingImage}
                  className="mx-auto"
                />
              </div>
            )}
          </div>

          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Organic Fertilizer"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <div className="flex gap-2">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your product..."
                rows={3}
                className="flex-1"
              />
              <VoiceInputButton
                onTranscription={(text) => setDescription(prev => prev ? `${prev} ${text}` : text)}
                disabled={!isOnline}
                className="self-start"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (₱) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit *</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogram (kg)</SelectItem>
                  <SelectItem value="liter">Liter (L)</SelectItem>
                  <SelectItem value="piece">Piece (pc)</SelectItem>
                  <SelectItem value="bag">Bag</SelectItem>
                  <SelectItem value="bottle">Bottle</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stock Quantity */}
          <div className="space-y-2">
            <Label htmlFor="stock">Stock Quantity *</Label>
            <Input
              id="stock"
              type="number"
              step="0.01"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              placeholder="0"
              required
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Make this product visible in the marketplace
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isUploadingImage}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
