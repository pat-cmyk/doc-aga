import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketPrice {
  price: number;
  source: "farmer_sale" | "farmer_input" | "regional_aggregate" | "da_bulletin" | "system_default";
  effective_date: string;
}

export interface MarketPriceRecord {
  id: string;
  livestock_type: string;
  region: string | null;
  province: string | null;
  municipality: string | null;
  price_per_kg: number;
  effective_date: string;
  source: string;
  notes: string | null;
  is_verified: boolean;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  farmer_sale: "Your Last Sale",
  farmer_input: "Local Price Input",
  regional_aggregate: "Regional Average",
  da_bulletin: "DA Bulletin",
  system_default: "System Default",
};

const SOURCE_LABELS_TAGALOG: Record<string, string> = {
  farmer_sale: "Huling Benta Mo",
  farmer_input: "Lokal na Presyo",
  regional_aggregate: "Average sa Rehiyon",
  da_bulletin: "DA Bulletin",
  system_default: "Default ng Sistema",
};

export function getSourceLabel(source: string, lang: "en" | "tl" = "en"): string {
  const labels = lang === "tl" ? SOURCE_LABELS_TAGALOG : SOURCE_LABELS;
  return labels[source] || source;
}

export function useCurrentMarketPrice(farmId: string | undefined, livestockType: string | undefined) {
  return useQuery({
    queryKey: ["market-price", farmId, livestockType],
    queryFn: async (): Promise<MarketPrice | null> => {
      if (!farmId || !livestockType) return null;

      const { data, error } = await supabase
        .rpc("get_market_price", {
          p_livestock_type: livestockType,
          p_farm_id: farmId,
        });

      if (error) {
        console.error("Error fetching market price:", error);
        throw error;
      }

      if (data && data.length > 0) {
        return {
          price: data[0].price,
          source: data[0].source as MarketPrice["source"],
          effective_date: data[0].effective_date,
        };
      }

      return null;
    },
    enabled: !!farmId && !!livestockType,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMarketPriceHistory(livestockType: string | undefined, region?: string) {
  return useQuery({
    queryKey: ["market-price-history", livestockType, region],
    queryFn: async (): Promise<MarketPriceRecord[]> => {
      if (!livestockType) return [];

      let query = supabase
        .from("market_prices")
        .select("*")
        .eq("livestock_type", livestockType)
        .order("effective_date", { ascending: false })
        .limit(50);

      if (region) {
        query = query.eq("region", region);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching market price history:", error);
        throw error;
      }

      return (data || []) as MarketPriceRecord[];
    },
    enabled: !!livestockType,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAddLocalPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      livestockType: string;
      pricePerKg: number;
      farmId: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: farm } = await supabase
        .from("farms")
        .select("region, province, municipality")
        .eq("id", params.farmId)
        .single();

      const { error } = await supabase
        .from("market_prices")
        .insert({
          livestock_type: params.livestockType,
          price_per_kg: params.pricePerKg,
          source: "farmer_input",
          reported_by: user.id,
          farm_id: params.farmId,
          region: farm?.region,
          province: farm?.province,
          municipality: farm?.municipality,
          notes: params.notes || "Farmer-reported local market price",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-price"] });
      queryClient.invalidateQueries({ queryKey: ["market-price-history"] });
      queryClient.invalidateQueries({ queryKey: ["herd-valuation"] });
      toast.success("Local price recorded successfully");
    },
    onError: (error) => {
      console.error("Error adding local price:", error);
      toast.error("Failed to record local price");
    },
  });
}
