import { ReactNode, useState } from "react";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useRole } from "@/hooks/useRole";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Users, Building2, MessageSquare, LayoutDashboard, Database } from "lucide-react";
import { UserEmailDropdown } from "@/components/UserEmailDropdown";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { AdminGlobalSearch } from "./AdminGlobalSearch";
import { FarmDetailPanel } from "./FarmDetailPanel";
import { useNavigate } from "react-router-dom";
import { DataCategory } from "@/types/government";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  dataCategory: DataCategory;
  onDataCategoryChange: (category: DataCategory) => void;
}

export const AdminLayout = ({ children, activeTab, onTabChange, dataCategory, onDataCategoryChange }: AdminLayoutProps) => {
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
            <Select value={dataCategory} onValueChange={(value) => onDataCategoryChange(value as DataCategory)}>
              <SelectTrigger className="w-[130px]">
                <Database className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Live Data
                  </div>
                </SelectItem>
                <SelectItem value="demo">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Demo Data
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-gray-500" />
                    All Data
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
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
          onTabChange("operations");
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
          <TabsList className="grid w-full grid-cols-5">
            {isAdmin && (
              <>
                <TabsTrigger value="dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="people">
                  <Users className="h-4 w-4 mr-2" />
                  People
                </TabsTrigger>
                <TabsTrigger value="operations">
                  <Building2 className="h-4 w-4 mr-2" />
                  Operations
                </TabsTrigger>
                <TabsTrigger value="ai-voice">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  AI & Voice
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
