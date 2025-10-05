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

      // Check if user has admin role in user_roles table
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      const hasAdminAccess = roles && roles.length > 0;
      setIsAdmin(hasAdminAccess);
      setIsLoading(false);
      
      if (!hasAdminAccess) {
        toast({
          title: "Access Denied",
          description: "You need admin privileges to access this area.",
          variant: "destructive",
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Error checking admin access:", error);
      setIsAdmin(false);
      setIsLoading(false);
      navigate("/auth/admin");
    }
  };

  return { isAdmin, isLoading };
};
