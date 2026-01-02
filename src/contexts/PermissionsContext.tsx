import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFarm } from "./FarmContext";

// Type definitions
export type GlobalRole = "admin" | "merchant" | "distributor" | "government";
export type FarmRoleInFarm = "farmer_owner" | "farmhand" | "vet";
export type UserRole = GlobalRole | FarmRoleInFarm;

const GLOBAL_ROLES: GlobalRole[] = ["admin", "merchant", "distributor", "government"];

interface FarmRoleResult {
  farmId: string;
  roleInFarm: FarmRoleInFarm;
  farmName: string;
  isOwner: boolean;
}

interface PermissionsContextType {
  // Loading state
  isLoading: boolean;

  // User info
  userId: string | null;

  // Global roles (from user_roles table)
  globalRoles: GlobalRole[];
  allRoles: UserRole[];
  isAdmin: boolean;
  isMerchant: boolean;
  isGovernment: boolean;
  isDistributor: boolean;
  hasGovernmentAccess: boolean;

  // Farm roles (from farm_memberships + ownership)
  farmRoles: FarmRoleResult[];
  currentFarmRole: FarmRoleResult | null;
  primaryFarmRole: FarmRoleResult | null;
  hasAnyOwnerRole: boolean;
  isOnlyFarmhand: boolean;
  hasFarmAccess: boolean;
  isFarmhand: boolean;

  // Farm-specific permissions (for current farm)
  isOwner: boolean;
  isManager: boolean;
  canManageTeam: boolean;
  canManageFarm: boolean;
  canAddAnimals: boolean;
  canEditAnimals: boolean;
  canDeleteAnimals: boolean;
  canViewAnimals: boolean;
  canCreateRecords: boolean;

  // Helpers
  hasRole: (role: UserRole) => boolean;
  hasGlobalRole: (role: GlobalRole) => boolean;
  hasOnlyGlobalRoles: boolean;
  isFarmer: boolean;

  // Actions
  refetch: () => Promise<void>;
}

const initialContextValue: PermissionsContextType = {
  isLoading: true,
  userId: null,
  globalRoles: [],
  allRoles: [],
  isAdmin: false,
  isMerchant: false,
  isGovernment: false,
  isDistributor: false,
  hasGovernmentAccess: false,
  farmRoles: [],
  currentFarmRole: null,
  primaryFarmRole: null,
  hasAnyOwnerRole: false,
  isOnlyFarmhand: false,
  hasFarmAccess: false,
  isFarmhand: false,
  isOwner: false,
  isManager: false,
  canManageTeam: false,
  canManageFarm: false,
  canAddAnimals: false,
  canEditAnimals: false,
  canDeleteAnimals: false,
  canViewAnimals: true,
  canCreateRecords: false,
  hasRole: () => false,
  hasGlobalRole: () => false,
  hasOnlyGlobalRoles: false,
  isFarmer: false,
  refetch: async () => {},
};

