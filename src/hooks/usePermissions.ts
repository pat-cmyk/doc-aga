import { useUnifiedPermissions } from "@/contexts/PermissionsContext";

/**
 * @deprecated Use useUnifiedPermissions from @/contexts/PermissionsContext instead.
 * This hook is kept for backward compatibility.
 */
export const usePermissions = (_farmId: string | undefined) => {
  const permissions = useUnifiedPermissions();
  
  return {
    isOwner: permissions.isOwner,
    isManager: permissions.isManager,
    isFarmhand: permissions.isFarmhand,
    canManageTeam: permissions.canManageTeam,
    canManageFarm: permissions.canManageFarm,
    canAddAnimals: permissions.canAddAnimals,
    canEditAnimals: permissions.canEditAnimals,
    canDeleteAnimals: permissions.canDeleteAnimals,
    canViewAnimals: permissions.canViewAnimals,
    canCreateRecords: permissions.canCreateRecords,
    isLoading: permissions.isLoading,
  };
};
