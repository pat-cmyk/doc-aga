import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import FarmDashboard from "@/components/FarmDashboard";
import AnimalList from "@/components/AnimalList";
import { FeedInventoryTab } from "@/components/FeedInventoryTab";
import { MilkInventoryTab } from "@/components/milk-inventory/MilkInventoryTab";
import { FinanceTab } from "@/components/FinanceTab";
import { FarmerFeedbackList } from "@/components/farmer/FarmerFeedbackList";
import { PendingActivitiesQueue } from "@/components/approval/PendingActivitiesQueue";
import { BreedingHub } from "@/components/breeding/BreedingHub";
import { BarnListView } from "@/components/barns/BarnListView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Eye, Shield, LayoutDashboard, PawPrint, Settings2, Wallet, MoreHorizontal, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const AdminViewFarm = () => {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdminAccess();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [operationsSubtab, setOperationsSubtab] = useState("milk");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | undefined>(undefined);
  const isMobile = useIsMobile();

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

  // Navigation callback for cross-tab animal navigation (from FarmDashboard/BreedingHub)
  const handleNavigateToAnimalDetails = (animalId: string) => {
    setSelectedAnimalId(animalId);
    setActiveTab("animals");
  };

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
              <span className="text-primary-foreground/80 hidden sm:inline">|</span>
              <span className="hidden sm:inline">{farm.name}</span>
              <span className="text-primary-foreground/60 text-sm hidden md:inline">
                (Owner: {(farm.profiles as { full_name: string })?.full_name || "Unknown"})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/admin/audit-report/${farmId}`)}
            >
              <FileText className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Audit Report</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/admin?tab=farms")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Exit View Mode</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Read-Only Alert */}
      <div className="container mx-auto px-4 py-2">
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            You are viewing this farm in <strong>read-only mode</strong>.
            All editing actions are disabled.
          </AlertDescription>
        </Alert>
      </div>

      {/* Full Dashboard with Tabs */}
      <div className="container mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {isMobile ? (
            <TabsList className="grid w-full grid-cols-5 h-auto">
              <TabsTrigger value="dashboard" className="flex flex-col items-center gap-1 py-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="text-[10px]">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="animals" className="flex flex-col items-center gap-1 py-2">
                <PawPrint className="h-4 w-4" />
                <span className="text-[10px]">Animals</span>
              </TabsTrigger>
              <TabsTrigger value="operations" className="flex flex-col items-center gap-1 py-2">
                <Settings2 className="h-4 w-4" />
                <span className="text-[10px]">Ops</span>
              </TabsTrigger>
              <TabsTrigger value="finance" className="flex flex-col items-center gap-1 py-2">
                <Wallet className="h-4 w-4" />
                <span className="text-[10px]">Finance</span>
              </TabsTrigger>
              <TabsTrigger value="more" className="flex flex-col items-center gap-1 py-2">
                <MoreHorizontal className="h-4 w-4" />
                <span className="text-[10px]">More</span>
              </TabsTrigger>
            </TabsList>
          ) : (
            <TabsList>
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="animals" className="flex items-center gap-2">
                <PawPrint className="h-4 w-4" />
                Animals
              </TabsTrigger>
              <TabsTrigger value="operations" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Operations
              </TabsTrigger>
              <TabsTrigger value="finance" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Finance
              </TabsTrigger>
              <TabsTrigger value="more" className="flex items-center gap-2">
                <MoreHorizontal className="h-4 w-4" />
                More
              </TabsTrigger>
            </TabsList>
          )}

          {/* Dashboard Tab — with navigation callbacks for cross-tab links */}
          <TabsContent value="dashboard">
            <FarmDashboard
              farmId={farmId!}
              onNavigateToAnimals={() => setActiveTab("animals")}
              onNavigateToAnimalDetails={handleNavigateToAnimalDetails}
            />
          </TabsContent>

          {/* Animals Tab — BarnListView (readOnly) + AnimalList in Card (matching farmer layout) */}
          <TabsContent value="animals" className="space-y-4 sm:space-y-6">
            <BarnListView farmId={farmId!} readOnly={true} />
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle>Animals</CardTitle>
                <CardDescription>Mga Hayop — Livestock records for this farm</CardDescription>
              </CardHeader>
              <CardContent>
                <AnimalList
                  farmId={farmId!}
                  readOnly={true}
                  initialSelectedAnimalId={selectedAnimalId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Operations Tab — 3 sub-tabs matching farmer dashboard (Milk, Feed, Breeding) */}
          <TabsContent value="operations" className="space-y-4 sm:space-y-6">
            <Tabs value={operationsSubtab} onValueChange={setOperationsSubtab} className="space-y-4">
              <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
                <TabsTrigger value="milk">Milk Inventory</TabsTrigger>
                <TabsTrigger value="feed">Feed Stock</TabsTrigger>
                <TabsTrigger value="breeding">Breeding</TabsTrigger>
              </TabsList>

              <TabsContent value="milk">
                <MilkInventoryTab farmId={farmId!} canManage={false} />
              </TabsContent>

              <TabsContent value="feed">
                <FeedInventoryTab farmId={farmId!} canManage={false} forecasts={[]} />
              </TabsContent>

              <TabsContent value="breeding">
                <BreedingHub
                  farmId={farmId!}
                  readOnly={true}
                  onViewAnimal={handleNavigateToAnimalDetails}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Finance Tab — with cross-tab navigation */}
          <TabsContent value="finance">
            <FinanceTab farmId={farmId!} canManage={false} onNavigateToTab={setActiveTab} />
          </TabsContent>

          {/* More Tab — 2 sub-tabs (Approvals, Government) matching farmer dashboard */}
          <TabsContent value="more" className="space-y-4 sm:space-y-6">
            <Tabs defaultValue="approvals" className="space-y-4">
              <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
                <TabsTrigger value="approvals">Approvals</TabsTrigger>
                <TabsTrigger value="government">Government</TabsTrigger>
              </TabsList>

              <TabsContent value="approvals">
                <PendingActivitiesQueue farmId={farmId!} />
              </TabsContent>

              <TabsContent value="government">
                <FarmerFeedbackList farmId={farmId!} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminViewFarm;
