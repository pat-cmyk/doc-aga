import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface MerchantProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  image_url: string | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useMerchantProducts = () => {
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["merchant-products"],
    queryFn: async () => {
      // Get current user's merchant ID
      const { data: merchantData } = await supabase
        .from("merchants")
        .select("id")
        .single();

      if (!merchantData) throw new Error("Not a merchant");

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("merchant_id", merchantData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data as MerchantProduct[];
    },
  });

  // Subscribe to realtime product updates
  useEffect(() => {
    const channel = supabase
      .channel("merchant-products")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["merchant-products"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    products: products || [],
    isLoading,
  };
};
