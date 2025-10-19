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

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");

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
