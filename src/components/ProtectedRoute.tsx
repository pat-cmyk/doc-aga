import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/hooks/useRole";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles: UserRole[];
}

export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuthorization();
  }, []);

  const checkAuthorization = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setIsAuthorized(false);
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", requiredRoles);

    setIsAuthorized(roles && roles.length > 0);
  };

  if (isAuthorized === null) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