const PermissionsContext = createContext<PermissionsContextType>(initialContextValue);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { farmId } = useFarm();
  
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [allRoles, setAllRoles] = useState<UserRole[]>([]);
  const [farmRoles, setFarmRoles] = useState<FarmRoleResult[]>([]);

  const fetchAllPermissions = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setUserId(null);
        setAllRoles([]);
        setFarmRoles([]);
        setIsLoading(false);
        return;
      }

      setUserId(user.id);

      // Fetch all permission data in parallel
      const [rolesResult, membershipsResult, ownedFarmsResult] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase
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
          .eq("invitation_status", "accepted"),
        supabase
          .from("farms")
          .select("id, name, owner_id")
          .eq("owner_id", user.id)
          .eq("is_deleted", false),
      ]);

      // Process user roles
      const roles = (rolesResult.data || []).map(r => r.role as UserRole);
      setAllRoles(roles);

      // Process farm roles
      const processedFarmRoles: FarmRoleResult[] = [];
      const memberships = membershipsResult.data || [];
      const ownedFarms = ownedFarmsResult.data || [];

      // Add owned farms first
      for (const farm of ownedFarms) {
        const existingMembership = memberships.find(m => m.farm_id === farm.id);
        if (!existingMembership) {
          processedFarmRoles.push({
            farmId: farm.id,
            roleInFarm: "farmer_owner",
            farmName: farm.name,
            isOwner: true,
          });
        }
      }

      // Add memberships
      for (const membership of memberships) {
        const farm = membership.farms as unknown as { id: string; name: string; owner_id: string };
        processedFarmRoles.push({
          farmId: membership.farm_id,
          roleInFarm: membership.role_in_farm as FarmRoleInFarm,
          farmName: farm.name,
          isOwner: farm.owner_id === user.id,
        });
      }

      setFarmRoles(processedFarmRoles);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      setAllRoles([]);
      setFarmRoles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    fetchAllPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        fetchAllPermissions();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchAllPermissions]);

  // Derived global role states
  const globalRoles = useMemo(() => 
    allRoles.filter(role => GLOBAL_ROLES.includes(role as GlobalRole)) as GlobalRole[],
    [allRoles]
  );

  const isAdmin = useMemo(() => allRoles.includes("admin"), [allRoles]);
  const isMerchant = useMemo(() => allRoles.includes("merchant"), [allRoles]);
  const isGovernment = useMemo(() => allRoles.includes("government"), [allRoles]);
  const isDistributor = useMemo(() => allRoles.includes("distributor"), [allRoles]);
  const hasGovernmentAccess = isGovernment;
  const isFarmer = useMemo(() => 
    allRoles.includes("farmer_owner") || allRoles.includes("farmhand"),
    [allRoles]
  );
  const hasOnlyGlobalRoles = useMemo(() => 
    allRoles.every(role => GLOBAL_ROLES.includes(role as GlobalRole)),
    [allRoles]
  );

  // Derived farm role states
  const primaryFarmRole = useMemo(() => 
    farmRoles.length > 0 ? farmRoles[0] : null,
    [farmRoles]
  );

  const currentFarmRole = useMemo(() => 
    farmRoles.find(r => r.farmId === farmId) || null,
    [farmRoles, farmId]
  );

  const hasAnyOwnerRole = useMemo(() => 
    farmRoles.some(r => r.isOwner || r.roleInFarm === "farmer_owner"),
    [farmRoles]
  );

  const isOnlyFarmhand = useMemo(() => 
    farmRoles.length > 0 && farmRoles.every(r => r.roleInFarm === "farmhand" && !r.isOwner),
    [farmRoles]
  );

  const hasFarmAccess = useMemo(() => farmRoles.length > 0, [farmRoles]);
  
  const isFarmhand = useMemo(() => 
    currentFarmRole?.roleInFarm === "farmhand",
    [currentFarmRole]
  );

  // Farm-specific permissions (for current farm)
  const farmPermissions = useMemo(() => {
    const isOwner = currentFarmRole?.isOwner ?? false;
    const isManager = currentFarmRole?.roleInFarm === "farmer_owner";
    const isFarmhandRole = currentFarmRole?.roleInFarm === "farmhand";

    return {
      isOwner,
      isManager,
      canManageTeam: isOwner || isAdmin,
      canManageFarm: isOwner || isManager || isAdmin,
      canAddAnimals: isOwner || isManager || isAdmin,
      canEditAnimals: isOwner || isManager || isAdmin,
      canDeleteAnimals: isOwner || isAdmin,
      canViewAnimals: true,
      canCreateRecords: isOwner || isManager || isFarmhandRole || isAdmin,
    };
  }, [currentFarmRole, isAdmin]);

  // Helper functions
  const hasRole = useCallback((role: UserRole) => allRoles.includes(role), [allRoles]);
  const hasGlobalRole = useCallback((role: GlobalRole) => globalRoles.includes(role), [globalRoles]);

  const contextValue = useMemo<PermissionsContextType>(() => ({
    isLoading,
    userId,
    globalRoles,
    allRoles,
    isAdmin,
    isMerchant,
    isGovernment,
    isDistributor,
    hasGovernmentAccess,
    farmRoles,
    currentFarmRole,
    primaryFarmRole,
    hasAnyOwnerRole,
    isOnlyFarmhand,
    hasFarmAccess,
    isFarmhand,
    ...farmPermissions,
    hasRole,
    hasGlobalRole,
    hasOnlyGlobalRoles,
    isFarmer,
    refetch: fetchAllPermissions,
  }), [
    isLoading,
    userId,
    globalRoles,
    allRoles,
    isAdmin,
    isMerchant,
    isGovernment,
    isDistributor,
    hasGovernmentAccess,
    farmRoles,
    currentFarmRole,
    primaryFarmRole,
    hasAnyOwnerRole,
    isOnlyFarmhand,
    hasFarmAccess,
    isFarmhand,
    farmPermissions,
    hasRole,
    hasGlobalRole,
    hasOnlyGlobalRoles,
    isFarmer,
    fetchAllPermissions,
  ]);

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function useUnifiedPermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('useUnifiedPermissions must be used within PermissionsProvider');
  }
  return context;
}

// Backward-compatible alias
export const usePermissionsContext = useUnifiedPermissions;
