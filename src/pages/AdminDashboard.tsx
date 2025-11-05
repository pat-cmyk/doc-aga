import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SystemOverview } from "@/components/admin/SystemOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { FarmOversight } from "@/components/admin/FarmOversight";
import { DocAgaManagement } from "@/components/admin/DocAgaManagement";
import { SystemAdmin } from "@/components/admin/SystemAdmin";
import MerchantOversight from "@/components/admin/MerchantOversight";
import { QADashboard } from "@/components/admin/QADashboard";
import { GovDashboardOverview } from "@/components/government/GovDashboardOverview";
import { AnimalHealthHeatmap } from "@/components/government/AnimalHealthHeatmap";
import { FarmerQueriesTopics } from "@/components/government/FarmerQueriesTopics";
import { useGovernmentStats, useHealthHeatmap } from "@/hooks/useGovernmentStats";
import { TabsContent } from "@/components/ui/tabs";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Loader2 } from "lucide-react";
import { subDays } from "date-fns";

const AdminDashboard = () => {
  const { isAdmin, isLoading } = useAdminAccess();
  const [activeTab, setActiveTab] = useState("overview");

  // Government dashboard data
  const startDate = subDays(new Date(), 30);
  const endDate = new Date();
  const { data: govStats, isLoading: govStatsLoading } = useGovernmentStats(startDate, endDate);
  const { data: heatmapData, isLoading: heatmapLoading } = useHealthHeatmap(7);

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

      <TabsContent value="government">
        <div className="space-y-6">
          <GovDashboardOverview stats={govStats} isLoading={govStatsLoading} />
          <div className="grid gap-6 md:grid-cols-2">
            <AnimalHealthHeatmap data={heatmapData} isLoading={heatmapLoading} />
            <FarmerQueriesTopics startDate={startDate} endDate={endDate} />
          </div>
        </div>
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
