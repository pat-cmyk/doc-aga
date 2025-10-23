import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SystemOverview } from "@/components/admin/SystemOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { FarmOversight } from "@/components/admin/FarmOversight";
import { DocAgaManagement } from "@/components/admin/DocAgaManagement";
import { SystemAdmin } from "@/components/admin/SystemAdmin";
import MerchantOversight from "@/components/admin/MerchantOversight";
import { QADashboard } from "@/components/admin/QADashboard";
import { TabsContent } from "@/components/ui/tabs";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Loader2 } from "lucide-react";

const AdminDashboard = () => {
  const { isAdmin, isLoading } = useAdminAccess();
  const [activeTab, setActiveTab] = useState("overview");

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

  // useAdminAccess hook already redirects if not admin
  // This is just a safety check
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
    </AdminLayout>
  );
};

export default AdminDashboard;
