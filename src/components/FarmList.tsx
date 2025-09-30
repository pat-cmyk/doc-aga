import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin, Loader2, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FarmProfile from "./FarmProfile";

const REGIONS_WITH_PROVINCES = {
  "Region I (Ilocos)": ["Ilocos Norte", "Ilocos Sur", "La Union", "Pangasinan"],
  "Region II (Cagayan Valley)": ["Batanes", "Cagayan", "Isabela", "Nueva Vizcaya", "Quirino"],
  "Region III (Central Luzon)": ["Aurora", "Bataan", "Bulacan", "Nueva Ecija", "Pampanga", "Tarlac", "Zambales"],
  "Region IV-A (CALABARZON)": ["Batangas", "Cavite", "Laguna", "Quezon", "Rizal"],
  "MIMAROPA Region": ["Marinduque", "Occidental Mindoro", "Oriental Mindoro", "Palawan", "Romblon"],
  "Region V (Bicol)": ["Albay", "Camarines Norte", "Camarines Sur", "Catanduanes", "Masbate", "Sorsogon"],
  "Region VI (Western Visayas)": ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo", "Negros Occidental"],
  "Region VII (Central Visayas)": ["Bohol", "Cebu", "Negros Oriental", "Siquijor"],
  "Region VIII (Eastern Visayas)": ["Biliran", "Eastern Samar", "Leyte", "Northern Samar", "Samar", "Southern Leyte"],
  "Region IX (Zamboanga Peninsula)": ["Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay"],
  "Region X (Northern Mindanao)": ["Bukidnon", "Camiguin", "Lanao del Norte", "Misamis Occidental", "Misamis Oriental"],
  "Region XI (Davao)": ["Davao de Oro", "Davao del Norte", "Davao del Sur", "Davao Occidental", "Davao Oriental"],
  "Region XII (SOCCSKSARGEN)": ["Cotabato", "Sarangani", "South Cotabato", "Sultan Kudarat"],
  "NCR (National Capital Region)": ["Metro Manila"],
  "CAR (Cordillera)": ["Abra", "Apayao", "Benguet", "Ifugao", "Kalinga", "Mountain Province"],
  "BARMM": ["Basilan", "Lanao del Sur", "Maguindanao del Norte", "Maguindanao del Sur", "Sulu", "Tawi-Tawi"],
  "Region XIII (Caraga)": ["Agusan del Norte", "Agusan del Sur", "Dinagat Islands", "Surigao del Norte", "Surigao del Sur"]
};

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
  const [editOpen, setEditOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [farmToDelete, setFarmToDelete] = useState<Farm | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    region: "",
    province: "",
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
        description: "Please fill in farm name and GPS coordinates",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    // Store the full region and province info together
    const regionInfo = selectedRegion && formData.province 
      ? `${selectedRegion} - ${formData.province}`
      : formData.province || selectedRegion || null;
    
    const { error } = await supabase.from("farms").insert({
      owner_id: user?.id,
      name: formData.name,
      region: regionInfo,
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
      setFormData({ name: "", region: "", province: "", gps_lat: "", gps_lng: "" });
      setSelectedRegion("");
      loadFarms();
    }
  };

  const handleUpdateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.gps_lat || !formData.gps_lng || !editingFarm) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    
    const regionInfo = selectedRegion && formData.province 
      ? `${selectedRegion} - ${formData.province}`
      : formData.province || selectedRegion || null;
    
    const { error } = await supabase
      .from("farms")
      .update({
        name: formData.name,
        region: regionInfo,
        gps_lat: parseFloat(formData.gps_lat),
        gps_lng: parseFloat(formData.gps_lng)
      })
      .eq("id", editingFarm.id);

    setCreating(false);
    if (error) {
      toast({
        title: "Error updating farm",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success!",
        description: "Farm updated successfully"
      });
      setEditOpen(false);
      setEditingFarm(null);
      setFormData({ name: "", region: "", province: "", gps_lat: "", gps_lng: "" });
      setSelectedRegion("");
      loadFarms();
    }
  };

  const handleDeleteFarm = async () => {
    if (!farmToDelete) return;

    const { error } = await supabase
      .from("farms")
      .update({ is_deleted: true })
      .eq("id", farmToDelete.id);

    if (error) {
      toast({
        title: "Error deleting farm",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success!",
        description: "Farm deleted successfully"
      });
      setDeleteDialogOpen(false);
      setFarmToDelete(null);
      loadFarms();
    }
  };

  const openEditDialog = (farm: Farm, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFarm(farm);
    
    // Parse region and province from stored data
    const regionData = farm.region?.split(" - ") || [];
    const region = regionData[0] || "";
    const province = regionData[1] || "";
    
    setSelectedRegion(region);
    setFormData({
      name: farm.name,
      region,
      province,
      gps_lat: farm.gps_lat.toString(),
      gps_lng: farm.gps_lng.toString()
    });
    setEditOpen(true);
  };

  const openDeleteDialog = (farm: Farm, e: React.MouseEvent) => {
    e.stopPropagation();
    setFarmToDelete(farm);
    setDeleteDialogOpen(true);
  };

  const availableProvinces = selectedRegion ? REGIONS_WITH_PROVINCES[selectedRegion as keyof typeof REGIONS_WITH_PROVINCES] || [] : [];

  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    setFormData(prev => ({ ...prev, region, province: "" }));
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (selectedFarmId) {
    return (
      <FarmProfile
        farmId={selectedFarmId}
        onBack={() => setSelectedFarmId(null)}
      />
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Farm</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{farmToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFarm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
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
              <div className="flex items-center justify-between">
                <Label>GPS Location *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select value={selectedRegion} onValueChange={handleRegionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
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
                onValueChange={(value) => setFormData(prev => ({ ...prev, province: value }))}
                disabled={!selectedRegion}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedRegion ? "Select a province" : "Select region first"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableProvinces.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Farm"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Farm</DialogTitle>
            <DialogDescription>Update farm details and GPS coordinates</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateFarm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Farm Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Golden Forage Farm"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>GPS Location *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="edit-region">Region</Label>
              <Select value={selectedRegion} onValueChange={handleRegionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {Object.keys(REGIONS_WITH_PROVINCES).map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-province">Province</Label>
              <Select 
                value={formData.province} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, province: value }))}
                disabled={!selectedRegion}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedRegion ? "Select a province" : "Select region first"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableProvinces.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Farm"}
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
              className="cursor-pointer hover:shadow-md transition-shadow relative"
              onClick={() => setSelectedFarmId(farm.id)}
            >
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => openEditDialog(farm, e)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={(e) => openDeleteDialog(farm, e)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardHeader>
                <CardTitle className="text-lg pr-16">{farm.name}</CardTitle>
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