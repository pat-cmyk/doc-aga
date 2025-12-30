import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FarmRoleInFarm = "farmer_owner" | "farmhand" | "vet";

interface FarmRoleResult {
  farmId: string;
  roleInFarm: FarmRoleInFarm;
  farmName: string;
  isOwner: boolean; // True if user is the farm owner (farms.owner_id)
}

export const useFarmRole = (specificFarmId?: string) => {
  const [farmRoles, setFarmRoles] = useState<FarmRoleResult[]>([]);
  const [primaryFarmRole, setPrimaryFarmRole] = useState<FarmRoleResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFarmRoles();
  }, [specificFarmId]);

  const fetchFarmRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setFarmRoles([]);
        setPrimaryFarmRole(null);
        setIsLoading(false);
        return;
      }

      // Get all farm memberships for this user
      let query = supabase
        .from("farm_memberships")
        .select(`
          farm_id,
          role_in_farm,
          farms!inner (
            id,
            name,
            owner_id
          )
        `)
        .eq("user_id", user.id)
        .eq("invitation_status", "accepted");

      if (specificFarmId) {
        query = query.eq("farm_id", specificFarmId);
      }

      const { data: memberships, error } = await query;

      if (error) {
        console.error("Error fetching farm roles:", error);
        setFarmRoles([]);
        setPrimaryFarmRole(null);
        setIsLoading(false);
        return;
      }

      // Also check for farms the user owns directly
      const { data: ownedFarms } = await supabase
        .from("farms")
        .select("id, name, owner_id")
        .eq("owner_id", user.id)
        .eq("is_deleted", false);

      const roles: FarmRoleResult[] = [];

      // Add owned farms first
      if (ownedFarms) {
        for (const farm of ownedFarms) {
          // Check if already in memberships to avoid duplicates
          const existingMembership = memberships?.find(m => m.farm_id === farm.id);
          if (!existingMembership) {
            roles.push({
              farmId: farm.id,
              roleInFarm: "farmer_owner",
              farmName: farm.name,
              isOwner: true,
            });
          }
        }
      }

      // Add memberships
      if (memberships) {
        for (const membership of memberships) {
          const farm = membership.farms as unknown as { id: string; name: string; owner_id: string };
          roles.push({
            farmId: membership.farm_id,
            roleInFarm: membership.role_in_farm as FarmRoleInFarm,
            farmName: farm.name,
            isOwner: farm.owner_id === user.id,
          });
        }
      }

      setFarmRoles(roles);
      setPrimaryFarmRole(roles.length > 0 ? roles[0] : null);
    } catch (error) {
      console.error("Error in fetchFarmRoles:", error);
      setFarmRoles([]);
      setPrimaryFarmRole(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to check if user has any farm owner role (either owns farm or has farmer_owner membership)
  const hasAnyOwnerRole = farmRoles.some(r => r.isOwner || r.roleInFarm === "farmer_owner");
  
  // Helper to check if user is ONLY a farmhand (no owner roles)
  const isOnlyFarmhand = farmRoles.length > 0 && 
    farmRoles.every(r => r.roleInFarm === "farmhand" && !r.isOwner);

  // Helper to check if user has any farm association
  const hasFarmAccess = farmRoles.length > 0;

  return {
    farmRoles,
    primaryFarmRole,
    hasAnyOwnerRole,
    isOnlyFarmhand,
    hasFarmAccess,
    isLoading,
    refetch: fetchFarmRoles,
  };
};
