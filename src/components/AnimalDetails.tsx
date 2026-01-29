import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, Milk, Stethoscope, Calendar, Users, Baby, Scale, Wheat, WifiOff, Download, CheckCircle, Database, Globe, Copy, Image, Wallet, Pencil, Home, ShoppingCart, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useIsMobile } from "@/hooks/use-mobile";
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
  calculateMaleStage,
  getLifeStageBadgeColor, 
  getMilkingStageBadgeColor,
  displayStageForSpecies,
  type AnimalStageData 
} from "@/lib/animalStages";
import { getCachedAnimalDetails, getCachedRecords, updateRecordsCache } from "@/lib/dataCache";
import { RecalculateSingleAnimalButton } from "./animal-details/RecalculateSingleAnimalButton";
import { RecordAnimalExitDialog } from "./animal-exit/RecordAnimalExitDialog";
import { DryOffAnimalButton } from "./animal-details/DryOffAnimalButton";
import { GrowthBenchmarkCard } from "./growth/GrowthBenchmarkCard";
import { PhotoTimelineTab } from "./photo-timeline/PhotoTimelineTab";
import { EditAcquisitionWeightDialog } from "./animal-details/EditAcquisitionWeightDialog";
import { EditAnimalDialog } from "./animal-details/EditAnimalDialog";
import { AnimalExpenseTab } from "./animal-expenses/AnimalExpenseTab";
import { GenderBadge } from "@/components/ui/gender-indicator";
import { BioCardSummary } from "./animal-details/BioCardSummary";
import { CameraPhotoInput } from "@/components/ui/camera-photo-input";
const getLifeStageDefinition = (stage: string | null): string => {
  switch (stage) {
    // Cattle
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
    case "Bull Calf":
      return "Young male cattle aged 0-12 months";
    case "Young Bull":
      return "Male cattle aged 12-24 months";
    case "Mature Bull":
      return "Male cattle aged 24+ months";
    
    // Carabao
    case "Young Carabao":
      return "Female carabao aged 8-12 months";
    case "Breeding Carabao":
      return "Female carabao 15+ months old, ready for breeding";
    case "Pregnant Carabao":
      return "Female carabao with confirmed pregnancy, no previous offspring";
    case "First-Time Mother":
      return "Female carabao with one offspring";
    case "Mature Carabao":
      return "Female carabao with two or more offspring";
    
    // Goats
    case "Kid":
      return "Young goat aged 0-8 months";
    case "Young Doe":
      return "Female goat aged 8-12 months";
    case "Breeding Doe":
      return "Female goat 15+ months old, ready for breeding";
    case "Pregnant Doe":
      return "Female goat with confirmed pregnancy";
    case "Lactating Doe":
      return "Female goat currently producing milk";
    case "Dry Doe":
      return "Female goat in non-lactating rest period";
    case "Buck Kid":
      return "Young male goat aged 0-12 months";
    case "Young Buck":
      return "Male goat aged 12-24 months";
    case "Mature Buck":
      return "Male goat aged 24+ months";
    
    // Sheep
    case "Lamb":
      return "Young sheep aged 0-8 months";
    case "Young Ewe":
      return "Female sheep aged 8-12 months";
    case "Breeding Ewe":
      return "Female sheep 15+ months old, ready for breeding";
    case "Pregnant Ewe":
      return "Female sheep with confirmed pregnancy";
    case "Lactating Ewe":
      return "Female sheep currently producing milk";
    case "Dry Ewe":
      return "Female sheep in non-lactating rest period";
    case "Ram Lamb":
      return "Young male sheep aged 0-12 months";
    case "Young Ram":
      return "Male sheep aged 12-24 months";
    case "Mature Ram":
      return "Male sheep aged 24+ months";
    
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

// Helper to determine origin badge info
const getOriginBadgeInfo = (animal: { farm_entry_date: string | null; acquisition_type: string | null }): { label: string; iconType: 'home' | 'cart' | 'gift'; className: string } | null => {
  const isFarmBorn = animal.farm_entry_date === null;
  
  if (isFarmBorn) {
    return {
      label: "Farm Born",
      iconType: 'home',
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
    };
  }
  
  // Acquired animal
  if (animal.acquisition_type === "grant") {
    return {
      label: "Grant",
      iconType: 'gift',
      className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30"
    };
  }
  
  // Default to purchased for acquired animals
  return {
    label: "Purchased",
    iconType: 'cart',
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
  };
};

// Helper to render origin badge icon
const OriginBadgeIcon = ({ type }: { type: 'home' | 'cart' | 'gift' }) => {
  switch (type) {
    case 'home': return <Home className="h-3 w-3 mr-1" />;
    case 'cart': return <ShoppingCart className="h-3 w-3 mr-1" />;
    case 'gift': return <Gift className="h-3 w-3 mr-1" />;
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
  unique_code: string | null;
  livestock_type: string | null;
  farm_entry_date: string | null;
  birth_date_unknown: boolean | null;
  mother_unknown: boolean | null;
  father_unknown: boolean | null;
  entry_weight_kg: number | null;
  entry_weight_unknown: boolean | null;
  birth_weight_kg: number | null;
  current_weight_kg: number | null;
  acquisition_type: string | null;
  purchase_price: number | null;
  grant_source: string | null;
  grant_source_other: string | null;
  is_currently_lactating: boolean | null;
  estimated_days_in_milk: number | null;
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
  /** If true, open the edit entry weight dialog on mount */
  editWeightOnOpen?: boolean;
  /** Callback to clear the editWeight flag after it's consumed */
  onEditWeightConsumed?: () => void;
  /** If true, all editing actions are hidden (admin read-only mode) */
  readOnly?: boolean;
}

const AnimalDetails = ({ animalId, farmId, onBack, editWeightOnOpen, onEditWeightConsumed, readOnly = false }: AnimalDetailsProps) => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [editWeightDialogOpen, setEditWeightDialogOpen] = useState(false);
  const [editAnimalDialogOpen, setEditAnimalDialogOpen] = useState(false);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const isMobile = useIsMobile();
  
  // Handle opening the edit weight dialog from URL params
  useEffect(() => {
    if (editWeightOnOpen && animal && !loading) {
      setEditWeightDialogOpen(true);
      onEditWeightConsumed?.();
      // Remove editWeight from URL
      const params = new URLSearchParams(location.search);
      params.delete('editWeight');
      const newSearch = params.toString();
      navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
    }
  }, [editWeightOnOpen, animal, loading, onEditWeightConsumed, navigate, location.search]);

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
          hasActiveAI,
          livestockType: data.livestock_type
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
          hasActiveAI: false,
          livestockType: data.livestock_type
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

  const handleAvatarUpload = async (file: File) => {
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

  // Compute life stage dynamically from stageData for consistency with AnimalList
  // Fall back to DB value if stageData isn't available yet
  const isMale = animal?.gender?.toLowerCase() === 'male';
  const computedLifeStage = stageData 
    ? (isMale 
        ? calculateMaleStage(stageData) 
        : calculateLifeStage(stageData))
    : animal?.life_stage || null;
  
  const computedMilkingStage = stageData 
    ? (isMale ? null : calculateMilkingStage(stageData))
    : animal?.milking_stage || null;
  
  // Map to species-appropriate display names
  const displayLifeStage = displayStageForSpecies(computedLifeStage, animal?.livestock_type || null);

  // Determine tab count based on gender
  const isFemale = animal?.gender?.toLowerCase() === 'female';
  const tabCount = isFemale ? 7 : 6; // Milking, Weight, Feeding, Health, AI/Breeding, Photos, Costs (7 for female, 6 for male)

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          {isMobile ? (
            // Mobile: Stacked layout with details below avatar
            <div className="space-y-3">
              {/* Row 1: Back, Avatar, Actions */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <Avatar className="h-16 w-16">
                      <AvatarImage 
                        src={animal.avatar_url ? `${animal.avatar_url}?t=${new Date().getTime()}` : undefined} 
                        alt={animal.name || "Animal"} 
                        key={animal.avatar_url}
                      />
                      <AvatarFallback className="text-lg">{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
                    </Avatar>
                    {!readOnly && (
                      uploading ? (
                        <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center absolute -bottom-1 -right-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                        </div>
                      ) : (
                        <CameraPhotoInput
                          onPhotoSelected={handleAvatarUpload}
                          variant="secondary"
                          size="icon"
                          label=""
                          disabled={!isOnline}
                          className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full"
                        />
                      )
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex flex-col gap-2 items-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditWeightDialogOpen(true)}
                      disabled={!isOnline}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit Details
                    </Button>
                    <RecordAnimalExitDialog 
                      animalId={animalId}
                      animalName={animal.name || animal.ear_tag || 'Animal'}
                      farmId={farmId}
                      livestockType={animal.livestock_type || undefined}
                      earTag={animal.ear_tag || undefined}
                      onExitRecorded={onBack}
                    />
                    {animal.gender === 'Female' && (
                      <DryOffAnimalButton
                        animalId={animalId}
                        animalName={animal.name || animal.ear_tag || 'Animal'}
                        farmId={farmId}
                        isCurrentlyLactating={stageData?.hasRecentMilking || animal.milking_stage?.includes('Lactation')}
                        onSuccess={loadAnimal}
                      />
                    )}
                    <RecalculateSingleAnimalButton 
                      animalId={animalId} 
                      onSuccess={loadAnimal}
                    />
                  </div>
                )}
              </div>
              
              {/* Row 2: Animal Details (full width) */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CardTitle className="text-lg">{animal.name}</CardTitle>
                  <GenderBadge gender={animal.gender} />
                  {(() => {
                    const originInfo = getOriginBadgeInfo(animal);
                    return originInfo ? (
                      <Badge variant="outline" className={`text-xs border ${originInfo.className}`}>
                        <OriginBadgeIcon type={originInfo.iconType} />
                        {originInfo.label}
                      </Badge>
                    ) : null;
                  })()}
                  {displayLifeStage && (
                    <StageBadge 
                      stage={displayLifeStage}
                      definition={getLifeStageDefinition(displayLifeStage)}
                      colorClass={getLifeStageBadgeColor(displayLifeStage)}
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
                      Due: {formatDistanceToNow(new Date(expectedDeliveryDate), { addSuffix: true })}
                    </Badge>
                  )}
                </div>
                <CardDescription className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span>{animal.breed} • Tag: {animal.ear_tag}</span>
                    {getCacheIcon()}
                  </div>
                  {animal.unique_code && (
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3 flex-shrink-0" />
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{animal.unique_code}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(animal.unique_code!);
                          toast({
                            title: "Copied!",
                            description: "Universal ID copied to clipboard",
                          });
                        }}
                        title="Copy Universal ID"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardDescription>
              </div>
            </div>
          ) : (
            // Desktop: Horizontal layout
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <Button variant="ghost" size="sm" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      <AvatarImage 
                        src={animal.avatar_url ? `${animal.avatar_url}?t=${new Date().getTime()}` : undefined} 
                        alt={animal.name || "Animal"} 
                        key={animal.avatar_url}
                      />
                      <AvatarFallback className="text-xl">{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
                    </Avatar>
                    {!readOnly && (
                      uploading ? (
                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center absolute -bottom-1 -right-1">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        <CameraPhotoInput
                          onPhotoSelected={handleAvatarUpload}
                          variant="secondary"
                          size="icon"
                          label=""
                          disabled={!isOnline}
                          className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                        />
                      )
                    )}
                  </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-2xl truncate">{animal.name}</CardTitle>
                    <GenderBadge gender={animal.gender} />
                    {(() => {
                      const originInfo = getOriginBadgeInfo(animal);
                      return originInfo ? (
                        <Badge variant="outline" className={`text-xs border ${originInfo.className}`}>
                          <OriginBadgeIcon type={originInfo.iconType} />
                          {originInfo.label}
                        </Badge>
                      ) : null;
                    })()}
                    {displayLifeStage && (
                      <StageBadge 
                        stage={displayLifeStage}
                        definition={getLifeStageDefinition(displayLifeStage)}
                        colorClass={getLifeStageBadgeColor(displayLifeStage)}
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
                        Due: {formatDistanceToNow(new Date(expectedDeliveryDate), { addSuffix: true })}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{animal.breed} • Tag: {animal.ear_tag}</span>
                      {getCacheIcon()}
                    </div>
                    {animal.unique_code && (
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{animal.unique_code}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(animal.unique_code!);
                            toast({
                              title: "Copied!",
                              description: "Universal ID copied to clipboard",
                            });
                          }}
                          title="Copy Universal ID"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardDescription>
                </div>
              </div>
              {!readOnly && (
                <div className="flex flex-col gap-2 items-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditAnimalDialogOpen(true)}
                    disabled={!isOnline}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit All Details
                  </Button>
                  <RecordAnimalExitDialog 
                    animalId={animalId}
                    animalName={animal.name || animal.ear_tag || 'Animal'}
                    farmId={farmId}
                    livestockType={animal.livestock_type || undefined}
                    earTag={animal.ear_tag || undefined}
                    onExitRecorded={onBack}
                  />
                  <RecalculateSingleAnimalButton 
                    animalId={animalId} 
                    onSuccess={loadAnimal}
                  />
                </div>
              )}
            </div>
          )}
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
                {animal.birth_date_unknown 
                  ? <span className="text-muted-foreground italic">Unknown</span>
                  : animal.birth_date 
                    ? new Date(animal.birth_date).toLocaleDateString() 
                    : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Milking Start</p>
              <p className="font-medium">
                {animal.milking_start_date ? new Date(animal.milking_start_date).toLocaleDateString() : "Not yet"}
              </p>
            </div>
            {animal.farm_entry_date && (
              <div>
                <p className="text-muted-foreground">Farm Entry</p>
                <p className="font-medium">
                  {new Date(animal.farm_entry_date).toLocaleDateString()}
                </p>
              </div>
            )}
            {/* Entry Weight & Acquisition for new entrants */}
            {animal.farm_entry_date && (
              <>
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-muted-foreground">Entry Weight</p>
                    <EditAcquisitionWeightDialog
                      animalId={animalId}
                      isNewEntrant={true}
                      currentValues={{
                        entry_weight_kg: animal.entry_weight_kg,
                        entry_weight_unknown: animal.entry_weight_unknown,
                        birth_weight_kg: animal.birth_weight_kg,
                        acquisition_type: animal.acquisition_type,
                        purchase_price: animal.purchase_price,
                        grant_source: animal.grant_source,
                        grant_source_other: animal.grant_source_other,
                      }}
                      isOnline={isOnline}
                      onSaved={loadAnimal}
                      livestockType={animal.livestock_type || "cattle"}
                      gender={animal.gender}
                      open={editWeightDialogOpen}
                      onOpenChange={setEditWeightDialogOpen}
                    />
                  </div>
                  <p className="font-medium">
                    {animal.entry_weight_unknown 
                      ? <span className="text-muted-foreground italic">Unknown</span>
                      : animal.entry_weight_kg !== null
                        ? `${animal.entry_weight_kg} kg`
                        : <span className="text-muted-foreground italic">Not set</span>
                    }
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Acquisition</p>
                  <p className="font-medium">
                    {animal.acquisition_type === "purchased" && (
                      <>
                        Purchased
                        {animal.purchase_price && ` - ₱${animal.purchase_price.toLocaleString()}`}
                      </>
                    )}
                    {animal.acquisition_type === "grant" && (
                      <>
                        Grant from{" "}
                        {animal.grant_source === "national_dairy_authority" && "National Dairy Authority (NDA)"}
                        {animal.grant_source === "local_government_unit" && "Local Government Unit (LGU)"}
                        {animal.grant_source === "other" && (animal.grant_source_other || "Unknown")}
                      </>
                    )}
                    {!animal.acquisition_type && (
                      <span className="text-muted-foreground italic">Not set</span>
                    )}
                  </p>
                </div>
              </>
            )}
            {/* Birth Weight for offspring (no farm_entry_date) */}
            {!animal.farm_entry_date && (
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-muted-foreground">Birth Weight</p>
                  <EditAcquisitionWeightDialog
                    animalId={animalId}
                    isNewEntrant={false}
                    currentValues={{
                      entry_weight_kg: animal.entry_weight_kg,
                      entry_weight_unknown: animal.entry_weight_unknown,
                      birth_weight_kg: animal.birth_weight_kg,
                      acquisition_type: animal.acquisition_type,
                      purchase_price: animal.purchase_price,
                      grant_source: animal.grant_source,
                      grant_source_other: animal.grant_source_other,
                    }}
                    isOnline={isOnline}
                    onSaved={loadAnimal}
                    livestockType={animal.livestock_type || "cattle"}
                    gender={animal.gender}
                  />
                </div>
                <p className="font-medium">
                  {animal.birth_weight_kg !== null 
                    ? `${animal.birth_weight_kg} kg`
                    : <span className="text-muted-foreground italic">Not set</span>
                  }
                </p>
              </div>
            )}
          </div>

          {/* Parents Section */}
          {(mother || father || animal?.mother_unknown || animal?.father_unknown) && (
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
              <h3 className="text-sm font-semibold mb-2 sm:mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Parents
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {mother ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mother</p>
                    <Badge variant="secondary" className="text-sm">
                      {mother.name || mother.ear_tag || "Unknown"}
                    </Badge>
                  </div>
                ) : animal?.mother_unknown && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mother</p>
                    <Badge variant="outline" className="text-sm text-muted-foreground italic">
                      Unknown
                    </Badge>
                  </div>
                )}
                {father ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Father</p>
                    <Badge variant="secondary" className="text-sm">
                      {father.name || father.ear_tag || "Unknown"}
                    </Badge>
                  </div>
                ) : animal?.father_unknown && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Father</p>
                    <Badge variant="outline" className="text-sm text-muted-foreground italic">
                      Unknown
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

      {/* BioCard Summary - Collapsible Performance Overview */}
      {animal && !readOnly && (
        <BioCardSummary
          animal={{
            id: animal.id,
            name: animal.name,
            ear_tag: animal.ear_tag,
            gender: animal.gender,
            life_stage: displayLifeStage,
            milking_stage: computedMilkingStage,
            livestock_type: animal.livestock_type || 'cattle',
            birth_date: animal.birth_date,
            avatar_url: animal.avatar_url,
            current_weight_kg: null,
            farm_id: farmId,
            breed: animal.breed,
          }}
          farmId={farmId}
          isOnline={isOnline}
        />
      )}

      {/* Growth Benchmark Card */}
      <GrowthBenchmarkCard 
        animalId={animalId} 
        animalData={animal ? {
          birth_date: animal.birth_date,
          gender: animal.gender,
          life_stage: animal.life_stage,
          current_weight_kg: null,
          livestock_type: animal.livestock_type || 'cattle',
        } : null}
      />

      <Tabs defaultValue={isFemale ? 'milking' : 'weight'} className="space-y-4">
        {/* Mobile: Horizontal scrollable tabs with icons only */}
        {isMobile ? (
          <div className="relative">
            {/* Scroll indicator gradient */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide gap-1 p-1.5 flex-nowrap">
              {isFemale && (
                <TabsTrigger 
                  value="milking" 
                  className="flex items-center gap-1.5 min-w-fit px-3 py-2.5 text-xs shrink-0"
                >
                  <Milk className="h-4 w-4" />
                  <span>Milk</span>
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="weight" 
                className="flex items-center gap-1.5 min-w-fit px-3 py-2.5 text-xs shrink-0"
              >
                <Scale className="h-4 w-4" />
                <span>Weight</span>
              </TabsTrigger>
              <TabsTrigger 
                value="feeding" 
                className="flex items-center gap-1.5 min-w-fit px-3 py-2.5 text-xs shrink-0"
              >
                <Wheat className="h-4 w-4" />
                <span>Feed</span>
              </TabsTrigger>
              <TabsTrigger 
                value="health" 
                className="flex items-center gap-1.5 min-w-fit px-3 py-2.5 text-xs shrink-0"
              >
                <Stethoscope className="h-4 w-4" />
                <span>Health</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ai" 
                className="flex items-center gap-1.5 min-w-fit px-3 py-2.5 text-xs shrink-0"
              >
                <Calendar className="h-4 w-4" />
                <span>Breed</span>
              </TabsTrigger>
              <TabsTrigger 
                value="photos" 
                className="flex items-center gap-1.5 min-w-fit px-3 py-2.5 text-xs shrink-0"
              >
                <Image className="h-4 w-4" />
                <span>Photos</span>
              </TabsTrigger>
              <TabsTrigger 
                value="costs" 
                className="flex items-center gap-1.5 min-w-fit px-3 py-2.5 text-xs shrink-0"
              >
                <Wallet className="h-4 w-4" />
                <span>Costs</span>
              </TabsTrigger>
            </TabsList>
          </div>
        ) : (
          /* Desktop: Grid layout */
          <TabsList className={`w-full p-2 sm:p-1 gap-2 sm:gap-1 h-auto grid ${isFemale ? 'grid-cols-4 sm:grid-cols-7 grid-rows-2 sm:grid-rows-1' : 'grid-cols-3 sm:grid-cols-6 grid-rows-2 sm:grid-rows-1'}`}>
            {isFemale && (
              <TabsTrigger 
                value="milking" 
                className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[56px] sm:min-h-[48px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:border-primary data-[state=active]:border-2"
              >
                <Milk className="h-5 w-5 sm:h-4 sm:w-4" />
                <span className="text-center">Milking</span>
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="weight" 
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[56px] sm:min-h-[48px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:border-primary data-[state=active]:border-2"
            >
              <Scale className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="text-center">Weight</span>
            </TabsTrigger>
            <TabsTrigger 
              value="feeding" 
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[56px] sm:min-h-[48px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:border-primary data-[state=active]:border-2"
            >
              <Wheat className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="text-center">Feeding</span>
            </TabsTrigger>
            <TabsTrigger 
              value="health" 
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[56px] sm:min-h-[48px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:border-primary data-[state=active]:border-2"
            >
              <Stethoscope className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="text-center">Health</span>
            </TabsTrigger>
            <TabsTrigger 
              value="ai" 
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[56px] sm:min-h-[48px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:border-primary data-[state=active]:border-2"
            >
              <Calendar className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="text-center">AI/Breeding</span>
            </TabsTrigger>
            <TabsTrigger 
              value="photos" 
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[56px] sm:min-h-[48px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:border-primary data-[state=active]:border-2"
            >
              <Image className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="text-center">Photos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="costs" 
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[56px] sm:min-h-[48px] px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:border-primary data-[state=active]:border-2"
            >
              <Wallet className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="text-center">Costs</span>
            </TabsTrigger>
          </TabsList>
        )}

        {isFemale && (
          <TabsContent value="milking">
            <MilkingRecords animalId={animalId} readOnly={readOnly} />
          </TabsContent>
        )}

        <TabsContent value="weight">
          <WeightRecords animalId={animalId} animalName={animal?.name || animal?.ear_tag || 'Unknown'} animalBirthDate={animal?.birth_date || undefined} animalFarmEntryDate={animal?.farm_entry_date || undefined} livestockType={animal?.livestock_type || "cattle"} gender={animal?.gender} lifeStage={animal?.life_stage} farmId={farmId} readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="feeding">
          <FeedingRecords 
            animalId={animalId} 
            animalName={animal?.name || animal?.ear_tag || 'Unknown'}
            farmId={farmId}
            animalFarmEntryDate={animal?.farm_entry_date}
            readOnly={readOnly} 
          />
        </TabsContent>

        <TabsContent value="health">
          <HealthRecords 
            animalId={animalId} 
            animalName={animal?.name || undefined}
            earTag={animal?.ear_tag}
            farmId={farmId}
            livestockType={animal?.livestock_type || 'cattle'}
            animalFarmEntryDate={animal?.farm_entry_date}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="ai">
          <AIRecords 
            animalId={animalId} 
            farmId={farmId}
            animalName={animal?.name || animal?.ear_tag || undefined}
            gender={animal?.gender || undefined}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="photos">
          <PhotoTimelineTab 
            animalId={animalId} 
            animalName={animal?.name || animal?.ear_tag || undefined}
          />
        </TabsContent>

        <TabsContent value="costs">
          <AnimalExpenseTab
            animalId={animalId}
            farmId={farmId}
            animalName={animal?.name || animal?.ear_tag || undefined}
            purchasePrice={animal?.purchase_price || null}
            grantSource={animal?.grant_source === 'other' ? animal?.grant_source_other : animal?.grant_source}
            acquisitionType={animal?.acquisition_type || null}
            isOnline={isOnline}
            readOnly={readOnly}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Animal Dialog */}
      {animal && (
        <EditAnimalDialog
          animalId={animalId}
          animal={{
            id: animal.id,
            name: animal.name,
            ear_tag: animal.ear_tag,
            gender: animal.gender,
            breed: animal.breed,
            livestock_type: animal.livestock_type || 'cattle',
            birth_date: animal.birth_date,
            birth_date_unknown: animal.birth_date_unknown,
            farm_entry_date: animal.farm_entry_date,
            milking_start_date: animal.milking_start_date,
            mother_id: animal.mother_id,
            mother_unknown: animal.mother_unknown,
            father_id: animal.father_id,
            father_unknown: animal.father_unknown,
            entry_weight_kg: animal.entry_weight_kg,
            entry_weight_unknown: animal.entry_weight_unknown,
            birth_weight_kg: animal.birth_weight_kg,
            current_weight_kg: animal.current_weight_kg,
            acquisition_type: animal.acquisition_type,
            purchase_price: animal.purchase_price,
            grant_source: animal.grant_source,
            grant_source_other: animal.grant_source_other,
            is_currently_lactating: animal.is_currently_lactating,
            estimated_days_in_milk: animal.estimated_days_in_milk,
          }}
          farmId={farmId}
          open={editAnimalDialogOpen}
          onOpenChange={setEditAnimalDialogOpen}
          onSaved={loadAnimal}
        />
      )}
    </div>
  );
};

export default AnimalDetails;
