import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { PawPrint, Wheat, FileCheck } from "lucide-react";
import { DocAgaLogo } from "@/components/DocAgaLogo";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserEmailDropdown } from "@/components/UserEmailDropdown";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import VoiceRecordButton from "@/components/farmhand/VoiceRecordButton";
import DocAgaConsultation from "@/components/farmhand/DocAgaConsultation";
import AnimalList from "@/components/AnimalList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedInventoryTab } from "@/components/FeedInventoryTab";
import { generateFeedForecast } from "@/lib/feedForecast";
import { QueueStatus } from "@/components/QueueStatus";
import { MySubmissions } from "@/components/approval/MySubmissions";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { syncQueue } from "@/lib/syncService";
import { useFarm } from "@/contexts/FarmContext";
import { SyncStatusSheet, SyncConflictResolution } from "@/components/sync";
import { PhilippineTimeBanner } from "@/components/ui/PhilippineTimeBanner";

const FarmhandDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Farm context for shared state
  const { farmId, setFarmId } = useFarm();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDocAga, setShowDocAga] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [forecastData, setForecastData] = useState<any[]>([]);

  const handleRefresh = async () => {
    await syncQueue();
    if (farmId) {
      await loadForecastData();
    }
    toast({
      title: "Refreshed",
      description: "Data synced successfully",
    });
  };

  const { containerRef, PullToRefreshIndicator, isRefreshing } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

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

  useEffect(() => {
    const initializeUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }
      
      setUser(session.user);
      
      // SSOT: If farmId is already set in context (e.g., from InviteAccept), trust it
      if (farmId) {
        console.log('[FarmhandDashboard] Using farmId from context:', farmId);
        setLoading(false);
        return;
      }
      
      // Only query database if no farmId in context
      // Check farm membership with role_in_farm instead of user_roles
      // This is the source of truth for farm-specific access
      const { data: membership, error: membershipError } = await supabase
        .from("farm_memberships")
        .select(`
          farm_id,
          role_in_farm,
          farms!inner (
            id,
            name,
            owner_id
          )
        `)
        .eq("user_id", session.user.id)
        .eq("invitation_status", "accepted")
        .limit(1)
        .maybeSingle();  // Changed from .single() to prevent errors when no row found
      
      if (membershipError) {
        console.error('[FarmhandDashboard] Membership query error:', membershipError);
        setLoading(false);
        return;
      }
      
      if (!membership) {
        // User has no farm membership - show no farm assigned state
        setLoading(false);
        return;
      }
      
      const farm = membership.farms as unknown as { id: string; name: string; owner_id: string };
      const isOwner = farm.owner_id === session.user.id;
      const isFarmOwnerRole = membership.role_in_farm === 'farmer_owner';
      
      // If user owns the farm or has farmer_owner role, redirect to main dashboard
      if (isOwner || isFarmOwnerRole) {
        navigate("/");
        return;
      }
      
      // Only farmhand role should access this dashboard
      if (membership.role_in_farm !== 'farmhand') {
        navigate("/");
        return;
      }
      
      setFarmId(membership.farm_id);
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
  }, [navigate, toast, farmId]);

  // Generate feed forecast when farmId is available
  useEffect(() => {
    loadForecastData();
  }, [farmId]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!farmId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Farm Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Please contact your farm owner to get assigned to a farm.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background overflow-y-auto">
      <PullToRefreshIndicator />
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-2 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocAgaLogo size={40} />
            <div>
              <h1 className="text-xl font-bold">Doc Aga</h1>
              <PhilippineTimeBanner compact />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncStatusSheet />
            <NetworkStatusIndicator />
            <UserEmailDropdown />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-7xl space-y-4 sm:space-y-6">
        {showDocAga ? (
          <DocAgaConsultation 
            initialQuery=""
            onClose={() => setShowDocAga(false)}
            farmId={farmId}
          />
        ) : (
          <>
            {/* Voice Recording Section */}
            <VoiceRecordButton farmId={farmId} animalId={selectedAnimalId} />

            <Tabs defaultValue="animals" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto">
                <TabsTrigger value="animals" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
                  <PawPrint className="h-4 w-4" />
                  <span className={isMobile ? "" : ""}>Animals</span>
                </TabsTrigger>
                <TabsTrigger value="feed" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
                  <Wheat className="h-4 w-4" />
                  <span className={isMobile ? "" : ""}>Feeds</span>
                </TabsTrigger>
                <TabsTrigger value="submissions" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
                  <FileCheck className="h-4 w-4" />
                  <span className={isMobile ? "hidden sm:inline" : ""}>Submissions</span>
                  <span className={isMobile ? "sm:hidden" : "hidden"}>Logs</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="animals" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Animals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AnimalList 
                      farmId={farmId} 
                      readOnly 
                      onAnimalSelect={setSelectedAnimalId}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="feed" className="space-y-4">
                <FeedInventoryTab
                  farmId={farmId}
                  forecasts={forecastData}
                  canManage={false}
                />
              </TabsContent>

              <TabsContent value="submissions" className="space-y-4">
                {user && <MySubmissions userId={user.id} />}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
      
      {/* Queue Status FAB */}
      <QueueStatus />
      
      {/* Conflict Resolution FAB */}
      <SyncConflictResolution />
    </div>
  );
};

export default FarmhandDashboard;
