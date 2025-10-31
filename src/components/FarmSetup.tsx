import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sprout, MapPin } from "lucide-react";

const REGIONS_WITH_PROVINCES = {
  "NCR": ["Metro Manila"],
  "CAR": ["Abra", "Apayao", "Benguet", "Ifugao", "Kalinga", "Mountain Province"],
  "Region I": ["Ilocos Norte", "Ilocos Sur", "La Union", "Pangasinan"],
  "Region II": ["Batanes", "Cagayan", "Isabela", "Nueva Vizcaya", "Quirino"],
  "Region III": ["Aurora", "Bataan", "Bulacan", "Nueva Ecija", "Pampanga", "Tarlac", "Zambales"],
  "Region IV-A": ["Batangas", "Cavite", "Laguna", "Quezon", "Rizal"],
  "Region IV-B": ["Marinduque", "Occidental Mindoro", "Oriental Mindoro", "Palawan", "Romblon"],
  "Region V": ["Albay", "Camarines Norte", "Camarines Sur", "Catanduanes", "Masbate", "Sorsogon"],
  "Region VI": ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo", "Negros Occidental"],
  "Region VII": ["Bohol", "Cebu", "Negros Oriental", "Siquijor"],
  "Region VIII": ["Biliran", "Eastern Samar", "Leyte", "Northern Samar", "Samar", "Southern Leyte"],
  "Region IX": ["Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay"],
  "Region X": ["Bukidnon", "Camiguin", "Lanao del Norte", "Misamis Occidental", "Misamis Oriental"],
  "Region XI": ["Davao de Oro", "Davao del Norte", "Davao del Sur", "Davao Occidental", "Davao Oriental"],
  "Region XII": ["Cotabato", "Sarangani", "South Cotabato", "Sultan Kudarat"],
  "Region XIII": ["Agusan del Norte", "Agusan del Sur", "Dinagat Islands", "Surigao del Norte", "Surigao del Sur"],
  "BARMM": ["Basilan", "Lanao del Sur", "Maguindanao", "Sulu", "Tawi-Tawi"]
};

interface FarmSetupProps {
  onFarmCreated: (farmId: string) => void;
}

