import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useGovernmentAccess = () => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkGovernmentAccess();
  }, []);

  const checkGovernmentAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "government");

      const hasGovernmentAccess = roles && roles.length > 0;
      setHasAccess(hasGovernmentAccess);
      setIsLoading(false);
    } catch (error) {
      console.error("Error checking government access:", error);
      setHasAccess(false);
      setIsLoading(false);
    }
  };

  return { hasAccess, isLoading };
};
