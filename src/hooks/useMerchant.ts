import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";

export interface Merchant {
  id: string;
  user_id: string;
  business_name: string;
  business_description: string | null;
  business_logo_url: string | null;
  contact_email: string;
  contact_phone: string | null;
  business_address: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export const useMerchant = () => {
  const { toast } = useToast();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMerchant = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setMerchant(data);
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "loading merchant profile");
    } finally {
      setLoading(false);
    }
  };

  const updateMerchant = async (updates: Partial<Omit<Merchant, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_verified'>>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("merchants")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully"
      });

      await fetchMerchant();
      return true;
    } catch (error: any) {
      showErrorToastLegacy(toast, error, "updating merchant profile");
      return false;
    }
  };

  useEffect(() => {
    fetchMerchant();
  }, []);

  return {
    merchant,
    loading,
    updateMerchant,
    refetch: fetchMerchant
  };
};
