import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export const useAdminAccess = () => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        navigate("/auth/admin");
        return;
      }

      // Check if user is super admin (pat@goldenforage.com with admin role)
      const { data: isSuperAdmin, error } = await supabase
        .rpc("is_super_admin", { _user_id: user.id });

      if (error) {
        console.error("Error checking super admin status:", error);
        setIsAdmin(false);
        setIsLoading(false);
        navigate("/");
        return;
      }

      setIsAdmin(isSuperAdmin || false);
      setIsLoading(false);
      
      if (!isSuperAdmin) {
        toast({
          title: "Access Denied",
          description: "Only the super admin (pat@goldenforage.com) can access this area.",
          variant: "destructive",
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Error checking admin access:", error);
      setIsAdmin(false);
      setIsLoading(false);
      navigate("/");
    }
  };

  return { isAdmin, isLoading };
};
