import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface MerchantOrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product: {
    name: string;
    image_url: string | null;
    unit: string;
  };
}

export interface MerchantOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  delivery_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  farmer: {
    id: string;
    full_name: string | null;
    phone: string | null;
  };
  order_items: MerchantOrderItem[];
}

export const useMerchantOrders = (statusFilter?: string) => {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["merchant-orders", statusFilter],
    queryFn: async () => {
      // Get current user's merchant ID
      const { data: merchantData } = await supabase
        .from("merchants")
        .select("id")
        .single();

      if (!merchantData) throw new Error("Not a merchant");

      let query = supabase
        .from("orders")
        .select(`
          *,
          order_items(
            *,
            product:products(name, image_url, unit)
          )
        `)
        .eq("merchant_id", merchantData.id)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data: ordersData, error } = await query;

      if (error) throw error;

      // Get farmer details separately for each order
      const ordersWithFarmers = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: farmer } = await supabase
            .from("profiles")
            .select("id, full_name, phone")
            .eq("id", order.farmer_id)
            .single();

          return {
            ...order,
            farmer: farmer || { id: order.farmer_id, full_name: null, phone: null },
          };
        })
      );

      return ordersWithFarmers as MerchantOrder[];
    },
  });

  // Subscribe to realtime order updates
  useEffect(() => {
    const channel = supabase
      .channel("merchant-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: status as any, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
    },
  });

  return {
    orders: orders || [],
    isLoading,
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
  };
};
