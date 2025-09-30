import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, Milk, Syringe, Stethoscope, Calendar, Camera, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays } from "date-fns";
import MilkingRecords from "./MilkingRecords";
import HealthRecords from "./HealthRecords";
import AIRecords from "./AIRecords";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/ui/stage-badge";
import { 
  calculateLifeStage, 
  calculateMilkingStage, 
  getLifeStageBadgeColor, 
  getMilkingStageBadgeColor,
  type AnimalStageData 
} from "@/lib/animalStages";

// Helper function to get stage definitions
const getLifeStageDefinition = (stage: string | null): string => {
  switch (stage) {
    case "Calf":
      return "Young cattle aged 0-8 months";
    case "Heifer Calf":
      return "Female cattle aged 8-12 months";
    case "Yearling Heifer":
      return "Female cattle aged 12-15 months";
    case "Breeding Heifer":
      return "Female cattle 15+ months old, ready for breeding but not yet bred";
    case "Pregnant Heifer":
      return "Female cattle 15+ months old with confirmed pregnancy, no previous offspring";
    case "First-Calf Heifer":
      return "Female cattle with one offspring";
    case "Mature Cow":
      return "Female cattle with two or more offspring";
    default:
      return "";
  }
};

const getMilkingStageDefinition = (stage: string | null): string => {
  switch (stage) {
    case "Early Lactation":
      return "0-100 days after calving - Peak milk production period";
    case "Mid-Lactation":
      return "100-200 days after calving - Sustained production period";
    case "Late Lactation":
      return "200-305 days after calving - Declining production period";
    case "Dry Period":
      return "Non-lactating period before next calving, typically 60 days";
    default:
      return "";
  }
};

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  birth_date: string | null;
  milking_start_date: string | null;
  avatar_url: string | null;
  mother_id: string | null;
  father_id: string | null;
  gender: string | null;
  life_stage: string | null;
  milking_stage: string | null;
}

interface ParentAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
}

interface OffspringAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  birth_date: string | null;
}

interface AnimalDetailsProps {
  animalId: string;
  onBack: () => void;
}

