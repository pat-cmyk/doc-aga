import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sprout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AnimalList from "@/components/AnimalList";
import FarmDashboard from "@/components/FarmDashboard";
import { UserEmailDropdown } from "@/components/UserEmailDropdown";
import FarmSetup from "@/components/FarmSetup";
import FarmProfile from "@/components/FarmProfile";
import { FeedInventoryTab } from "@/components/FeedInventoryTab";
import { generateFeedForecast } from "@/lib/feedForecast";
import { QueueStatus } from "@/components/QueueStatus";
import { CacheSettingsDialog } from "@/components/CacheSettingsDialog";
import { OfflineOnboarding } from "@/components/OfflineOnboarding";
import { preloadAllData } from "@/lib/dataCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [showFarmSetup, setShowFarmSetup] = useState(false);
  const [canManageFarm, setCanManageFarm] = useState(false);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [prefillFeedType, setPrefillFeedType] = useState<string | undefined>(undefined);

  useEffect(() => {
    const initializeUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }
      
      setUser(session.user);
      
      // Check user roles first - redirect merchants to their dashboard
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      
      const userRoles = roles?.map(r => r.role) || [];
      
      // Redirect users based on their role
      if (userRoles.includes("admin")) {
        navigate("/admin");
        return;
      }
      
      if (userRoles.includes("merchant")) {
        navigate("/merchant");
        return;
      }
      
      if (userRoles.includes("farmhand")) {
        navigate("/farmhand");
        return;
      }
      
      // Check if user owns a farm OR is a member of a farm
      const { data: ownedFarms, error: farmError } = await supabase
        .from("farms")
        .select("id")
        .eq("owner_id", session.user.id)
        .eq("is_deleted", false)
        .limit(1);

      const { data: memberFarms } = await supabase
        .from("farm_memberships")
        .select("farm_id, role_in_farm")
        .eq("user_id", session.user.id)
        .eq("invitation_status", "accepted")
        .limit(1);
      
      if (farmError) {
        toast({
          title: "Error loading farm",
          description: farmError.message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      
      if (ownedFarms && ownedFarms.length > 0) {
        // User owns a farm
        setFarmId(ownedFarms[0].id);
        setCanManageFarm(true);
      } else if (memberFarms && memberFarms.length > 0) {
        // User is a member of a farm
        setFarmId(memberFarms[0].farm_id);
        setCanManageFarm(userRoles.includes("farmer_owner"));
      } else {
        // Show farm setup for new users without any farm access
        setShowFarmSetup(true);
      }
      
      setLoading(false);
    };

    initializeUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  useEffect(() => {
    if (farmId) {
      loadForecastData();
      // Preload critical data when farm is selected
      preloadAllData(farmId, isOnline);
    }
  }, [farmId, isOnline]);

  // Handle URL query params for deep linking
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const feedType = params.get('prefillFeedType');
    
    if (tab === 'feed') {
      setActiveTab('feed');
    }
    
    if (feedType) {
      setPrefillFeedType(feedType);
    }
  }, [location.search]);

  const loadForecastData = async () => {
    if (!farmId) return;
    
    try {
      const { data: animals } = await supabase
        .from("animals")
        .select("id, birth_date, gender, life_stage, milking_stage, current_weight_kg")
        .eq("farm_id", farmId)
        .eq("is_deleted", false);

      if (animals) {
        const forecast = generateFeedForecast(animals);
        setForecastData(forecast);
      }
    } catch (error) {
      console.error("Error loading forecast data:", error);
    }
  };


  const handleNavigateToAnimalDetails = (animalId: string) => {
    setSelectedAnimalId(animalId);
    setActiveTab("animals");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Sprout className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (showFarmSetup) {
    return <FarmSetup onFarmCreated={(farmId) => {
      setFarmId(farmId);
      setShowFarmSetup(false);
    }} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sprout className="h-6 w-6 text-primary" />
            </div>
          <div>
            <h1 className="text-xl font-bold">Doc Aga</h1>
            <p className="text-xs text-muted-foreground">Welcome back!</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UserEmailDropdown />
        </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="dashboard" disabled={!farmId}>Dashboard</TabsTrigger>
              <TabsTrigger value="animals" disabled={!farmId}>Animals</TabsTrigger>
              <TabsTrigger value="feed" disabled={!farmId}>Feed Inventory</TabsTrigger>
              <TabsTrigger value="farm" disabled={!farmId}>Farm</TabsTrigger>
            </TabsList>
            <Button variant="outline" onClick={() => navigate("/marketplace")}>
              Marketplace
            </Button>
            {farmId && <CacheSettingsDialog />}
          </div>

          {/* Offline Onboarding Dialog */}
          {farmId && <OfflineOnboarding farmId={farmId} />}

          <TabsContent value="dashboard" className="space-y-6">
            {farmId && (
              <FarmDashboard 
                farmId={farmId} 
                onNavigateToAnimals={() => setActiveTab("animals")}
                onNavigateToAnimalDetails={handleNavigateToAnimalDetails}
              />
            )}
          </TabsContent>

          <TabsContent value="animals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Animals</CardTitle>
                <CardDescription>Manage your livestock and animal records</CardDescription>
              </CardHeader>
              <CardContent>
                {farmId && (
                  <AnimalList 
                    farmId={farmId} 
                    initialSelectedAnimalId={selectedAnimalId}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feed" className="space-y-4">
            {farmId && (
              <FeedInventoryTab
                farmId={farmId}
                forecasts={forecastData}
                canManage={canManageFarm}
                prefillFeedType={prefillFeedType}
                onPrefillUsed={() => setPrefillFeedType(undefined)}
              />
            )}
          </TabsContent>

          <TabsContent value="farm" className="space-y-6">
            {farmId && <FarmProfile farmId={farmId} />}
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Queue Status FAB */}
      <QueueStatus />
    </div>
  );
};

export default Dashboard;
