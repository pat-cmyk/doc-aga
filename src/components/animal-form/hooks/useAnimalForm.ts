import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { getOfflineMessage, translateError } from "@/lib/errorMessages";

export interface AnimalFormData {
  animal_type: string;
  livestock_type: string;
  name: string;
  ear_tag: string;
  breed: string;
  breed1: string;
  breed2: string;
  gender: string;
  birth_date: string;
  mother_id: string;
  father_id: string;
  is_father_ai: boolean;
  ai_bull_brand: string;
  ai_bull_reference: string;
  ai_bull_breed: string;
  // New fields for new entrants
  farm_entry_date: string;
  birth_date_unknown: boolean;
  mother_unknown: boolean;
  father_unknown: boolean;
  // Weight fields
  entry_weight: string;
  entry_weight_unknown: boolean;
  birth_weight: string;
  // Acquisition fields for new entrants
  acquisition_type: string; // "purchased" or "grant"
  purchase_price: string;
  grant_source: string; // "national_dairy_authority" | "local_government_unit" | "other"
  grant_source_other: string;
}

export const useAnimalForm = (farmId: string, onSuccess: () => void) => {
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const [formData, setFormData] = useState<AnimalFormData>({
    animal_type: "new_entrant",
    livestock_type: "cattle",
    name: "",
    ear_tag: "",
    breed: "",
    breed1: "",
    breed2: "",
    gender: "",
    birth_date: "",
    mother_id: "",
    father_id: "",
    is_father_ai: false,
    ai_bull_brand: "",
    ai_bull_reference: "",
    ai_bull_breed: "",
    // Initialize new fields
    farm_entry_date: new Date().toISOString().split("T")[0], // Default to today
    birth_date_unknown: false,
    mother_unknown: false,
    father_unknown: false,
    // Weight fields
    entry_weight: "",
    entry_weight_unknown: false,
    birth_weight: "",
    // Acquisition fields
    acquisition_type: "purchased",
    purchase_price: "",
    grant_source: "",
    grant_source_other: ""
  });

  const calculateBreed = (mothers: any[], fathers: any[]): string => {
    let finalBreed = formData.breed;
    
    if (formData.animal_type === "offspring") {
      const mother = mothers.find(m => m.id === formData.mother_id);
      const motherBreed = mother?.breed || "Unknown";
      
      let fatherBreed = "Unknown";
      if (formData.is_father_ai) {
        fatherBreed = formData.ai_bull_breed;
      } else {
        const father = fathers.find(f => f.id === formData.father_id);
        fatherBreed = father?.breed || "Unknown";
      }
      
      finalBreed = `${motherBreed} x ${fatherBreed}`;
    } else {
      if (formData.breed === "Mix Breed" && formData.breed1 && formData.breed2) {
        finalBreed = `${formData.breed1} x ${formData.breed2}`;
      }
    }

    return finalBreed;
  };

  const handleSubmit = async (e: React.FormEvent, mothers: any[], fathers: any[]) => {
    e.preventDefault();
    
    if (!formData.ear_tag) {
      toast({
        title: "Missing fields",
        description: "Ear tag is required",
        variant: "destructive"
      });
      return;
    }

    // Validate new entrant requirements
    if (formData.animal_type === "new_entrant") {
      if (!formData.farm_entry_date) {
        toast({
          title: "Missing fields",
          description: "Farm entry date is required for new entrants",
          variant: "destructive"
        });
        return;
      }
    }

    // Validate offspring requirements
    if (formData.animal_type === "offspring") {
      if (!formData.mother_id || formData.mother_id === "none") {
        toast({
          title: "Missing fields",
          description: "Mother is required for offspring",
          variant: "destructive"
        });
        return;
      }
      if (!formData.is_father_ai && (!formData.father_id || formData.father_id === "none")) {
        toast({
          title: "Missing fields",
          description: "Father or AI information is required for offspring",
          variant: "destructive"
        });
        return;
      }
      if (formData.is_father_ai && !formData.ai_bull_breed) {
        toast({
          title: "Missing fields",
          description: "AI bull breed is required for offspring",
          variant: "destructive"
        });
        return;
      }
    }

    setCreating(true);
    
    const finalBreed = calculateBreed(mothers, fathers);
    const { data: { user } } = await supabase.auth.getUser();
    
    const animalData = {
      farm_id: farmId,
      livestock_type: formData.livestock_type,
      name: formData.name || null,
      ear_tag: formData.ear_tag,
      breed: finalBreed || null,
      gender: formData.gender || null,
      birth_date: formData.birth_date_unknown ? null : (formData.birth_date || null),
      mother_id: formData.mother_unknown ? null : (formData.mother_id && formData.mother_id !== "none" ? formData.mother_id : null),
      father_id: formData.father_unknown ? null : (formData.is_father_ai ? null : (formData.father_id && formData.father_id !== "none" ? formData.father_id : null)),
      unique_code: null as string | null,
      // New entrant specific fields (always include, nulls are fine for offspring)
      farm_entry_date: formData.animal_type === "new_entrant" ? (formData.farm_entry_date || null) : null,
      birth_date_unknown: formData.animal_type === "new_entrant" ? formData.birth_date_unknown : false,
      mother_unknown: formData.animal_type === "new_entrant" ? formData.mother_unknown : false,
      father_unknown: formData.animal_type === "new_entrant" ? formData.father_unknown : false,
      // Weight fields
      entry_weight_kg: formData.animal_type === "new_entrant" && !formData.entry_weight_unknown && formData.entry_weight 
        ? parseFloat(formData.entry_weight) 
        : null,
      entry_weight_unknown: formData.animal_type === "new_entrant" ? formData.entry_weight_unknown : false,
      birth_weight_kg: formData.animal_type === "offspring" && formData.birth_weight 
        ? parseFloat(formData.birth_weight) 
        : null,
      // Acquisition fields (only for new entrants)
      acquisition_type: formData.animal_type === "new_entrant" ? formData.acquisition_type : null,
      purchase_price: formData.animal_type === "new_entrant" && formData.acquisition_type === "purchased" && formData.purchase_price 
        ? parseFloat(formData.purchase_price) 
        : null,
      grant_source: formData.animal_type === "new_entrant" && formData.acquisition_type === "grant" 
        ? formData.grant_source 
        : null,
      grant_source_other: formData.animal_type === "new_entrant" && formData.acquisition_type === "grant" && formData.grant_source === "other" 
        ? formData.grant_source_other 
        : null,
    };

    // If offline, queue the data
    if (!isOnline) {
      try {
        await addToQueue({
          id: crypto.randomUUID(),
          type: 'animal_form',
          payload: { 
            formData: animalData,
            aiInfo: formData.is_father_ai ? {
              ai_bull_brand: formData.ai_bull_brand,
              ai_bull_reference: formData.ai_bull_reference,
              ai_bull_breed: formData.ai_bull_breed,
              birth_date: formData.birth_date
            } : null
          },
          createdAt: Date.now(),
        });

        toast({
          title: "Saved Offline ✅",
          description: getOfflineMessage('animal'),
          duration: 5000,
        });

        onSuccess();
      } catch (error: any) {
        toast({
          title: "Error",
          description: translateError(error),
          variant: "destructive",
        });
      } finally {
        setCreating(false);
      }
      return;
    }

    // Online submission
    const { data, error } = await supabase.from("animals").insert([animalData]).select();

    if (!error && data && data[0]) {
      // Create AI record if AI was used
      if (formData.is_father_ai) {
        await supabase.from("ai_records").insert({
          animal_id: data[0].id,
          scheduled_date: formData.birth_date || null,
          performed_date: formData.birth_date || null,
          notes: `Bull Brand: ${formData.ai_bull_brand || 'N/A'}, Reference: ${formData.ai_bull_reference || 'N/A'}`,
          created_by: user?.id || null,
        });
      }

      // Create initial weight record if weight was provided
      if (formData.animal_type === "new_entrant" && !formData.entry_weight_unknown && formData.entry_weight) {
        await supabase.from("weight_records").insert({
          animal_id: data[0].id,
          weight_kg: parseFloat(formData.entry_weight),
          measurement_date: formData.farm_entry_date || new Date().toISOString().split("T")[0],
          measurement_method: "entry_weight",
          notes: "Initial weight at farm entry",
          created_by: user?.id || null,
        });
      }

      // Create birth weight record for offspring if provided
      if (formData.animal_type === "offspring" && formData.birth_weight && formData.birth_date) {
        await supabase.from("weight_records").insert({
          animal_id: data[0].id,
          weight_kg: parseFloat(formData.birth_weight),
          measurement_date: formData.birth_date,
          measurement_method: "birth_weight",
          notes: "Birth weight",
          created_by: user?.id || null,
        });
      }
    }

    setCreating(false);
    if (error) {
      toast({
        title: "Error creating animal",
        description: translateError(error),
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success!",
        description: "Animal added successfully"
      });
      onSuccess();
    }
  };

  return {
    formData,
    setFormData,
    creating,
    handleSubmit
  };
};
