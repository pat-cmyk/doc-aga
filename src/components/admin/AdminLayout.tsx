import { ReactNode } from "react";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Building2, MessageSquare, Activity, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminLayout = ({ children, activeTab, onTabChange }: AdminLayoutProps) => {
  const { isLoading } = useAdminAccess();
  const navigate = useNavigate();

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
          <Button variant="outline" onClick={() => navigate("/")}>
            <Home className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
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
            <TabsTrigger value="docaga">
              <MessageSquare className="h-4 w-4 mr-2" />
              Doc Aga
            </TabsTrigger>
            <TabsTrigger value="system">
              <Shield className="h-4 w-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>
          {children}
        </Tabs>
      </div>
    </div>
  );
};