export default function FarmSetup({ onFarmCreated }: FarmSetupProps) {
  const { toast } = useToast();
  const [checkingOwnership, setCheckingOwnership] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    region: "",
    province: "",
    role_in_farm: "farmer_owner" as "farmer_owner" | "farmhand" | "vet",
    livestock_type: "cattle"
  });

  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Check if user already owns or is a member of a farm
  useEffect(() => {
    const checkExistingFarm = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setCheckingOwnership(false);
          return;
        }

        // Check if user owns a farm
        const { data: ownedFarms } = await supabase
          .from("farms")
          .select("id")
          .eq("owner_id", user.id)
          .eq("is_deleted", false)
          .limit(1);

        // Check if user is a member of a farm
        const { data: memberFarms } = await supabase
          .from("farm_memberships")
          .select("farm_id")
          .eq("user_id", user.id)
          .eq("invitation_status", "accepted")
          .limit(1);

        if (ownedFarms && ownedFarms.length > 0) {
          // User already owns a farm - redirect to dashboard
          toast({
            title: "Farm already exists",
            description: "Redirecting to your dashboard..."
          });
          onFarmCreated(ownedFarms[0].id);
          return;
        } else if (memberFarms && memberFarms.length > 0) {
          // User is already a member - redirect to dashboard
          toast({
            title: "You're already part of a farm",
            description: "Redirecting to dashboard..."
          });
          onFarmCreated(memberFarms[0].farm_id);
          return;
        }

        setCheckingOwnership(false);
      } catch (error) {
        console.error("Error checking farm ownership:", error);
        setCheckingOwnership(false);
      }
    };

    checkExistingFarm();
  }, [onFarmCreated, toast]);

  const availableProvinces = formData.region ? REGIONS_WITH_PROVINCES[formData.region as keyof typeof REGIONS_WITH_PROVINCES] || [] : [];

  const handleRegionChange = (value: string) => {
    setFormData({ ...formData, region: value, province: "" });
  };

  const fetchCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support geolocation",
        variant: "destructive"
      });
      return;
    }

    const tempLoading = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGpsCoords({ lat: latitude, lng: longitude });
        toast({
          title: "Location captured",
          description: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        });
      },
      (error) => {
        toast({
          title: "Location error",
          description: error.message,
          variant: "destructive"
        });
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) return;
    
    if (!formData.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a farm name",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const regionInfo = formData.province 
        ? `${formData.region}, ${formData.province}`
        : formData.region || "Not specified";

      const { data: farmId, error } = await supabase.rpc('create_default_farm', {
        _name: formData.name,
        _region: regionInfo,
        _role: formData.role_in_farm,
        _livestock_type: formData.livestock_type
      });

      if (error) throw error;

      // If GPS coordinates were captured, update the farm
      if (farmId && gpsCoords) {
        await supabase
          .from('farms')
          .update({ 
            gps_lat: gpsCoords.lat, 
            gps_lng: gpsCoords.lng 
          })
          .eq('id', farmId);
      }

      toast({
        title: "Welcome to Doc Aga!",
        description: "Your farm has been created successfully."
      });

      onFarmCreated(farmId);
    } catch (error: any) {
      toast({
        title: "Error creating farm",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleDescriptions = {
    farmer_owner: "I own and manage this farm",
    farmhand: "I work on this farm",
    vet: "I provide veterinary services"
  };

  const livestockDescriptions = {
    cattle: "Dairy and beef cattle farming",
    goat: "Goat farming for meat and milk production",
    sheep: "Sheep farming for meat and wool",
    carabao: "Water buffalo farming"
  } as const;

  // Show loading state while checking ownership
  if (checkingOwnership) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Sprout className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Checking your farm status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Sprout className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl">Welcome to Doc Aga! 🌱</CardTitle>
          <CardDescription className="text-base">
            Let's set up your first farm to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Farm Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Green Valley Farm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="livestock">Livestock Type *</Label>
              <Select 
                value={formData.livestock_type} 
                onValueChange={(value) => setFormData({ ...formData, livestock_type: value })}
              >
                <SelectTrigger id="livestock">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cattle">
                    <div>
                      <div className="font-medium">🐄 Cattle</div>
                      <div className="text-sm text-muted-foreground">Dairy and beef cattle</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="goat">
                    <div>
                      <div className="font-medium">🐐 Goat</div>
                      <div className="text-sm text-muted-foreground">Meat and milk production</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="sheep">
                    <div>
                      <div className="font-medium">🐑 Sheep</div>
                      <div className="text-sm text-muted-foreground">Meat and wool production</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="carabao">
                    <div>
                      <div className="font-medium">🐃 Carabao (Water Buffalo)</div>
                      <div className="text-sm text-muted-foreground">Draft and dairy purposes</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {livestockDescriptions[formData.livestock_type as keyof typeof livestockDescriptions]}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Your Role *</Label>
              <Select value={formData.role_in_farm} onValueChange={(value: any) => setFormData({ ...formData, role_in_farm: value })}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="farmer_owner">
                    <div>
                      <div className="font-medium">Farm Owner</div>
                      <div className="text-sm text-muted-foreground">I own and manage this farm</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="farmhand">
                    <div>
                      <div className="font-medium">Farm Hand</div>
                      <div className="text-sm text-muted-foreground">I work on this farm</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="vet">
                    <div>
                      <div className="font-medium">Veterinarian</div>
                      <div className="text-sm text-muted-foreground">I provide veterinary services</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {roleDescriptions[formData.role_in_farm]}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Select value={formData.region} onValueChange={handleRegionChange}>
                  <SelectTrigger id="region">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(REGIONS_WITH_PROVINCES).map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Select 
                  value={formData.province} 
                  onValueChange={(value) => setFormData({ ...formData, province: value })}
                  disabled={!formData.region}
                >
                  <SelectTrigger id="province">
                    <SelectValue placeholder={formData.region ? "Select province" : "Select region first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProvinces.map((province) => (
                      <SelectItem key={province} value={province}>
                        {province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>GPS Location (Optional)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchCurrentLocation}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {gpsCoords ? "Update Location" : "Get My Location"}
                </Button>
                {gpsCoords && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setGpsCoords(null)}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {gpsCoords && (
                <p className="text-sm text-muted-foreground">
                  Location captured: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || checkingOwnership}>
              {isSubmitting ? "Creating Farm..." : "Create Farm"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
