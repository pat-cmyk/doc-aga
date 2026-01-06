import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Search, Filter, Scale, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StageBadge } from "@/components/ui/stage-badge";
import { Badge } from "@/components/ui/badge";
import AnimalForm from "./AnimalForm";
import AnimalDetails from "./AnimalDetails";
import { AnimalCard } from "./animal-list/AnimalCard";
import { calculateLifeStage, calculateMilkingStage, getLifeStageBadgeColor, getMilkingStageBadgeColor, displayStageForSpecies } from "@/lib/animalStages";
import { getCachedAnimals, updateAnimalCache, updateRecordsCache, getCachedRecords, getCachedAnimalDetails } from "@/lib/dataCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { hapticNotification } from "@/lib/haptics";
import { useIsMobile } from "@/hooks/use-mobile";

// Helper function to get stage definitions
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

interface Animal {
  id: string;
  livestock_type: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  birth_date: string | null;
  gender: string | null;
  milking_start_date: string | null;
  current_weight_kg: number | null;
  avatar_url?: string | null;
  lifeStage?: string | null;
  milkingStage?: string | null;
  entry_weight_kg?: number | null;
  entry_weight_unknown?: boolean | null;
}

interface AnimalListProps {
  farmId: string;
  initialSelectedAnimalId?: string | null;
  readOnly?: boolean;
  onAnimalSelect?: (animalId: string | null) => void;
  weightFilter?: 'missing' | undefined;
  /** If true, open the edit weight dialog when animal details opens */
  editWeightOnOpen?: boolean;
  /** Callback to clear the editWeight flag after it's consumed */
  onEditWeightConsumed?: () => void;
}