const AnimalDetails = ({ animalId, onBack }: AnimalDetailsProps) => {
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [mother, setMother] = useState<ParentAnimal | null>(null);
  const [father, setFather] = useState<ParentAnimal | null>(null);
  const [offspring, setOffspring] = useState<OffspringAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [stageData, setStageData] = useState<AnimalStageData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAnimal();
  }, [animalId]);

  const loadAnimal = async () => {
    try {
      const { data, error } = await supabase
        .from("animals")
        .select("*")
        .eq("id", animalId)
        .single();

      if (error) throw error;
      setAnimal(data);

      // Load parent information
      if (data.mother_id) {
        const { data: motherData } = await supabase
          .from("animals")
          .select("id, name, ear_tag")
          .eq("id", data.mother_id)
          .single();
        if (motherData) setMother(motherData);
      }

      if (data.father_id) {
        const { data: fatherData } = await supabase
          .from("animals")
          .select("id, name, ear_tag")
          .eq("id", data.father_id)
          .single();
        if (fatherData) setFather(fatherData);
      }

      // Load offspring
      const { data: offspringData } = await supabase
        .from("animals")
        .select("id, name, ear_tag, birth_date")
        .or(`mother_id.eq.${animalId},father_id.eq.${animalId}`)
        .eq("is_deleted", false)
        .order("birth_date", { ascending: false });

      if (offspringData) setOffspring(offspringData);

      // Fetch additional data for stage calculation - with error handling
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        // Get latest AI record
        const { data: aiRecords } = await supabase
          .from("ai_records")
          .select("performed_date")
          .eq("animal_id", animalId)
          .not("performed_date", "is", null)
          .order("performed_date", { ascending: false })
          .limit(1);
        
        // Get recent milking records (last 30 days)
        const { data: milkingRecords } = await supabase
          .from("milking_records")
          .select("record_date")
          .eq("animal_id", animalId)
          .gte("record_date", thirtyDaysAgo.toISOString().split('T')[0])
          .limit(1);
        
        // Calculate last calving date from youngest offspring
        const lastCalvingDate = offspringData && offspringData.length > 0 && offspringData[0].birth_date
          ? new Date(offspringData[0].birth_date)
          : null;
        
        // Check if there's an active AI (within last 283 days for gestation)
        const hasActiveAI = aiRecords && aiRecords.length > 0 && aiRecords[0].performed_date
          ? differenceInDays(now, new Date(aiRecords[0].performed_date)) <= 283
          : false;
        
        setStageData({
          birthDate: data.birth_date ? new Date(data.birth_date) : null,
          gender: data.gender,
          milkingStartDate: data.milking_start_date ? new Date(data.milking_start_date) : null,
          offspringCount: offspringData ? offspringData.length : 0,
          lastCalvingDate,
          hasRecentMilking: milkingRecords ? milkingRecords.length > 0 : false,
          hasActiveAI
        });
      } catch (stageError) {
        console.error("Error calculating stage data:", stageError);
        // Set default stage data if calculation fails
        setStageData({
          birthDate: data.birth_date ? new Date(data.birth_date) : null,
          gender: data.gender,
          milkingStartDate: data.milking_start_date ? new Date(data.milking_start_date) : null,
          offspringCount: offspringData ? offspringData.length : 0,
          lastCalvingDate: null,
          hasRecentMilking: false,
          hasActiveAI: false
        });
      }
    } catch (error: any) {
      toast({
        title: "Error loading animal",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${animalId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('animal-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('animal-photos')
        .getPublicUrl(filePath);

      // Update animal record
      const { error: updateError } = await supabase
        .from('animals')
        .update({ avatar_url: publicUrl })
        .eq('id', animalId);

      if (updateError) throw updateError;

      toast({
        title: "Success!",
        description: "Avatar updated successfully"
      });

      loadAnimal();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!animal) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Animal not found</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    );
  }

  // Safely calculate stages with error handling
  let computedLifeStage: string | null = null;
  let computedMilkingStage: string | null = null;
  
  try {
    computedLifeStage = stageData ? calculateLifeStage(stageData) : null;
    computedMilkingStage = stageData ? calculateMilkingStage(stageData) : null;
  } catch (error) {
    console.error("Error calculating stages:", error);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={animal.avatar_url || undefined} alt={animal.name || "Animal"} />
                <AvatarFallback>{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-2xl">{animal.name}</CardTitle>
                {computedLifeStage && (
                  <StageBadge 
                    stage={computedLifeStage}
                    definition={getLifeStageDefinition(computedLifeStage)}
                    colorClass={getLifeStageBadgeColor(computedLifeStage)}
                  />
                )}
                {computedMilkingStage && (
                  <StageBadge 
                    stage={computedMilkingStage}
                    definition={getMilkingStageDefinition(computedMilkingStage)}
                    colorClass={getMilkingStageBadgeColor(computedMilkingStage)}
                  />
                )}
              </div>
              <CardDescription>
                {animal.breed} • Tag: {animal.ear_tag}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Birth Date</p>
              <p className="font-medium">
                {animal.birth_date ? new Date(animal.birth_date).toLocaleDateString() : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Milking Start</p>
              <p className="font-medium">
                {animal.milking_start_date ? new Date(animal.milking_start_date).toLocaleDateString() : "Not yet"}
              </p>
            </div>
          </div>

          {/* Parents Section */}
          {(mother || father) && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Parents
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {mother && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mother</p>
                    <Badge variant="secondary" className="text-sm">
                      {mother.name || mother.ear_tag || "Unknown"}
                    </Badge>
                  </div>
                )}
                {father && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Father</p>
                    <Badge variant="secondary" className="text-sm">
                      {father.name || father.ear_tag || "Unknown"}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Offspring Section */}
          {offspring.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Offspring ({offspring.length})
              </h3>
              <div className="space-y-2">
                {offspring.map((child) => (
                  <div key={child.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{child.name || child.ear_tag || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">
                        Born: {child.birth_date ? new Date(child.birth_date).toLocaleDateString() : "Unknown"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="milking" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="milking">
            <Milk className="h-4 w-4 mr-2" />
            Milking
          </TabsTrigger>
          <TabsTrigger value="health">
            <Stethoscope className="h-4 w-4 mr-2" />
            Health
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Calendar className="h-4 w-4 mr-2" />
            AI/Breeding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="milking">
          <MilkingRecords animalId={animalId} />
        </TabsContent>

        <TabsContent value="health">
          <HealthRecords animalId={animalId} />
        </TabsContent>

        <TabsContent value="ai">
          <AIRecords animalId={animalId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnimalDetails;