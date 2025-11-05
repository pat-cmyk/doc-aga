import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "farmer_owner" | "farmhand" | "merchant" | "distributor" | "vet" | "government";

export const useRole = () => {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setRoles([]);
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      setRoles((data || []).map(r => r.role as UserRole));
    } catch (error) {
      console.error("Error fetching roles:", error);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    roles,
    isLoading,
    isMerchant: roles.includes("merchant"),
    isFarmer: roles.includes("farmer_owner") || roles.includes("farmhand"),
    isAdmin: roles.includes("admin"),
    isGovernment: roles.includes("government"),
    hasGovernmentAccess: roles.includes("admin") || roles.includes("government"),
    hasRole: (role: UserRole) => roles.includes(role),
  };
};
