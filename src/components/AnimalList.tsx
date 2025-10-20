import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Search, Filter, ChevronDown, ChevronUp, Scale, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StageBadge } from "@/components/ui/stage-badge";
import { Badge } from "@/components/ui/badge";
import AnimalForm from "./AnimalForm";
import AnimalDetails from "./AnimalDetails";
import { calculateLifeStage, calculateMilkingStage, getLifeStageBadgeColor, getMilkingStageBadgeColor } from "@/lib/animalStages";
import { getCachedAnimals, updateAnimalCache, updateRecordsCache, getCachedRecords } from "@/lib/dataCache";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

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
  gender: string | null;
  milking_start_date: string | null;
  current_weight_kg: number | null;
  lifeStage?: string | null;
  milkingStage?: string | null;
}

interface AnimalListProps {
  farmId: string;
  initialSelectedAnimalId?: string | null;
  readOnly?: boolean;
  onAnimalSelect?: (animalId: string | null) => void;
}

const AnimalList = ({ farmId, initialSelectedAnimalId, readOnly = false, onAnimalSelect }: AnimalListProps) => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(initialSelectedAnimalId || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [breedFilter, setBreedFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [lifeStageFilter, setLifeStageFilter] = useState<string>("all");
  const [milkingStageFilter, setMilkingStageFilter] = useState<string>("all");
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [cachedAnimalIds, setCachedAnimalIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (initialSelectedAnimalId) {
      setSelectedAnimalId(initialSelectedAnimalId);
    }
  }, [initialSelectedAnimalId]);

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
        
        // Check which animals have cached records
        const cached = new Set<string>();
        for (const animal of cachedData.data) {
          const records = await getCachedRecords(animal.id);
          if (records) {
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
        
        // Update cached IDs
        const cached = new Set<string>();
        for (const animal of freshData) {
          const records = await getCachedRecords(animal.id);
          if (records) {
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
    return <AnimalDetails animalId={selectedAnimalId} onBack={() => {
      setSelectedAnimalId(null);
      onAnimalSelect?.(null);
    }} />;
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
  const uniqueBreeds = Array.from(new Set(animals.map(a => a.breed).filter(Boolean)));
  const uniqueLifeStages = Array.from(new Set(animals.map(a => a.lifeStage).filter(Boolean)));
  const uniqueMilkingStages = Array.from(new Set(animals.map(a => a.milkingStage).filter(Boolean)));

  // Apply filters
  const filteredAnimals = animals.filter(animal => {
    const matchesSearch = searchQuery === "" || 
      animal.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      animal.ear_tag?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBreed = breedFilter === "all" || animal.breed === breedFilter;
    const matchesGender = genderFilter === "all" || animal.gender?.toLowerCase() === genderFilter.toLowerCase();
    const matchesLifeStage = lifeStageFilter === "all" || animal.lifeStage === lifeStageFilter;
    const matchesMilkingStage = milkingStageFilter === "all" || animal.milkingStage === milkingStageFilter;

    return matchesSearch && matchesBreed && matchesGender && matchesLifeStage && matchesMilkingStage;
  });

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Button onClick={() => setShowForm(true)} className="w-full min-h-[56px] text-base">
          <Plus className="h-5 w-5 mr-2" />
          Add New Animal
        </Button>
      )}

      {/* Filters */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
        >
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setFiltersExpanded(!filtersExpanded);
              }}
            >
              {filtersExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        {filtersExpanded && (
          <CardContent className="space-y-4 animate-accordion-down">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ear tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select value={breedFilter} onValueChange={setBreedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Breed" />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="all">All Breeds</SelectItem>
                  {uniqueBreeds.map(breed => (
                    <SelectItem key={breed} value={breed!}>{breed}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>

              <Select value={lifeStageFilter} onValueChange={setLifeStageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Life Stage" />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="all">All Life Stages</SelectItem>
                  {uniqueLifeStages.map(stage => (
                    <SelectItem key={stage} value={stage!}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={milkingStageFilter} onValueChange={setMilkingStageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Milking Stage" />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="all">All Milking Stages</SelectItem>
                  {uniqueMilkingStages.map(stage => (
                    <SelectItem key={stage} value={stage!}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              Showing {filteredAnimals.length} of {animals.length} animals
            </p>
          </CardContent>
        )}
      </Card>

      {filteredAnimals.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {animals.length === 0 ? "No animals yet. Add your first animal to start tracking!" : "No animals match your filters."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAnimals.map((animal) => (
            <Card
              key={animal.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedAnimalId(animal.id);
                onAnimalSelect?.(animal.id);
                
                // Pre-cache this animal's records in background
                if (isOnline) {
                  updateRecordsCache(animal.id).catch(err => 
                    console.error('Error pre-caching records:', err)
                  );
                }
              }}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{animal.name || "Unnamed"}</CardTitle>
                    <CardDescription>
                      {animal.breed || "Unknown breed"} • Tag: {animal.ear_tag || "N/A"}
                    </CardDescription>
                  </div>
                  {cachedAnimalIds.has(animal.id) && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      <Database className="h-3 w-3 mr-1" />
                      Cached
                    </Badge>
                  )}
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
                        stage={animal.lifeStage}
                        definition={getLifeStageDefinition(animal.lifeStage)}
                        colorClass={getLifeStageBadgeColor(animal.lifeStage)}
                      />
                    )}
                    {animal.milkingStage && (
                      <StageBadge 
                        stage={animal.milkingStage}
                        definition={getMilkingStageDefinition(animal.milkingStage)}
                        colorClass={getMilkingStageBadgeColor(animal.milkingStage)}
                      />
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