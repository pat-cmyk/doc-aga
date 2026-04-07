import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/LoadingScreen";
import { LogOut, LayoutDashboard, Users, Milk, Heart, DollarSign, Settings, PawPrint, Droplet, Package, Truck, Tag, FileText } from "lucide-react";
import { DocAgaLogo } from "@/components/DocAgaLogo";
import { CooperativeOverview } from "@/components/cooperative/CooperativeOverview";
import { CooperativeMemberFarms } from "@/components/cooperative/CooperativeMemberFarms";
import { CooperativeMilkAnalytics } from "@/components/cooperative/CooperativeMilkAnalytics";
import { CooperativeHerdSummary } from "@/components/cooperative/CooperativeHerdSummary";
import { CooperativeHealthOverview } from "@/components/cooperative/CooperativeHealthOverview";
import { CooperativeFinancials } from "@/components/cooperative/CooperativeFinancials";
import { CooperativeSettings } from "@/components/cooperative/CooperativeSettings";
import { CoopMilkCollection } from "@/components/cooperative/hub-operations/CoopMilkCollection";
import { CoopPriceSchedule } from "@/components/cooperative/hub-operations/CoopPriceSchedule";

const CooperativeDashboard = () => {
  const navigate = useNavigate();
  const [cooperativeId, setCooperativeId] = useState<string | null>(null);
  const [cooperativeName, setCooperativeName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth/cooperative");
        return;
      }

      // Check cooperative role
      const { data: isCooperative } = await supabase
        .rpc("has_role", { _user_id: user.id, _role: "cooperative" });

      if (!isCooperative) {
        navigate("/auth/cooperative");
        return;
      }

      // Get cooperative details
      const { data: coop } = await supabase
        .from("cooperatives")
        .select("id, name")
        .eq("admin_user_id", user.id)
        .maybeSingle();

      if (coop) {
        setCooperativeId(coop.id);
        setCooperativeName(coop.name);
      }

      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth/cooperative");
  };

  if (loading) return <LoadingScreen />;

  if (!cooperativeId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <DocAgaLogo size="lg" />
          <h2 className="text-xl font-semibold">No Cooperative Found</h2>
          <p className="text-muted-foreground">
            Your account has cooperative access but no cooperative has been assigned yet.
            Please contact your administrator.
          </p>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <DocAgaLogo size="sm" />
            <div>
              <h1 className="text-lg font-bold">{cooperativeName}</h1>
              <p className="text-xs text-muted-foreground">Cooperative Dashboard</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="farms" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Member Farms</span>
            </TabsTrigger>
            <TabsTrigger value="milk" className="gap-1.5">
              <Milk className="h-4 w-4" />
              <span className="hidden sm:inline">Milk Production</span>
            </TabsTrigger>
            <TabsTrigger value="herd" className="gap-1.5">
              <PawPrint className="h-4 w-4" />
              <span className="hidden sm:inline">Herd Summary</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Health</span>
            </TabsTrigger>
            <TabsTrigger value="financials" className="gap-1.5">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financials</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            {/* CAIN Hub Operations */}
            <TabsTrigger value="milk-collection" className="gap-1.5">
              <Droplet className="h-4 w-4" />
              <span className="hidden sm:inline">Milk Collection</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-1.5">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Pricing</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CooperativeOverview cooperativeId={cooperativeId} />
          </TabsContent>
          <TabsContent value="farms">
            <CooperativeMemberFarms cooperativeId={cooperativeId} />
          </TabsContent>
          <TabsContent value="milk">
            <CooperativeMilkAnalytics cooperativeId={cooperativeId} />
          </TabsContent>
          <TabsContent value="herd">
            <CooperativeHerdSummary cooperativeId={cooperativeId} />
          </TabsContent>
          <TabsContent value="health">
            <CooperativeHealthOverview cooperativeId={cooperativeId} />
          </TabsContent>
          <TabsContent value="financials">
            <CooperativeFinancials cooperativeId={cooperativeId} />
          </TabsContent>
          <TabsContent value="settings">
            <CooperativeSettings cooperativeId={cooperativeId} cooperativeName={cooperativeName} />
          </TabsContent>
          {/* CAIN Hub Operations */}
          <TabsContent value="milk-collection">
            <CoopMilkCollection cooperativeId={cooperativeId} />
          </TabsContent>
          <TabsContent value="pricing">
            <CoopPriceSchedule cooperativeId={cooperativeId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CooperativeDashboard;
