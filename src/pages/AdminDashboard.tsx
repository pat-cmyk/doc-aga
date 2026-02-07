import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useRole } from "@/hooks/useRole";
import { SystemOverview } from "@/components/admin/SystemOverview";
import { PeopleTab } from "@/components/admin/tabs/PeopleTab";
import { OperationsTab } from "@/components/admin/tabs/OperationsTab";
import { AIVoiceTab } from "@/components/admin/tabs/AIVoiceTab";
import { SystemTab } from "@/components/admin/tabs/SystemTab";
import { TabsContent } from "@/components/ui/tabs";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Loader2 } from "lucide-react";
import { DataCategory, DEFAULT_DATA_CATEGORY } from "@/types/government";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdminAccess();
  const { roles, isLoading: rolesLoading } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialLoad = useRef(true);
  
  const isLoading = adminLoading || rolesLoading;
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dataCategory, setDataCategory] = useState<DataCategory>(() =>
    (searchParams.get("data_source") as DataCategory) || DEFAULT_DATA_CATEGORY
  );

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
    
    const params = new URLSearchParams(searchParams);
    params.set('tab', activeTab);
    params.set('data_source', dataCategory);
    // Clear subtab when switching main tabs
    if (!params.get('subtab')) {
      params.delete('subtab');
    }
    setSearchParams(params, { replace: true });
  }, [activeTab, dataCategory, setSearchParams]);

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
    <AdminLayout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      dataCategory={dataCategory}
      onDataCategoryChange={setDataCategory}
    >
      <TabsContent value="dashboard">
        <SystemOverview dataCategory={dataCategory} />
      </TabsContent>
      
      <TabsContent value="people">
        <PeopleTab />
      </TabsContent>
      
      <TabsContent value="operations">
        <OperationsTab dataCategory={dataCategory} />
      </TabsContent>

      <TabsContent value="ai-voice">
        <AIVoiceTab dataCategory={dataCategory} />
      </TabsContent>
      
      <TabsContent value="system">
        <SystemTab />
      </TabsContent>
    </AdminLayout>
  );
};

export default AdminDashboard;
