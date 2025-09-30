import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AnimalForm from "./AnimalForm";
import AnimalDetails from "./AnimalDetails";

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  birth_date: string | null;
}

interface AnimalListProps {
  farmId: string;
}

const AnimalList = ({ farmId }: AnimalListProps) => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAnimals();
  }, [farmId]);

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
    setLoading(false);
  };

  if (selectedAnimalId) {
    return <AnimalDetails animalId={selectedAnimalId} onBack={() => setSelectedAnimalId(null)} />;
  }

  if (showForm) {
    return (
      <AnimalForm
        farmId={farmId}
        onSuccess={() => {
          setShowForm(false);
          loadAnimals();
        }}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowForm(true)} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add New Animal
      </Button>

      {animals.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No animals yet. Add your first animal to start tracking!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {animals.map((animal) => (
            <Card
              key={animal.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedAnimalId(animal.id)}
            >
              <CardHeader>
                <CardTitle className="text-lg">{animal.name || "Unnamed"}</CardTitle>
                <CardDescription>
                  {animal.breed || "Unknown breed"} • Tag: {animal.ear_tag || "N/A"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Born: {animal.birth_date ? new Date(animal.birth_date).toLocaleDateString() : "Unknown"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnimalList;