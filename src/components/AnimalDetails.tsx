import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimalAvatar } from "@/components/ui/animal-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Loader2, Milk, Stethoscope, Calendar, Users, Baby, Scale, Wheat, WifiOff, Download, CheckCircle, Database, Globe, Copy, Image, Wallet, Pencil, Home, ShoppingCart, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { showErrorToastLegacy } from "@/lib/errorHandling";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addDays, differenceInDays, formatDistanceToNow } from "date-fns";
import { GESTATION_DAYS } from "@/types/fertility";
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
import { ExportAnimalProfileButton } from "./animal-details/ExportAnimalProfileButton";
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
      className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
    };
  }
  
  // Acquired animal
  if (animal.acquisition_type === "grant") {
    return {
      label: "Grant",
      iconType: 'gift',
      className: "bg-purple-500/15 text-purple-700 border-purple-500/30"
    };
  }
  
  // Default to purchased for acquired animals
  return {
    label: "Purchased",
    iconType: 'cart',
    className: "bg-blue-500/15 text-blue-700 border-blue-500/30"
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
  source_farm: string | null;
  is_currently_lactating: boolean | null;
  estimated_days_in_milk: number | null;
  fertility_status: string | null;
  last_ai_date: string | null;
  last_calving_date: string | null;
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

  // Persistent active tab: hash (#milking) takes precedence, then localStorage,
  // then a gender-appropriate default. Synced back to both on change so farmers
  // return to the same tab next time they open this animal.
  const TAB_STORAGE_KEY = `animal-profile-tab-${animalId}`;
  const VALID_TABS = ['milking', 'weight', 'feeding', 'health', 'ai', 'photos', 'costs'] as const;
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'weight';
    const hash = window.location.hash.replace('#', '');
    if ((VALID_TABS as readonly string[]).includes(hash)) return hash;
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    if (stored && (VALID_TABS as readonly string[]).includes(stored)) return stored;
    return 'weight';
  });
  // Once the animal loads, upgrade the default to the gender-appropriate tab
  // (milking for females) — only when the user hasn't already picked a tab
  // via hash or localStorage.
  useEffect(() => {
    if (!animal) return;
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '');
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    if (hash || stored) return;
    const female = animal.gender?.toLowerCase() === 'female';
    if (female && activeTab !== 'milking') setActiveTab('milking');
  }, [animal, activeTab, TAB_STORAGE_KEY]);

  const handleTabChange = (next: string) => {
    setActiveTab(next);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, next);
      if (typeof window !== 'undefined') {
        // Replace, don't push, so back button still leaves the profile cleanly.
        const url = new URL(window.location.href);
        url.hash = next;
        window.history.replaceState(null, '', url.toString());
      }
    } catch {
      // localStorage can throw in private mode — fall through silently.
    }
  };
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

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
        
        // Derive hasActiveAI from fertility_status (SSOT from DB trigger)
        const hasActiveAI = ['bred_waiting', 'suspected_pregnant', 'confirmed_pregnant'].includes(data.fertility_status || '');

        // Compute expected delivery date for pregnant animals (same block as stageData)
        if (hasActiveAI) {
          // Try animal.last_ai_date first, then fall back to ai_records query
          const aiDate = data.last_ai_date;
          if (aiDate) {
            const gestationDays = GESTATION_DAYS[data.livestock_type || 'cattle'] || 283;
            setExpectedDeliveryDate(addDays(new Date(aiDate), gestationDays).toISOString().split('T')[0]);
          } else {
            // last_ai_date not set — query ai_records directly
            const { data: aiRecord } = await supabase
              .from('ai_records')
              .select('performed_date, scheduled_date, expected_delivery_date')
              .eq('animal_id', animalId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (aiRecord?.expected_delivery_date) {
              setExpectedDeliveryDate(aiRecord.expected_delivery_date);
            } else {
              const fallbackDate = aiRecord?.performed_date || aiRecord?.scheduled_date;
              if (fallbackDate) {
                const gestationDays = GESTATION_DAYS[data.livestock_type || 'cattle'] || 283;
                setExpectedDeliveryDate(addDays(new Date(fallbackDate), gestationDays).toISOString().split('T')[0]);
              } else {
                setExpectedDeliveryDate(null);
              }
            }
          }
        } else {
          setExpectedDeliveryDate(null);
        }

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
      showErrorToastLegacy(toast, error, "loading animal");
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
      const filePath = `${farmId}/avatars/${fileName}`;

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
          {/* One responsive header (UX redesign Phase 3): identity row on top,
              actions as a horizontal wrap bar below — the animal's name never
              gets pushed below the fold by a vertical button stack. */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back" className="min-h-[44px] min-w-[44px]">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="relative shrink-0">
                <AnimalAvatar
                  avatarUrl={animal.avatar_url}
                  animalName={animal.name}
                  earTag={animal.ear_tag}
                  livestockType={animal.livestock_type}
                  size="lg"
                />
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
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CardTitle className="text-lg sm:text-2xl">{animal.name}</CardTitle>
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
                  {expectedDeliveryDate && (() => {
                    const daysUntilDue = differenceInDays(new Date(expectedDeliveryDate), new Date());
                    const badgeColor = daysUntilDue <= 14
                      ? 'bg-red-500 hover:bg-red-600'
                      : daysUntilDue <= 30
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-green-500 hover:bg-green-600';
                    return (
                      <Badge className={`${badgeColor} text-xs`}>
                        <Baby className="h-3 w-3 mr-1" />
                        Due: {formatDistanceToNow(new Date(expectedDeliveryDate), { addSuffix: true })}
                      </Badge>
                    );
                  })()}
                </div>
                <CardDescription className="space-y-1 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{animal.breed} • Tag: {animal.ear_tag}</span>
                    {getCacheIcon()}
                  </div>
                  {animal.unique_code && (
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3 flex-shrink-0" />
                      <code className="text-[10px] sm:text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{animal.unique_code}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-11 w-11 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(animal.unique_code!);
                          toast({
                            title: "Copied!",
                            description: "Universal ID copied to clipboard",
                          });
                        }}
                        title="Copy Universal ID"
                        aria-label="Copy Universal ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardDescription>
              </div>
            </div>

            {/* Horizontal action bar (replaces the old vertical 5-button stack) */}
            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditAnimalDialogOpen(true)}
                  disabled={!isOnline}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit All Details
                </Button>
                <ExportAnimalProfileButton
                  animalId={animalId}
                  farmId={farmId}
                />
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
                        source_farm: animal.source_farm,
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
                {/* Source Farm */}
                <div>
                  <p className="text-muted-foreground">Source Farm</p>
                  <p className="font-medium">
                    {animal.source_farm
                      ? animal.source_farm
                      : <span className="text-muted-foreground italic">No data available</span>
                    }
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
                      source_farm: animal.source_farm,
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
            fertility_status: animal.fertility_status ?? null,
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

      {/* NOTE: AnimalQuickActionsStrip intentionally NOT mounted here.
          The same strip already lives in BioCardSheet (the drawer that
          opens when a farmer taps an animal card), which is the primary
          entry point for quick recording. Repeating it here is redundant
          since each tab already has its own "+ Add record" button. */}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        {/* One wrapping tab strip (UX redesign Phase 3): every tab visible on
            every viewport — no horizontally scrolled tabs hidden off-screen. */}
        <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1 p-1.5">
          {([
            ...(isFemale ? [{ value: "milking", icon: Milk, label: "Milk" }] : []),
            { value: "weight", icon: Scale, label: "Weight" },
            { value: "feeding", icon: Wheat, label: "Feed" },
            { value: "health", icon: Stethoscope, label: "Health" },
            { value: "ai", icon: Calendar, label: "Breeding" },
            { value: "photos", icon: Image, label: "Photos" },
            { value: "costs", icon: Wallet, label: "Costs" },
          ] as const).map(({ value, icon: TabIcon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-1.5 min-h-[44px] px-3 text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              <TabIcon className="h-4 w-4" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

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
            livestockType={animal?.livestock_type || undefined}
            animalBreed={animal?.breed || undefined}
            readOnly={readOnly}
            birthDate={animal?.birth_date}
            lifeStage={animal?.life_stage}
            fertilityStatus={animal?.fertility_status}
            isCurrentlyLactating={animal?.is_currently_lactating}
            offspringCount={offspring.length}
          />
        </TabsContent>

        <TabsContent value="photos">
          <PhotoTimelineTab
            animalId={animalId}
            animalName={animal?.name || animal?.ear_tag || undefined}
            farmId={farmId}
            readOnly={readOnly}
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
