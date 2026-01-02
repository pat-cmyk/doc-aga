import { useUnifiedPermissions, type GlobalRole, type FarmRoleInFarm, type UserRole } from "@/contexts/PermissionsContext";

// Re-export types for backward compatibility
export type { GlobalRole, FarmRoleInFarm, UserRole };

/**
 * @deprecated Use useUnifiedPermissions from @/contexts/PermissionsContext instead.
 * This hook is kept for backward compatibility.
 */
export const useRole = () => {
  const permissions = useUnifiedPermissions();
  
  return {
    roles: permissions.allRoles,
    globalRoles: permissions.globalRoles,
    isLoading: permissions.isLoading,
    isAdmin: permissions.isAdmin,
    isMerchant: permissions.isMerchant,
    isGovernment: permissions.isGovernment,
    hasGovernmentAccess: permissions.hasGovernmentAccess,
    isDistributor: permissions.isDistributor,
    isFarmer: permissions.isFarmer,
    hasRole: permissions.hasRole,
    hasOnlyGlobalRoles: permissions.hasOnlyGlobalRoles,
  };
};
