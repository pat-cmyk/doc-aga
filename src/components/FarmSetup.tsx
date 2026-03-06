import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { Sprout, MapPin, LogOut, Users } from "lucide-react";
import { getRegions, getProvinces, getMunicipalities } from "@/lib/philippineLocations";
import { getRegionalCoordinates } from "@/lib/regionalCoordinates";
import { LocationPermissionDialog } from "@/components/permissions/LocationPermissionDialog";
import { FARM_CATEGORIES } from "@/lib/farmCategories";
import { cn } from "@/lib/utils";
interface FarmSetupProps {
  onFarmCreated: (farmId: string) => void;
}

export default function FarmSetup({ onFarmCreated }: FarmSetupProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [checkingOwnership, setCheckingOwnership] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    region: "",
    province: "",
    municipality: "",
    role_in_farm: "farmer_owner" as "farmer_owner" | "vet",
    livestock_type: "ruminant"
  });

  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);

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

  const availableProvinces = formData.region ? getProvinces(formData.region) : [];
  const availableMunicipalities = formData.region && formData.province 
    ? getMunicipalities(formData.region, formData.province) 
    : [];

  const handleRegionChange = (value: string) => {
    setFormData({ ...formData, region: value, province: "", municipality: "" });
    
    // Auto-assign default regional coordinates
    const coords = getRegionalCoordinates(value);
    if (coords) {
      setGpsCoords(coords);
    }
  };

  const handleProvinceChange = (value: string) => {
    setFormData({ ...formData, province: value, municipality: "" });
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
        if (error.code === error.PERMISSION_DENIED) {
          setShowLocationDialog(true);
        } else {
          toast({
            title: "Location error",
            description: error.message,
            variant: "destructive"
          });
        }
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

    if (!formData.region) {
      toast({
        title: "Missing information",
        description: "Please select a region",
        variant: "destructive"
      });
      return;
    }

    if (!formData.province) {
      toast({
        title: "Missing information",
        description: "Please select a province",
        variant: "destructive"
      });
      return;
    }

    if (!formData.municipality) {
      toast({
        title: "Missing information",
        description: "Please select a municipality/city",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: farmId, error } = await supabase.rpc('create_default_farm', {
        _name: formData.name,
        _region: formData.region,
        _province: formData.province,
        _municipality: formData.municipality,
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleJoinWithCode = () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Missing invitation code",
        description: "Please enter your invitation code",
        variant: "destructive"
      });
      return;
    }
    // Navigate to the invite accept page with the token
    navigate(`/invite/accept/${inviteCode.trim()}`);
  };

  const roleDescriptions = {
    farmer_owner: "I own and manage this farm",
    vet: "I provide veterinary services"
  };

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
        <CardHeader className="text-center space-y-2 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
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
              <div className="flex items-center justify-between">
                <Label>Farm Category *</Label>
                <span className="text-xs text-muted-foreground">Uri ng Farm</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {FARM_CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    disabled={!category.enabled}
                    onClick={() => category.enabled && setFormData({ ...formData, livestock_type: category.value })}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-1.5 p-3 sm:p-4 min-h-[120px] rounded-lg border-2 transition-all duration-200",
                      category.enabled && formData.livestock_type === category.value
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : category.enabled
                          ? "border-border bg-background hover:border-primary/40 hover:bg-primary/5"
                          : "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                    )}
                  >
                    {/* Coming Soon badge for disabled categories */}
                    {!category.enabled && (
                      <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0">
                        Coming Soon
                      </Badge>
                    )}

                    {/* Emoji icon */}
                    <span className="text-3xl sm:text-4xl" role="img" aria-label={category.englishLabel}>
                      {category.emoji}
                    </span>

                    {/* English + Filipino labels */}
                    <div className="text-center">
                      <span className={cn(
                        "block text-sm font-semibold",
                        category.enabled && formData.livestock_type === category.value
                          ? "text-primary"
                          : "text-foreground"
                      )}>
                        {category.englishLabel}
                      </span>
                      <span className={cn(
                        "block text-xs",
                        category.enabled && formData.livestock_type === category.value
                          ? "text-primary/70"
                          : "text-muted-foreground"
                      )}>
                        {category.filipinoLabel}
                      </span>
                    </div>

                    {/* Species subtitle */}
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {category.speciesSubtitle}
                    </span>

                    {/* Selected checkmark */}
                    {category.enabled && formData.livestock_type === category.value && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
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

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="region">Region *</Label>
                <Select value={formData.region} onValueChange={handleRegionChange}>
                  <SelectTrigger id="region">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {getRegions().map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="province">Province *</Label>
                <Select 
                  value={formData.province} 
                  onValueChange={handleProvinceChange}
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

              <div className="space-y-2">
                <Label htmlFor="municipality">Municipality/City *</Label>
                <Select 
                  value={formData.municipality} 
                  onValueChange={(value) => setFormData({ ...formData, municipality: value })}
                  disabled={!formData.province}
                >
                  <SelectTrigger id="municipality">
                    <SelectValue placeholder={formData.province ? "Select municipality/city" : "Select province first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMunicipalities.map((municipality) => (
                      <SelectItem key={municipality} value={municipality}>
                        {municipality}
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

          {/* Divider */}
          <div className="relative my-8">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-4 text-sm text-muted-foreground">
              OR
            </span>
          </div>

          {/* Join as Farm Hand Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary/50 flex items-center justify-center">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium">Joining an existing farm?</h3>
                <p className="text-sm text-muted-foreground">
                  If you're a farm hand, ask your farm owner to send you an invitation link.
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="invite-code">Have an invitation code?</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-code"
                  placeholder="Enter invitation code..."
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleJoinWithCode}
                  disabled={!inviteCode.trim()}
                >
                  Join Farm
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The invitation code is the last part of the invitation link sent by your farm owner.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <LocationPermissionDialog
        open={showLocationDialog}
        onOpenChange={setShowLocationDialog}
        onRetry={fetchCurrentLocation}
      />
    </div>
  );
}
