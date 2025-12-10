import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import FarmDashboard from "@/components/FarmDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const AdminViewFarm = () => {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdminAccess();

  const { data: farm, isLoading: farmLoading } = useQuery({
    queryKey: ["admin-view-farm", farmId],
    queryFn: async () => {
      if (!farmId) throw new Error("No farm ID provided");
      const { data, error } = await supabase
        .from("farms")
        .select(`
          *,
          profiles:owner_id (full_name, email)
        `)
        .eq("id", farmId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!farmId && !adminLoading && isAdmin,
  });

  if (adminLoading || farmLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/admin");
    return null;
  }

  if (!farm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Farm not found</p>
          <Button onClick={() => navigate("/admin?tab=farms")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Banner */}
      <div className="sticky top-0 z-50 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5" />
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span className="font-medium">Admin View Mode</span>
              <span className="text-primary-foreground/80">|</span>
              <span>{farm.name}</span>
              <span className="text-primary-foreground/60 text-sm">
                (Owner: {(farm.profiles as { full_name: string })?.full_name || "Unknown"})
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate("/admin?tab=farms")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Exit View Mode
          </Button>
        </div>
      </div>

      {/* Read-Only Alert */}
      <div className="container mx-auto px-4 py-2">
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            You are viewing this farm dashboard in <strong>read-only mode</strong>. 
            All interactions are disabled. To make changes, use the Admin Farm Editing tools.
          </AlertDescription>
        </Alert>
      </div>

      {/* Farm Dashboard - Read Only */}
      <div className="pointer-events-none opacity-95">
        <FarmDashboard farmId={farmId!} />
      </div>
    </div>
  );
};

export default AdminViewFarm;
