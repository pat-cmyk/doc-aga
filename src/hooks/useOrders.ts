import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrderItem {
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

export interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  delivery_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  merchant: {
    id: string;
    business_name: string;
    business_logo_url: string | null;
    contact_phone: string | null;
  };
  order_items: OrderItem[];
}

export const useOrders = (statusFilter?: string) => {
  return useQuery({
    queryKey: ["orders", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(`
          *,
          merchant:merchants!inner(
            id,
            business_name,
            business_logo_url,
            contact_phone
          ),
          order_items(
            *,
            product:products(name, image_url, unit)
          )
        `)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Order[];
    },
  });
};
