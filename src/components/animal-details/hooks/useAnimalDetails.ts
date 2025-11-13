import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getCachedAnimalDetails } from "@/lib/dataCache";
import { differenceInDays } from "date-fns";

export interface Animal {
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
}

export interface ParentAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
}

export interface OffspringAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  birth_date: string | null;
}

export interface AnimalStageData {
  birthDate: Date | null;
  gender: string | null;
  milkingStartDate: Date | null;
  offspringCount: number;
  lastCalvingDate: Date | null;
  hasRecentMilking: boolean;
  hasActiveAI: boolean;
  livestockType: string | null;
}

export const useAnimalDetails = (animalId: string, farmId: string) => {
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [mother, setMother] = useState<ParentAnimal | null>(null);
  const [father, setFather] = useState<ParentAnimal | null>(null);
  const [offspring, setOffspring] = useState<OffspringAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageData, setStageData] = useState<AnimalStageData | null>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string | null>(null);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadAnimal();
  }, [animalId]);

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
        setLoading(false);
      }

      // If offline and we have cached data, stop here
      if (!isOnline) {
        setLoading(false);
        if (!cached) {
          setAnimal(null);
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

      // Fetch additional data for stage calculation
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
        
        if (aiRecords && aiRecords.length > 0 && aiRecords[0].pregnancy_confirmed && aiRecords[0].expected_delivery_date) {
          setExpectedDeliveryDate(aiRecords[0].expected_delivery_date);
        } else {
          setExpectedDeliveryDate(null);
        }
        
        // Get recent milking records
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

  return {
    animal,
    mother,
    father,
    offspring,
    loading,
    stageData,
    expectedDeliveryDate,
    reload: loadAnimal
  };
};
