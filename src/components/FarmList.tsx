import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
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
        },
        (error) => {
          toast({
            title: "Location error",
            description: "Could not get current location",
            variant: "destructive"
          });
        }
      );
    }
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
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                placeholder="Eastern Visayas"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>GPS Coordinates *</Label>
                <Button type="button" variant="outline" size="sm" onClick={getCurrentLocation}>
                  <MapPin className="h-4 w-4 mr-2" />
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