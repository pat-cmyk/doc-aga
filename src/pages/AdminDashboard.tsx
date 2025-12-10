import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useRole } from "@/hooks/useRole";
import { SystemOverview } from "@/components/admin/SystemOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { FarmOversight } from "@/components/admin/FarmOversight";
import { DocAgaManagement } from "@/components/admin/DocAgaManagement";
import { SystemAdmin } from "@/components/admin/SystemAdmin";
import MerchantOversight from "@/components/admin/MerchantOversight";
import { QADashboard } from "@/components/admin/QADashboard";
import { UserActivityLogs } from "@/components/admin/UserActivityLogs";
import { SupportTicketsTab } from "@/components/admin/SupportTicketsTab";
import { TabsContent } from "@/components/ui/tabs";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isLoading: adminLoading } = useAdminAccess();
  const { roles, isLoading: rolesLoading } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialLoad = useRef(true);
  
  const isLoading = adminLoading || rolesLoading;
  
  const [activeTab, setActiveTab] = useState("overview");


  // Initialize state from URL params on mount
  useEffect(() => {
    if (!isInitialLoad.current) return;
    
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
    
    isInitialLoad.current = false;
  }, [searchParams]);

  // Sync state to URL params
  useEffect(() => {
    if (isInitialLoad.current) return;
    
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    setSearchParams(params, { replace: true });
  }, [activeTab, setSearchParams]);


  // Smart routing based on all user roles
  useEffect(() => {
    if (isLoading) return;
    
    if (!isAdmin) {
      // User doesn't have admin access - redirect based on available roles
      if (roles.includes("government")) {
        navigate("/government");
      } else if (roles.includes("merchant")) {
        navigate("/merchant");
      } else if (roles.includes("farmhand")) {
        navigate("/farmhand");
      } else if (roles.includes("farmer_owner")) {
        navigate("/");
      } else {
        navigate("/");
      }
    }
  }, [isAdmin, roles, isLoading, navigate]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If not admin, return null (redirect happens in useEffect)
  if (!isAdmin) {
    return null;
  }

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <TabsContent value="overview">
        <SystemOverview />
      </TabsContent>
      
      <TabsContent value="users">
        <UserManagement />
      </TabsContent>
      
      <TabsContent value="farms">
        <FarmOversight />
      </TabsContent>

      <TabsContent value="tickets">
        <SupportTicketsTab />
      </TabsContent>
      
      <TabsContent value="docaga">
        <DocAgaManagement />
      </TabsContent>
      
      <TabsContent value="merchants">
        <MerchantOversight />
      </TabsContent>
      
      <TabsContent value="qa">
        <QADashboard />
      </TabsContent>
      
      <TabsContent value="system">
        <SystemAdmin />
      </TabsContent>

      <TabsContent value="activity">
        <UserActivityLogs />
      </TabsContent>
    </AdminLayout>
  );
};

export default AdminDashboard;
