import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, MapPin, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AnimalForm from "./AnimalForm";
import AnimalDetails from "./AnimalDetails";

interface Farm {
  id: string;
  name: string;
  region: string | null;
  gps_lat: number;
  gps_lng: number;
}

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  birth_date: string | null;
}

interface FarmProfileProps {
  farmId: string;
  onBack: () => void;
}

const FarmProfile = ({ farmId, onBack }: FarmProfileProps) => {
  const [farm, setFarm] = useState<Farm | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadFarmData();
  }, [farmId]);

  const loadFarmData = async () => {
    setLoading(true);
    
    // Load farm details
    const { data: farmData, error: farmError } = await supabase
      .from("farms")
      .select("*")
      .eq("id", farmId)
      .single();

    if (farmError) {
      toast({
        title: "Error loading farm",
        description: farmError.message,
        variant: "destructive"
      });
    } else {
      setFarm(farmData);
    }

    // Load animals
    await loadAnimals();
    setLoading(false);
  };

  const loadAnimals = async () => {
    const { data, error } = await supabase
      .from("animals")
      .select("*")
      .eq("farm_id", farmId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error loading animals",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setAnimals(data || []);
    }
  };

  const handleAnimalAdded = () => {
    setShowAddDialog(false);
    loadAnimals();
  };

  if (selectedAnimalId) {
    return (
      <AnimalDetails
        animalId={selectedAnimalId}
        onBack={() => setSelectedAnimalId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!farm) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Farm not found</p>
          <Button onClick={onBack} className="mt-4 mx-auto block">
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Farm Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <CardTitle>{farm.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" />
                {farm.region || "No region specified"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">GPS Coordinates:</span>
              <span className="font-medium">{farm.gps_lat}, {farm.gps_lng}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Animals Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Animals</CardTitle>
              <CardDescription>Manage animals in this farm</CardDescription>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Animal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Animal</DialogTitle>
                  <DialogDescription>
                    Create a digital baby book for your animal
                  </DialogDescription>
                </DialogHeader>
                <AnimalForm
                  farmId={farmId}
                  onSuccess={handleAnimalAdded}
                  onCancel={() => setShowAddDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {animals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No animals yet. Add your first animal to get started!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {animals.map((animal) => (
                <Card
                  key={animal.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setSelectedAnimalId(animal.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-base">
                      {animal.name || "Unnamed"}
                    </CardTitle>
                    <CardDescription>Tag: {animal.ear_tag}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      {animal.breed && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Breed:</span>
                          <span>{animal.breed}</span>
                        </div>
                      )}
                      {animal.birth_date && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Birth:</span>
                          <span>{new Date(animal.birth_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FarmProfile;
