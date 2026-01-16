import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedAnimals, updateAnimalCache, getCachedAnimalDetails, getCachedRecords } from "@/lib/dataCache";

export interface Animal {
  id: string;
  livestock_type: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  birth_date: string | null;
  gender: string | null;
  milking_start_date: string | null;
  current_weight_kg: number | null;
  entry_weight_kg?: number | null;
  entry_weight_unknown?: boolean | null;
  birth_weight_kg?: number | null;
  avatar_url?: string | null;
  lifeStage?: string | null;
  milkingStage?: string | null;
}

export const useAnimalList = (farmId: string) => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [cachedAnimalIds, setCachedAnimalIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadAnimals();
  }, [farmId]);

  const loadAnimals = async () => {
    try {
      // Try cache first
      const cachedData = await getCachedAnimals(farmId);
      if (cachedData) {
        console.log('[AnimalList] Using cached data');
        setAnimals(cachedData.data);
        setLoading(false);
        
        // Check which animals have complete cached data
        const cached = new Set<string>();
        for (const animal of cachedData.data) {
          const animalDetails = await getCachedAnimalDetails(animal.id, farmId);
          const records = await getCachedRecords(animal.id);
          if (animalDetails && records) {
            cached.add(animal.id);
          }
        }
        setCachedAnimalIds(cached);
      }

      // Fetch fresh data if online
      if (isOnline) {
        console.log('[AnimalList] Fetching fresh data...');
        const freshData = await updateAnimalCache(farmId);
        
        setAnimals(freshData);
        setLoading(false);
        
        // Update cached IDs
        const cached = new Set<string>();
        for (const animal of freshData) {
          const animalDetails = await getCachedAnimalDetails(animal.id, farmId);
          const records = await getCachedRecords(animal.id);
          if (animalDetails && records) {
            cached.add(animal.id);
          }
        }
        setCachedAnimalIds(cached);
      } else if (!cachedData) {
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

  return {
    animals,
    loading,
    cachedAnimalIds,
    reload: loadAnimals
  };
};
