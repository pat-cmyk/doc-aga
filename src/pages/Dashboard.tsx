import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);

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
      
      // Check if user has a farm, create one if not (only for farmers)
      const { data: farms, error: farmError } = await supabase
        .from("farms")
        .select("id")
        .eq("owner_id", session.user.id)
        .eq("is_deleted", false)
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
      
      if (farms && farms.length > 0) {
        // User has a farm
        setFarmId(farms[0].id);
      } else {
        // Create a default farm using secure database function
        try {
          const { data: farmId, error: createError } = await supabase
            .rpc('create_default_farm', {
              _name: 'My Farm',
              _region: 'Not specified'
            });
          
          if (createError) {
            console.error("Farm creation error:", createError);
            toast({
              title: "Error creating farm",
              description: createError.message,
              variant: "destructive"
            });
          } else if (farmId) {
            setFarmId(farmId);
            toast({
              title: "Welcome!",
              description: "Your farm has been created automatically."
            });
          }
        } catch (err: any) {
          console.error("Unexpected farm creation error:", err);
          toast({
            title: "Error creating farm",
            description: err.message || "An unexpected error occurred",
            variant: "destructive"
          });
        }
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
            <h1 className="text-xl font-bold">AgriPal</h1>
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
            <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
              <TabsTrigger value="dashboard" disabled={!farmId}>Dashboard</TabsTrigger>
              <TabsTrigger value="animals" disabled={!farmId}>Animals</TabsTrigger>
            </TabsList>
            <Button variant="outline" onClick={() => navigate("/marketplace")}>
              Marketplace
            </Button>
          </div>

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
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;