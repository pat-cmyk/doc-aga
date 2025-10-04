import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  stock_quantity: number;
  is_active: boolean;
  merchant: {
    id: string;
    business_name: string;
    business_logo_url: string | null;
  };
}

export const useProducts = (searchQuery?: string) => {
  return useQuery({
    queryKey: ["products", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          `
          id,
          name,
          description,
          price,
          unit,
          image_url,
          stock_quantity,
          is_active,
          merchant:merchants!inner(
            id,
            business_name,
            business_logo_url,
            is_verified
          )
        `
        )
        .eq("is_active", true)
        .eq("merchant.is_verified", true)
        .order("created_at", { ascending: false });

      if (searchQuery && searchQuery.trim() !== "") {
        query = query.or(
          `name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data as any[]).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        unit: item.unit,
        image_url: item.image_url,
        stock_quantity: item.stock_quantity,
        is_active: item.is_active,
        merchant: item.merchant,
      })) as Product[];
    },
  });
};
