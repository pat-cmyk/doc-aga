import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

export const SuperAdminRoute = ({ children }: SuperAdminRouteProps) => {
  const [status, setStatus] = useState<"checking" | "authorized" | "unauthorized">("checking");
  const [redirect, setRedirect] = useState<string>("/");

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRedirect("/auth/admin");
        setStatus("unauthorized");
        return;
      }

      // Fast role check to route non-admins away immediately
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleList = (roles || []).map((r: any) => r.role);

      // Super admin verification via RPC
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (isSuperAdmin) {
        setStatus("authorized");
        return;
      }

      // Compute best fallback
      if (roleList.includes("government")) setRedirect("/government");
      else if (roleList.includes("merchant")) setRedirect("/merchant");
      else if (roleList.includes("farmhand")) setRedirect("/farmhand");
      else setRedirect("/");

      setStatus("unauthorized");
    };
    check();
  }, []);

  if (status === "checking") {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (status === "unauthorized") {
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
};
