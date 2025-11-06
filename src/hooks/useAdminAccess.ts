import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useAdminAccess = () => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Check if user is super admin (pat@goldenforage.com with admin role)
      const { data: isSuperAdmin, error } = await supabase
        .rpc("is_super_admin", { _user_id: user.id });

      if (error) {
        console.error("Error checking super admin status:", error);
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsAdmin(isSuperAdmin || false);
      setIsLoading(false);
    } catch (error) {
      console.error("Error checking admin access:", error);
      setIsAdmin(false);
      setIsLoading(false);
    }
  };

  return { isAdmin, isLoading };
};
