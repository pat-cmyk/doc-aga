import { ReactNode, useState } from "react";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useRole } from "@/hooks/useRole";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Building2, MessageSquare, Activity, Store, TestTube, BarChart3, ScrollText } from "lucide-react";
import { UserEmailDropdown } from "@/components/UserEmailDropdown";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { AdminGlobalSearch } from "./AdminGlobalSearch";
import { FarmDetailPanel } from "./FarmDetailPanel";
import { useNavigate } from "react-router-dom";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminLayout = ({ children, activeTab, onTabChange }: AdminLayoutProps) => {
  const { isLoading } = useAdminAccess();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [selectedFarmName, setSelectedFarmName] = useState("");

  const handleSelectFarm = (farmId: string, farmName: string) => {
    setSelectedFarmId(farmId);
    setSelectedFarmName(farmName);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">System Administration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AdminGlobalSearch onSelectFarm={handleSelectFarm} />
            <NetworkStatusIndicator />
            <UserEmailDropdown />
          </div>
        </div>
      </header>

      <FarmDetailPanel
        farmId={selectedFarmId}
        farmName={selectedFarmName}
        open={selectedFarmId !== null}
        onOpenChange={(open) => !open && setSelectedFarmId(null)}
        onEditFarm={() => {
          onTabChange("farms");
          setSelectedFarmId(null);
        }}
        onViewAsFarmer={() => {
          if (selectedFarmId) {
            navigate(`/admin/view-farm/${selectedFarmId}`);
          }
        }}
      />

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className="grid w-full auto-cols-auto grid-flow-col">
            {isAdmin && (
              <>
                <TabsTrigger value="overview">
                  <Activity className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="users">
                  <Users className="h-4 w-4 mr-2" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="farms">
                  <Building2 className="h-4 w-4 mr-2" />
                  Farms
                </TabsTrigger>
              </>
            )}
            
            {isAdmin && (
              <>
                <TabsTrigger value="docaga">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Doc Aga
                </TabsTrigger>
                <TabsTrigger value="merchants">
                  <Store className="h-4 w-4 mr-2" />
                  Merchants
                </TabsTrigger>
                <TabsTrigger value="qa">
                  <TestTube className="h-4 w-4 mr-2" />
                  QA
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <ScrollText className="h-4 w-4 mr-2" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="system">
                  <Shield className="h-4 w-4 mr-2" />
                  System
                </TabsTrigger>
              </>
            )}
          </TabsList>
          {children}
        </Tabs>
      </div>
    </div>
  );
};
