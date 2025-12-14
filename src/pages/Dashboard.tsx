import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sprout, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import AnimalList from "@/components/AnimalList";
import FarmDashboard from "@/components/FarmDashboard";
import { UserEmailDropdown } from "@/components/UserEmailDropdown";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import FarmSetup from "@/components/FarmSetup";
import { FeedInventoryTab } from "@/components/FeedInventoryTab";
import { MilkInventoryTab } from "@/components/milk-inventory/MilkInventoryTab";
import { generateFeedForecast } from "@/lib/feedForecast";
import { QueueStatus } from "@/components/QueueStatus";
import { FinanceTab } from "@/components/FinanceTab";
import { OfflineOnboarding } from "@/components/OfflineOnboarding";
import { preloadAllData } from "@/lib/dataCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { FarmSwitcher } from "@/components/FarmSwitcher";
import { GovernmentConnectTab } from "@/components/farmer/GovernmentConnectTab";
import { FarmerFeedbackList } from "@/components/farmer/FarmerFeedbackList";
import { PendingActivitiesQueue } from "@/components/approval/PendingActivitiesQueue";
import { ApprovalSettings } from "@/components/approval/ApprovalSettings";
import { usePendingActivities } from "@/hooks/usePendingActivities";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { syncQueue } from "@/lib/syncService";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

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
  const [farmName, setFarmName] = useState<string>('My Farm');
  const [farmLogoUrl, setFarmLogoUrl] = useState<string | null>(null);
  const [voiceTrainingCompleted, setVoiceTrainingCompleted] = useState(false);

  // Get pending activities count for badge
  const { pendingCount } = usePendingActivities(farmId || undefined, undefined);

  const handleRefresh = async () => {
    await syncQueue();
    if (farmId) {
      await loadForecastData();
      await preloadAllData(farmId, isOnline);
    }
    toast({
      title: "Refreshed",
      description: "Data synced successfully",
    });
  };

  const { containerRef, PullToRefreshIndicator, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  useEffect(() => {
    const initializeUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }
      
      setUser(session.user);
      
      // Parallelize queries to reduce waterfall - fetch profile, roles, and farms concurrently
      const [profileResult, rolesResult, ownedFarmsResult, memberFarmsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('voice_training_completed')
          .eq('id', session.user.id)
          .single(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id),
        supabase
          .from("farms")
          .select("id, name, logo_url")
          .eq("owner_id", session.user.id)
          .eq("is_deleted", false)
          .limit(1),
        supabase
          .from("farm_memberships")
          .select("farm_id, role_in_farm")
          .eq("user_id", session.user.id)
          .eq("invitation_status", "accepted")
          .limit(1)
      ]);
      
      // Process profile data
      if (profileResult.data) {
        setVoiceTrainingCompleted(profileResult.data.voice_training_completed || false);
      }
      
      // Process roles and redirect based on role
      const userRoles = rolesResult.data?.map(r => r.role) || [];
      
      if (userRoles.includes("admin")) {
        navigate("/admin");
        return;
      }
      
      if (userRoles.includes("government") && !userRoles.includes("admin")) {
        navigate("/government");
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
      
      const ownedFarms = ownedFarmsResult.data;
      const memberFarms = memberFarmsResult.data;
      
      if (ownedFarmsResult.error) {
        toast({
          title: "Error loading farm",
          description: ownedFarmsResult.error.message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      
      if (ownedFarms && ownedFarms.length > 0) {
        // User owns a farm - farm details already fetched in parallel
        setFarmId(ownedFarms[0].id);
        setCanManageFarm(true);
        setFarmName(ownedFarms[0].name || 'My Farm');
        setFarmLogoUrl(ownedFarms[0].logo_url || null);
      } else if (memberFarms && memberFarms.length > 0) {
        // User is a member of a farm - fetch farm details
        setFarmId(memberFarms[0].farm_id);
        setCanManageFarm(userRoles.includes("farmer_owner"));
        
        const { data: farmData } = await supabase
          .from('farms')
          .select('name, logo_url')
          .eq('id', memberFarms[0].farm_id)
          .single();
        
        if (farmData) {
          setFarmName(farmData.name || 'My Farm');
          setFarmLogoUrl(farmData.logo_url || null);
        }
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

  // Re-check farm ownership when page becomes visible (prevents duplicate farm creation)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && showFarmSetup) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) return;

        // Check if user now owns a farm
        const { data: ownedFarms } = await supabase
          .from("farms")
          .select("id, name, logo_url")
          .eq("owner_id", session.user.id)
          .eq("is_deleted", false)
          .limit(1);

        if (ownedFarms && ownedFarms.length > 0) {
          // Farm was created - hide setup and show dashboard
          setFarmId(ownedFarms[0].id);
          setCanManageFarm(true);
          setShowFarmSetup(false);
          setFarmName(ownedFarms[0].name || 'My Farm');
          setFarmLogoUrl(ownedFarms[0].logo_url || null);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [showFarmSetup]);

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
    
    // Support legacy 'feed' tab param and new 'operations' tab
    if (tab === 'feed' || tab === 'operations') {
      setActiveTab('operations');
    } else if (tab === 'milk') {
      setActiveTab('operations');
    } else if (tab === 'approvals' || tab === 'government') {
      setActiveTab('more');
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

  const handleFarmChange = async (newFarmId: string) => {
    setFarmId(newFarmId);
    
    // Fetch new farm details
    const { data: farmData } = await supabase
      .from('farms')
      .select('name, logo_url, owner_id')
      .eq('id', newFarmId)
      .single();
    
    if (farmData) {
      setFarmName(farmData.name || 'My Farm');
      setFarmLogoUrl(farmData.logo_url || null);
      
      // Check if user owns this farm
      const { data: { user } } = await supabase.auth.getUser();
      setCanManageFarm(farmData.owner_id === user?.id);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (showFarmSetup) {
    return <FarmSetup onFarmCreated={(farmId) => {
      setFarmId(farmId);
      setShowFarmSetup(false);
    }} />;
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background overflow-y-auto">
      <PullToRefreshIndicator />
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {farmLogoUrl ? (
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage loading="lazy" src={farmLogoUrl} alt={farmName} />
                <AvatarFallback className="bg-primary/10">
                  <Sprout className="h-6 w-6 text-primary" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                <Sprout className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{farmName}</h1>
              <p className="text-xs text-muted-foreground">Welcome back!</p>
            </div>
            <FarmSwitcher currentFarmId={farmId} onFarmChange={handleFarmChange} />
          </div>
        <div className="flex items-center gap-2">
          <NetworkStatusIndicator />
          <UserEmailDropdown />
        </div>
        </div>
      </header>

      {/* Voice Training Completion Banner */}
      {voiceTrainingCompleted && (
        <div className="container mx-auto px-4 pt-4 max-w-7xl">
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  🎉 Voice Training Complete!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your AI assistant is now optimized for your voice. Try asking questions!
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVoiceTrainingCompleted(false)}
                className="text-green-700 hover:text-green-900 dark:text-green-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-7xl pb-safe">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <div className="relative">
            {/* Scroll indicator gradients */}
            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none md:hidden" />
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none md:hidden" />
            <TabsList className="flex w-full overflow-x-auto scrollbar-hide gap-1 px-1 md:grid md:w-auto md:grid-cols-5">
              <TabsTrigger value="dashboard" disabled={!farmId}>Dashboard</TabsTrigger>
              <TabsTrigger value="animals" disabled={!farmId}>Animals</TabsTrigger>
              <TabsTrigger value="operations" disabled={!farmId}>Operations</TabsTrigger>
              <TabsTrigger value="finance" disabled={!farmId}>Finance</TabsTrigger>
              <TabsTrigger value="more" disabled={!farmId} className="gap-2">
                More
                {pendingCount > 0 && canManageFarm && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Offline Onboarding Dialog */}
          {farmId && <OfflineOnboarding farmId={farmId} />}

          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6">
            {farmId && (
              <FarmDashboard 
                farmId={farmId} 
                onNavigateToAnimals={() => setActiveTab("animals")}
                onNavigateToAnimalDetails={handleNavigateToAnimalDetails}
              />
            )}
          </TabsContent>

          <TabsContent value="animals" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
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

          {/* Operations Tab - Consolidated Milk + Feeds */}
          <TabsContent value="operations" className="space-y-4 sm:space-y-6">
            {farmId && (
              <Tabs defaultValue="milk" className="space-y-4">
                <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
                  <TabsTrigger value="milk">Milk Inventory</TabsTrigger>
                  <TabsTrigger value="feed">Feed Stock</TabsTrigger>
                </TabsList>

                <TabsContent value="milk">
                  <MilkInventoryTab farmId={farmId} canManage={canManageFarm} />
                </TabsContent>

                <TabsContent value="feed">
                  <FeedInventoryTab
                    farmId={farmId}
                    forecasts={forecastData}
                    canManage={canManageFarm}
                    prefillFeedType={prefillFeedType}
                    onPrefillUsed={() => setPrefillFeedType(undefined)}
                  />
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="finance" className="space-y-4 sm:space-y-6">
            {farmId && (
              <FinanceTab farmId={farmId} canManage={canManageFarm} />
            )}
          </TabsContent>

          {/* More Tab - Consolidated Approvals + Government */}
          <TabsContent value="more" className="space-y-4 sm:space-y-6">
            {farmId && (
              <Tabs defaultValue={canManageFarm ? "approvals" : "government"} className="space-y-4">
                <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
                  {canManageFarm && (
                    <TabsTrigger value="approvals" className="gap-2">
                      Approvals
                      {pendingCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">
                          {pendingCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="government">Government</TabsTrigger>
                  {canManageFarm && (
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  )}
                </TabsList>

                {canManageFarm && (
                  <TabsContent value="approvals">
                    <PendingActivitiesQueue farmId={farmId} />
                  </TabsContent>
                )}

                <TabsContent value="government">
                  <Tabs defaultValue="submit" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="submit">Submit Feedback</TabsTrigger>
                      <TabsTrigger value="submissions">My Submissions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="submit">
                      <GovernmentConnectTab farmId={farmId} />
                    </TabsContent>

                    <TabsContent value="submissions">
                      <Card>
                        <CardHeader className="pb-3 sm:pb-6">
                          <CardTitle>My Submissions</CardTitle>
                          <CardDescription>
                            Track your feedback to the government
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <FarmerFeedbackList farmId={farmId} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                {canManageFarm && (
                  <TabsContent value="settings">
                    <ApprovalSettings farmId={farmId} />
                  </TabsContent>
                )}
              </Tabs>
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Queue Status FAB */}
      <QueueStatus />
    </div>
  );
};

export default Dashboard;
