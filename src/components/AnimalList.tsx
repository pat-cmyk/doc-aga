import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AnimalForm from "./AnimalForm";
import AnimalDetails from "./AnimalDetails";
import { calculateLifeStage, calculateMilkingStage, getLifeStageBadgeColor, getMilkingStageBadgeColor } from "@/lib/animalStages";

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  birth_date: string | null;
  gender: string | null;
  milking_start_date: string | null;
  lifeStage?: string | null;
  milkingStage?: string | null;
}

interface AnimalListProps {
  farmId: string;
  initialSelectedAnimalId?: string | null;
}

const AnimalList = ({ farmId, initialSelectedAnimalId }: AnimalListProps) => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(initialSelectedAnimalId || null);
  const { toast } = useToast();

  useEffect(() => {
    if (initialSelectedAnimalId) {
      setSelectedAnimalId(initialSelectedAnimalId);
    }
  }, [initialSelectedAnimalId]);

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
      setLoading(false);
      return;
    }

    // Calculate stages for each animal
    const animalsWithStages = await Promise.all(
      (data || []).map(async (animal) => {
        if (animal.gender?.toLowerCase() !== "female") {
          return { ...animal, lifeStage: null, milkingStage: null };
        }

        // Get offspring count
        const { count: offspringCount } = await supabase
          .from("animals")
          .select("*", { count: "exact", head: true })
          .eq("mother_id", animal.id);

        // Get last calving date (most recent offspring birth date)
        const { data: offspring } = await supabase
          .from("animals")
          .select("birth_date")
          .eq("mother_id", animal.id)
          .order("birth_date", { ascending: false })
          .limit(1);

        // Check for recent milking records (within last 60 days)
        const { data: recentMilking } = await supabase
          .from("milking_records")
          .select("id")
          .eq("animal_id", animal.id)
          .gte("record_date", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        // Check for active AI records
        const { data: aiRecords } = await supabase
          .from("ai_records")
          .select("performed_date")
          .eq("animal_id", animal.id)
          .order("scheduled_date", { ascending: false })
          .limit(1);

        const stageData = {
          birthDate: animal.birth_date ? new Date(animal.birth_date) : null,
          gender: animal.gender,
          milkingStartDate: animal.milking_start_date ? new Date(animal.milking_start_date) : null,
          offspringCount: offspringCount || 0,
          lastCalvingDate: offspring?.[0]?.birth_date ? new Date(offspring[0].birth_date) : null,
          hasRecentMilking: (recentMilking?.length || 0) > 0,
          hasActiveAI: (aiRecords?.length || 0) > 0 && !offspringCount,
        };

        const lifeStage = calculateLifeStage(stageData);
        const milkingStage = calculateMilkingStage(stageData);

        return { ...animal, lifeStage, milkingStage };
      })
    );

    setAnimals(animalsWithStages);
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
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Born: {animal.birth_date ? new Date(animal.birth_date).toLocaleDateString() : "Unknown"}
                </p>
                {(animal.lifeStage || animal.milkingStage) && (
                  <div className="flex flex-wrap gap-2">
                    {animal.lifeStage && (
                      <Badge className={`${getLifeStageBadgeColor(animal.lifeStage)} text-xs font-medium border-0`}>
                        {animal.lifeStage}
                      </Badge>
                    )}
                    {animal.milkingStage && (
                      <Badge className={`${getMilkingStageBadgeColor(animal.milkingStage)} text-xs font-medium border-0`}>
                        {animal.milkingStage}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnimalList;