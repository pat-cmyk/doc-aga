import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, Milk, Syringe, Stethoscope, Calendar, Camera, Users, Baby, Scale, Wheat, WifiOff, Download, CheckCircle, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import MilkingRecords from "./MilkingRecords";
import HealthRecords from "./HealthRecords";
import AIRecords from "./AIRecords";
import { WeightRecords } from "./WeightRecords";
import { FeedingRecords } from "./FeedingRecords";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/ui/stage-badge";
import { 
  calculateLifeStage, 
  calculateMilkingStage, 
  getLifeStageBadgeColor, 
  getMilkingStageBadgeColor,
  type AnimalStageData 
} from "@/lib/animalStages";
import { getCachedAnimalDetails, getCachedRecords, updateRecordsCache } from "@/lib/dataCache";

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
  farmId: string;
  onBack: () => void;
}

const AnimalDetails = ({ animalId, farmId, onBack }: AnimalDetailsProps) => {
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [mother, setMother] = useState<ParentAnimal | null>(null);
  const [father, setFather] = useState<ParentAnimal | null>(null);
  const [offspring, setOffspring] = useState<OffspringAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [stageData, setStageData] = useState<AnimalStageData | null>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [caching, setCaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadAnimal();
    checkCacheStatus();
  }, [animalId]);

  const checkCacheStatus = async () => {
    const records = await getCachedRecords(animalId);
    setIsCached(!!records);
  };

  const handleDownloadForOffline = async () => {
    if (!isOnline) {
      toast({
        title: "Offline",
        description: "Connect to the internet to download data",
        variant: "destructive",
      });
      return;
    }

    setCaching(true);
    try {
      await updateRecordsCache(animalId);
      setIsCached(true);
      toast({
        title: "✅ Cached for offline use",
        description: "This animal's data is now available offline",
      });
    } catch (error) {
      toast({
        title: "❌ Cache failed",
        description: "Could not cache animal data",
        variant: "destructive",
      });
    } finally {
      setCaching(false);
    }
  };

  // Helper function to get cache status icon
  const getCacheIcon = () => {
    if (caching) {
      return (
        <span title="Downloading for offline use...">
          <Database className="h-3.5 w-3.5 text-yellow-500 animate-pulse inline-block ml-2" />
        </span>
      );
    }
    
    if (isCached) {
      return (
        <span title="Available offline">
          <Database className="h-3.5 w-3.5 text-green-500 inline-block ml-2" />
        </span>
      );
    }
    
    return (
      <span title="Not cached offline">
        <Database className="h-3.5 w-3.5 text-gray-400 inline-block ml-2" />
      </span>
    );
  };

  const loadAnimal = async () => {
    try {
      setLoading(true);

      // Try cache first
      const cached = await getCachedAnimalDetails(animalId, farmId);
      if (cached) {
        setAnimal(cached.animal as Animal);
        setMother(cached.mother as ParentAnimal | null);
        setFather(cached.father as ParentAnimal | null);
        setOffspring(cached.offspring as OffspringAnimal[]);
        setLoading(false); // Show cached data immediately
      }

      // If offline and we have cached data, stop here
      if (!isOnline) {
        setLoading(false); // Always stop loading when offline
        if (!cached) {
          setAnimal(null); // Set to null so UI can show proper message
          toast({
            title: "Offline",
            description: "No cached data available for this animal",
            variant: "default"
          });
        }
        return;
      }

      // Fetch fresh data from database if online
      const { data, error } = await supabase
        .from("animals")
        .select("*")
        .eq("id", animalId)
        .single();

      if (error) throw error;
      setAnimal(data as Animal);

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
        
        // Get latest AI record with pregnancy info
        const { data: aiRecords } = await supabase
          .from("ai_records")
          .select("performed_date, pregnancy_confirmed, expected_delivery_date")
          .eq("animal_id", animalId)
          .not("performed_date", "is", null)
          .order("performed_date", { ascending: false })
          .limit(1);
        
        // Check for confirmed pregnancy with expected delivery date
        if (aiRecords && aiRecords.length > 0 && aiRecords[0].pregnancy_confirmed && aiRecords[0].expected_delivery_date) {
          setExpectedDeliveryDate(aiRecords[0].expected_delivery_date);
        } else {
          setExpectedDeliveryDate(null);
        }
        
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

  // Show helpful message when offline with no data
  if (!animal && !isOnline) {
    return (
      <Card className="m-4">
        <CardContent className="pt-6 text-center">
          <WifiOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">No Offline Data Available</p>
          <p className="text-muted-foreground mb-4">
            This animal's data hasn't been cached yet. Connect to the internet to view and download it.
          </p>
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </CardContent>
      </Card>
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
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="relative">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                  <AvatarImage 
                    src={animal.avatar_url ? `${animal.avatar_url}?t=${new Date().getTime()}` : undefined} 
                    alt={animal.name || "Animal"} 
                    key={animal.avatar_url}
                  />
                  <AvatarFallback className="text-lg sm:text-xl">{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-1 -right-1 h-7 w-7 sm:h-8 sm:w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !isOnline}
                  title={!isOnline ? "Available when online" : ""}
                >
                  {uploading ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Camera className="h-3 w-3 sm:h-4 sm:w-4" />}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <CardTitle className="text-lg sm:text-2xl truncate">{animal.name}</CardTitle>
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
                  {expectedDeliveryDate && (
                    <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                      <Baby className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Due: </span>
                      {formatDistanceToNow(new Date(expectedDeliveryDate), { addSuffix: true })}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs sm:text-sm flex items-center">
                  <span className="truncate">{animal.breed} • Tag: {animal.ear_tag}</span>
                  {getCacheIcon()}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 sm:pt-6">
          {/* Offline Indicator */}
          {!isOnline && (
            <Alert className="border-muted mb-4">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                Viewing cached data. Some features are disabled while offline.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
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
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
              <h3 className="text-sm font-semibold mb-2 sm:mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Parents
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
              <h3 className="text-sm font-semibold mb-2 sm:mb-3 flex items-center gap-2">
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

      <Tabs defaultValue={animal?.gender?.toLowerCase() === 'female' ? 'milking' : 'weight'} className="space-y-4">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start sm:justify-between gap-1 sm:gap-2 p-1">
          {animal?.gender?.toLowerCase() === 'female' && (
            <TabsTrigger value="milking" className="flex-shrink-0 min-h-[48px] px-3 sm:flex-1">
              <Milk className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Milking</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="weight" className="flex-shrink-0 min-h-[48px] px-3 sm:flex-1">
            <Scale className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Weight</span>
          </TabsTrigger>
          <TabsTrigger value="feeding" className="flex-shrink-0 min-h-[48px] px-3 sm:flex-1">
            <Wheat className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Feeding</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="flex-shrink-0 min-h-[48px] px-3 sm:flex-1">
            <Stethoscope className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Health</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-shrink-0 min-h-[48px] px-3 sm:flex-1">
            <Calendar className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">AI/Breeding</span>
          </TabsTrigger>
        </TabsList>

        {animal?.gender?.toLowerCase() === 'female' && (
          <TabsContent value="milking">
            <MilkingRecords animalId={animalId} />
          </TabsContent>
        )}

        <TabsContent value="weight">
          <WeightRecords animalId={animalId} animalBirthDate={animal?.birth_date || undefined} />
        </TabsContent>

        <TabsContent value="feeding">
          <FeedingRecords animalId={animalId} />
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