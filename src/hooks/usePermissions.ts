import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "./useRole";

export const usePermissions = (farmId: string | undefined) => {
  const { roles, isAdmin } = useRole();
  const [isOwner, setIsOwner] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!farmId) {
        setIsLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Check if user is farm owner
      const { data: farm } = await supabase
        .from('farms')
        .select('owner_id')
        .eq('id', farmId)
        .single();

      setIsOwner(farm?.owner_id === user.id);

      // Check if user is farm manager (farmer_owner role in membership)
      const { data: membership } = await supabase
        .from('farm_memberships')
        .select('role_in_farm')
        .eq('farm_id', farmId)
        .eq('user_id', user.id)
        .eq('invitation_status', 'accepted')
        .single();

      setIsManager(membership?.role_in_farm === 'farmer_owner');
      setIsLoading(false);
    };

    checkPermissions();
  }, [farmId]);

  const isFarmhand = roles.includes('farmhand');
  const canManageTeam = isOwner || isAdmin;
  const canManageFarm = isOwner || isManager || isAdmin;
  const canAddAnimals = isOwner || isManager || isAdmin;
  const canEditAnimals = isOwner || isManager || isAdmin;
  const canDeleteAnimals = isOwner || isAdmin;
  const canViewAnimals = true; // All farm members can view
  const canCreateRecords = isOwner || isManager || isFarmhand || isAdmin;

  return {
    isOwner,
    isManager,
    isFarmhand,
    canManageTeam,
    canManageFarm,
    canAddAnimals,
    canEditAnimals,
    canDeleteAnimals,
    canViewAnimals,
    canCreateRecords,
    isLoading
  };
};
