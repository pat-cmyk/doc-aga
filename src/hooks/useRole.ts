import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global roles that are app-level access (NOT farm-specific)
export type GlobalRole = "admin" | "merchant" | "distributor" | "government";

// Farm-specific roles (should primarily use farm_memberships.role_in_farm)
export type FarmRole = "farmer_owner" | "farmhand" | "vet";

// All possible roles in user_roles table
export type UserRole = GlobalRole | FarmRole;

// Roles that should be checked in user_roles for routing
const GLOBAL_ROLES: GlobalRole[] = ["admin", "merchant", "distributor", "government"];

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

  // Filter to only global roles (for routing decisions)
  const globalRoles = roles.filter(role => GLOBAL_ROLES.includes(role as GlobalRole)) as GlobalRole[];

  return {
    roles,
    globalRoles,
    isLoading,
    // Global role checks (use these for app-level routing)
    isAdmin: roles.includes("admin"),
    isMerchant: roles.includes("merchant"),
    isGovernment: roles.includes("government"),
    hasGovernmentAccess: roles.includes("government"),
    isDistributor: roles.includes("distributor"),
    // Legacy helpers - NOTE: For farm-specific access, prefer useFarmRole hook
    isFarmer: roles.includes("farmer_owner") || roles.includes("farmhand"),
    hasRole: (role: UserRole) => roles.includes(role),
    // Helper to check if user has ONLY global roles (no farm roles in user_roles)
    hasOnlyGlobalRoles: roles.every(role => GLOBAL_ROLES.includes(role as GlobalRole)),
  };
};
