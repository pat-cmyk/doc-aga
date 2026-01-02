import { useUnifiedPermissions, type FarmRoleInFarm } from "@/contexts/PermissionsContext";

// Re-export types for backward compatibility
export type { FarmRoleInFarm };

interface FarmRoleResult {
  farmId: string;
  roleInFarm: FarmRoleInFarm;
  farmName: string;
  isOwner: boolean;
}

/**
 * @deprecated Use useUnifiedPermissions from @/contexts/PermissionsContext instead.
 * This hook is kept for backward compatibility.
 */
export const useFarmRole = (_specificFarmId?: string) => {
  const permissions = useUnifiedPermissions();

  return {
    farmRoles: permissions.farmRoles,
    primaryFarmRole: permissions.primaryFarmRole,
    hasAnyOwnerRole: permissions.hasAnyOwnerRole,
    isOnlyFarmhand: permissions.isOnlyFarmhand,
    hasFarmAccess: permissions.hasFarmAccess,
    isLoading: permissions.isLoading,
    refetch: permissions.refetch,
  };
};
