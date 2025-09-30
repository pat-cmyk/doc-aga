import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PHILIPPINE_PROVINCES = [
  "Abra", "Agusan del Norte", "Agusan del Sur", "Aklan", "Albay", "Antique", "Apayao", "Aurora",
  "Basilan", "Bataan", "Batanes", "Batangas", "Benguet", "Biliran", "Bohol", "Bukidnon", "Bulacan",
  "Cagayan", "Camarines Norte", "Camarines Sur", "Camiguin", "Capiz", "Catanduanes", "Cavite", "Cebu",
  "Cotabato", "Davao de Oro", "Davao del Norte", "Davao del Sur", "Davao Occidental", "Davao Oriental",
  "Dinagat Islands", "Eastern Samar", "Guimaras", "Ifugao", "Ilocos Norte", "Ilocos Sur", "Iloilo",
  "Isabela", "Kalinga", "La Union", "Laguna", "Lanao del Norte", "Lanao del Sur", "Leyte",
  "Maguindanao del Norte", "Maguindanao del Sur", "Marinduque", "Masbate", "Misamis Occidental",
  "Misamis Oriental", "Mountain Province", "Negros Occidental", "Negros Oriental", "Northern Samar",
  "Nueva Ecija", "Nueva Vizcaya", "Occidental Mindoro", "Oriental Mindoro", "Palawan", "Pampanga",
  "Pangasinan", "Quezon", "Quirino", "Rizal", "Romblon", "Samar", "Sarangani", "Siquijor", "Sorsogon",
  "South Cotabato", "Southern Leyte", "Sultan Kudarat", "Sulu", "Surigao del Norte", "Surigao del Sur",
  "Tarlac", "Tawi-Tawi", "Zambales", "Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay"
];

interface Farm {
  id: string;
  name: string;
  region: string | null;
  gps_lat: number;
  gps_lng: number;
  created_at: string;
}

interface FarmListProps {
  onSelectFarm: (farmId: string) => void;
}

const FarmList = ({ onSelectFarm }: FarmListProps) => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    region: "",
    gps_lat: "",
    gps_lng: ""
  });

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    const { data, error } = await supabase
      .from("farms")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading farms",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setFarms(data || []);
    }
    setLoading(false);
  };

  const requestLocationPermission = () => {
    setShowLocationDialog(true);
  };

  const fetchCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({
        title: "Not supported",
        description: "Geolocation is not supported by your browser",
        variant: "destructive"
      });
      return;
    }

    setFetchingLocation(true);
    setShowLocationDialog(false);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          gps_lat: position.coords.latitude.toFixed(6),
          gps_lng: position.coords.longitude.toFixed(6)
        }));
        toast({
          title: "Location captured",
          description: "GPS coordinates added successfully"
        });
        setFetchingLocation(false);
      },
      (error) => {
        setFetchingLocation(false);
        let errorMessage = "Could not get current location";
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access was denied. Please enable it in your browser settings or enter GPS coordinates manually";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location services are unavailable. Please check your device settings or enter coordinates manually";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again or enter coordinates manually";
            break;
        }
        
        toast({
          title: "Location error",
          description: errorMessage,
          variant: "destructive"
        });
      },
      options
    );
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.gps_lat || !formData.gps_lng) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("farms").insert({
      owner_id: user?.id,
      name: formData.name,
      region: formData.region || null,
      gps_lat: parseFloat(formData.gps_lat),
      gps_lng: parseFloat(formData.gps_lng)
    });

    setCreating(false);
    if (error) {
      toast({
        title: "Error creating farm",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success!",
        description: "Farm created successfully"
      });
      setOpen(false);
      setFormData({ name: "", region: "", gps_lat: "", gps_lng: "" });
      loadFarms();
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AlertDialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Allow Location Access</AlertDialogTitle>
            <AlertDialogDescription>
              We need your location to automatically fill in the GPS coordinates for your farm. 
              This helps ensure accurate tracking and management of your farm location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Enter Manually</AlertDialogCancel>
            <AlertDialogAction onClick={fetchCurrentLocation}>
              Allow Location Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Create New Farm
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Farm</DialogTitle>
            <DialogDescription>Add a new farm with GPS coordinates</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFarm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Farm Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Golden Forage Farm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Province</Label>
              <Select value={formData.region} onValueChange={(value) => setFormData(prev => ({ ...prev, region: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a province" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {PHILIPPINE_PROVINCES.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>GPS Coordinates *</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={requestLocationPermission}
                  disabled={fetchingLocation}
                >
                  {fetchingLocation ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4 mr-2" />
                  )}
                  Use Current Location
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Latitude"
                  value={formData.gps_lat}
                  onChange={(e) => setFormData(prev => ({ ...prev, gps_lat: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Longitude"
                  value={formData.gps_lng}
                  onChange={(e) => setFormData(prev => ({ ...prev, gps_lng: e.target.value }))}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Farm"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {farms.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No farms yet. Create your first farm to get started!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {farms.map((farm) => (
            <Card
              key={farm.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectFarm(farm.id)}
            >
              <CardHeader>
                <CardTitle className="text-lg">{farm.name}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {farm.region || "No region specified"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  GPS: {farm.gps_lat.toFixed(4)}, {farm.gps_lng.toFixed(4)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FarmList;