const AnimalList = ({ farmId, initialSelectedAnimalId, readOnly = false, onAnimalSelect, weightFilter, editWeightOnOpen, onEditWeightConsumed }: AnimalListProps) => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(initialSelectedAnimalId || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [livestockTypeFilter, setLivestockTypeFilter] = useState<string>("all"); // NEW
  const [breedFilter, setBreedFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [lifeStageFilter, setLifeStageFilter] = useState<string>("all");
  const [milkingStageFilter, setMilkingStageFilter] = useState<string>("all");
  const [weightDataFilter, setWeightDataFilter] = useState<string>(weightFilter === 'missing' ? 'missing' : 'all');
  const [cachedAnimalIds, setCachedAnimalIds] = useState<Set<string>>(new Set());
  const [downloadingAnimalIds, setDownloadingAnimalIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const isMobile = useIsMobile();

  // Helper to create notification in database
  const createCacheNotification = async (
    title: string,
    body: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'system' as const,
          title,
          body,
          read: false
        });
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  };

  // Handle swipe-to-cache action
  const handleCacheAnimal = async (animalId: string) => {
    if (cachedAnimalIds.has(animalId)) {
      // Silent - user can see the cached indicator on card
      return;
    }

    if (!isOnline) {
      toast({ 
        title: "Offline", 
        description: "Connect to internet to cache animal data",
        variant: "destructive"
      });
      return;
    }

    setDownloadingAnimalIds(prev => new Set(prev).add(animalId));

    try {
      await updateRecordsCache(animalId);
      
      const [details, records] = await Promise.all([
        getCachedAnimalDetails(animalId, farmId),
        getCachedRecords(animalId)
      ]);

      if (details && records) {
        setCachedAnimalIds(prev => new Set(prev).add(animalId));
        hapticNotification('success');
        await createCacheNotification('Cached!', 'Animal available offline');
      }
    } catch (error) {
      hapticNotification('error');
      await createCacheNotification('Cache Failed', 'Could not save for offline use');
    } finally {
      setDownloadingAnimalIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(animalId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    if (initialSelectedAnimalId) {
      setSelectedAnimalId(initialSelectedAnimalId);
    }
  }, [initialSelectedAnimalId]);

  // Sync weightDataFilter when weightFilter prop changes
  useEffect(() => {
    if (weightFilter === 'missing') {
      setWeightDataFilter('missing');
    }
  }, [weightFilter]);

  useEffect(() => {
    loadAnimals();
  }, [farmId]);

  const loadAnimals = async () => {
    try {
      // 1. Try to load from cache first
      const cachedData = await getCachedAnimals(farmId);
      if (cachedData) {
        console.log('[AnimalList] Using cached data');
        setAnimals(cachedData.data);
        setLoading(false);
        
        // Check which animals have COMPLETE cached data (both details and records)
        const cached = new Set<string>();
        for (const animal of cachedData.data) {
          const animalDetails = await getCachedAnimalDetails(animal.id, farmId);
          const records = await getCachedRecords(animal.id);
          // Only mark as cached if BOTH animal data and records exist
          if (animalDetails && records) {
            cached.add(animal.id);
          }
        }
        setCachedAnimalIds(cached);
      }

      // 2. Fetch fresh data in background (if online)
      if (isOnline) {
        console.log('[AnimalList] Fetching fresh data...');
        const freshData = await updateAnimalCache(farmId);
        
        // 3. Update UI with fresh data
        setAnimals(freshData);
        setLoading(false);
        
        // Update cached IDs - check for COMPLETE cached data
        const cached = new Set<string>();
        for (const animal of freshData) {
          const animalDetails = await getCachedAnimalDetails(animal.id, farmId);
          const records = await getCachedRecords(animal.id);
          // Only mark as cached if BOTH animal data and records exist
          if (animalDetails && records) {
            cached.add(animal.id);
          }
        }
        setCachedAnimalIds(cached);
      } else if (!cachedData) {
        // Offline and no cache available
        toast({
          title: "Offline",
          description: "No cached data available. Connect to load animals.",
          variant: "destructive"
        });
        setLoading(false);
      }
    } catch (error: any) {
      console.error('[AnimalList] Error loading animals:', error);
      toast({
        title: "Error loading animals",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  if (selectedAnimalId) {
    return <AnimalDetails 
      animalId={selectedAnimalId} 
      farmId={farmId} 
      onBack={() => {
        setSelectedAnimalId(null);
        onAnimalSelect?.(null);
      }}
      editWeightOnOpen={editWeightOnOpen}
      onEditWeightConsumed={onEditWeightConsumed}
      readOnly={readOnly}
    />;
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

  // Get unique values for filters
  const uniqueLivestockTypes = Array.from(new Set(animals.map(a => a.livestock_type).filter(Boolean))); // NEW
  const uniqueBreeds = Array.from(new Set(animals.map(a => a.breed).filter(Boolean)));
  const uniqueLifeStages = Array.from(new Set(animals.map(a => a.lifeStage).filter(Boolean)));
  const uniqueMilkingStages = Array.from(new Set(animals.map(a => a.milkingStage).filter(Boolean)));
  
  // Helper to get livestock icon
  const getLivestockIcon = (type: string) => {
    switch (type) {
      case 'cattle': return '🐄';
      case 'goat': return '🐐';
      case 'sheep': return '🐑';
      case 'carabao': return '🐃';
      default: return '🐄';
    }
  };

  // Helper function to get cache status icon
  const getCacheIcon = (animalId: string) => {
    const isCached = cachedAnimalIds.has(animalId);
    const isDownloading = downloadingAnimalIds.has(animalId);
    
    if (isDownloading) {
      return (
        <span title="Downloading for offline use...">
          <Database className="h-3.5 w-3.5 text-yellow-500 animate-pulse inline-block ml-1" />
        </span>
      );
    }
    
    if (isCached) {
      return (
        <span title="Available offline">
          <Database className="h-3.5 w-3.5 text-green-500 inline-block ml-1" />
        </span>
      );
    }
    
    return (
      <span title="Not cached offline">
        <Database className="h-3.5 w-3.5 text-gray-400 inline-block ml-1" />
      </span>
    );
  };

  // Check if filters are active
  const hasActiveFilters = 
    searchQuery !== "" || 
    livestockTypeFilter !== "all" ||
    breedFilter !== "all" || 
    genderFilter !== "all" || 
    lifeStageFilter !== "all" || 
    milkingStageFilter !== "all" ||
    weightDataFilter !== "all";

  // Reset all filters
  const resetAllFilters = () => {
    setSearchQuery("");
    setLivestockTypeFilter("all");
    setBreedFilter("all");
    setGenderFilter("all");
    setLifeStageFilter("all");
    setMilkingStageFilter("all");
    setWeightDataFilter("all");
  };

  // Apply filters
  const filteredAnimals = animals.filter(animal => {
    const matchesSearch = searchQuery === "" || 
      animal.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      animal.ear_tag?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLivestockType = livestockTypeFilter === "all" || animal.livestock_type === livestockTypeFilter;
    const matchesBreed = breedFilter === "all" || animal.breed === breedFilter;
    const matchesGender = genderFilter === "all" || animal.gender?.toLowerCase() === genderFilter.toLowerCase();
    const matchesLifeStage = lifeStageFilter === "all" || animal.lifeStage === lifeStageFilter;
    const matchesMilkingStage = milkingStageFilter === "all" || animal.milkingStage === milkingStageFilter;
    
    // Weight data filter
    const matchesWeightData = weightDataFilter === "all" ||
      (weightDataFilter === "missing" && animal.entry_weight_kg === null && !animal.entry_weight_unknown) ||
      (weightDataFilter === "complete" && (animal.entry_weight_kg !== null || animal.entry_weight_unknown === true));

    return matchesSearch && matchesLivestockType && matchesBreed && matchesGender && matchesLifeStage && matchesMilkingStage && matchesWeightData;
  });

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Button onClick={() => setShowForm(true)} className="w-full min-h-[56px] text-base">
          <Plus className="h-5 w-5 mr-2" />
          Add New Animal
        </Button>
      )}

      {/* Search Bar - Always Visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or ear tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Button and Results Count */}
      <div className="flex items-center justify-between gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 h-2 w-2 bg-primary rounded-full" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] overflow-y-auto rounded-t-2xl">
            {/* Drag handle indicator */}
            <div className="flex justify-center pt-2 pb-4">
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
            <SheetHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter Animals
                </SheetTitle>
                {hasActiveFilters && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={resetAllFilters}
                    className="text-sm font-medium min-h-[40px] px-4"
                  >
                    Reset All
                  </Button>
                )}
              </div>
            </SheetHeader>
            
            <div className="space-y-4 mt-6">
              {/* Filter dropdowns with labels */}
              <div className="space-y-3">
                {/* NEW: Livestock Type Filter */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Livestock Type</label>
                  <Select value={livestockTypeFilter} onValueChange={setLivestockTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="cattle">🐄 Cattle</SelectItem>
                      <SelectItem value="goat">🐐 Goat</SelectItem>
                      <SelectItem value="sheep">🐑 Sheep</SelectItem>
                      <SelectItem value="carabao">🐃 Carabao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Breed</label>
                  <Select value={breedFilter} onValueChange={setBreedFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Breeds" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      <SelectItem value="all">All Breeds</SelectItem>
                      {uniqueBreeds.map(breed => (
                        <SelectItem key={breed} value={breed!}>{breed}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Gender</label>
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Genders" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      <SelectItem value="all">All Genders</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Life Stage</label>
                  <Select value={lifeStageFilter} onValueChange={setLifeStageFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Life Stages" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      <SelectItem value="all">All Life Stages</SelectItem>
                      {uniqueLifeStages.map(stage => (
                        <SelectItem key={stage} value={stage!}>{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Milking Stage</label>
                  <Select value={milkingStageFilter} onValueChange={setMilkingStageFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Milking Stages" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      <SelectItem value="all">All Milking Stages</SelectItem>
                      {uniqueMilkingStages.map(stage => (
                        <SelectItem key={stage} value={stage!}>{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-1">
                    <Scale className="h-4 w-4" />
                    Weight Data
                  </label>
                  <Select value={weightDataFilter} onValueChange={setWeightDataFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Weight Data" />
                    </SelectTrigger>
                    <SelectContent className="bg-card z-50">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="missing">Missing Entry Weight</SelectItem>
                      <SelectItem value="complete">Weight Recorded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Results count */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground text-center">
                  Showing <span className="font-semibold text-foreground">{filteredAnimals.length}</span> of <span className="font-semibold text-foreground">{animals.length}</span> animals
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Results count shown inline on larger screens */}
        <p className="text-sm text-muted-foreground hidden sm:block">
          {filteredAnimals.length} of {animals.length} animals
        </p>
      </div>

      {filteredAnimals.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {animals.length === 0 ? "No animals yet. Add your first animal to start tracking!" : "No animals match your filters."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAnimals.map((animal) => {
            const displayedLifeStage = displayStageForSpecies(animal.lifeStage || null, animal.livestock_type);
            const lifeStageDefinition = getLifeStageDefinition(displayedLifeStage);
            const lifeStageBadgeColor = getLifeStageBadgeColor(displayedLifeStage);
            const milkingStageDefinition = getMilkingStageDefinition(animal.milkingStage || null);
            const milkingStageBadgeColor = getMilkingStageBadgeColor(animal.milkingStage || null);
            const livestockIcon = getLivestockIcon(animal.livestock_type);

            const handleViewAnimal = () => {
              setSelectedAnimalId(animal.id);
              onAnimalSelect?.(animal.id);
              
              // Pre-cache this animal's records in background
              if (isOnline && !cachedAnimalIds.has(animal.id)) {
                setDownloadingAnimalIds(prev => new Set(prev).add(animal.id));
                
                updateRecordsCache(animal.id)
                  .then(() => {
                    Promise.all([
                      getCachedAnimalDetails(animal.id, farmId),
                      getCachedRecords(animal.id)
                    ]).then(([details, records]) => {
                      if (details && records) {
                        setCachedAnimalIds(prev => new Set(prev).add(animal.id));
                      }
                      setDownloadingAnimalIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(animal.id);
                        return newSet;
                      });
                    });
                  })
                  .catch(err => {
                    console.error('Error pre-caching records:', err);
                    setDownloadingAnimalIds(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(animal.id);
                      return newSet;
                    });
                  });
              }
            };

            // Use AnimalCard component on mobile for swipe gestures
            if (isMobile) {
              return (
                <AnimalCard
                  key={animal.id}
                  animal={{
                    ...animal,
                    lifeStage: displayedLifeStage,
                  }}
                  isCached={cachedAnimalIds.has(animal.id)}
                  isDownloading={downloadingAnimalIds.has(animal.id)}
                  lifeStageDefinition={lifeStageDefinition}
                  milkingStageDefinition={milkingStageDefinition}
                  lifeStageBadgeColor={lifeStageBadgeColor}
                  milkingStageBadgeColor={milkingStageBadgeColor}
                  livestockIcon={livestockIcon}
                  onClick={handleViewAnimal}
                  onCacheOffline={() => handleCacheAnimal(animal.id)}
                  onViewDetails={handleViewAnimal}
                />
              );
            }

            // Desktop card (unchanged)
            return (
              <Card
                key={animal.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                style={{ contentVisibility: 'auto' }}
                onClick={handleViewAnimal}
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage 
                        src={animal.avatar_url ? `${animal.avatar_url}?t=${Date.now()}` : undefined}
                        alt={animal.name || animal.ear_tag || "Animal"}
                        loading="lazy"
                      />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {(animal.name || animal.ear_tag || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{animal.name || "Unnamed"}</CardTitle>
                      <CardDescription className="flex items-center">
                        <span>
                          {livestockIcon} {animal.breed || "Unknown breed"} • Tag: {animal.ear_tag || "N/A"}
                        </span>
                        {getCacheIcon(animal.id)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Born: {animal.birth_date ? new Date(animal.birth_date).toLocaleDateString() : "Unknown"}</span>
                    {animal.current_weight_kg && (
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Scale className="h-3 w-3" />
                        {animal.current_weight_kg} kg
                      </span>
                    )}
                  </div>
                  {(animal.lifeStage || animal.milkingStage) && (
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {animal.lifeStage && (
                        <StageBadge 
                          stage={displayedLifeStage}
                          definition={lifeStageDefinition}
                          colorClass={lifeStageBadgeColor}
                        />
                      )}
                      {animal.milkingStage && (
                        <StageBadge 
                          stage={animal.milkingStage}
                          definition={milkingStageDefinition}
                          colorClass={milkingStageBadgeColor}
                        />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AnimalList;