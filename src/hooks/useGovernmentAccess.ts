import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export const useGovernmentAccess = () => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkGovernmentAccess();
  }, []);

  const checkGovernmentAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setHasAccess(false);
        setIsLoading(false);
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "government"]);

      const hasGovernmentAccess = roles && roles.length > 0;
      setHasAccess(hasGovernmentAccess);
      setIsLoading(false);
      
      if (!hasGovernmentAccess) {
        toast({
          title: "Access Denied",
          description: "Government dashboard access requires Admin or Government role.",
          variant: "destructive",
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Error checking government access:", error);
      setHasAccess(false);
      setIsLoading(false);
      navigate("/");
    }
  };

  return { hasAccess, isLoading };
};
