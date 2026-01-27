import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { calculateMilkingStageFromDays } from "@/components/animal-form/LactatingToggle";
import { translateError } from "@/lib/errorMessages";

export interface EditAnimalFormData {
  // Basic Info
  name: string;
  ear_tag: string;
  gender: string;
  breed: string;
  breed1: string;
  breed2: string;
  livestock_type: string;

  // Dates
  birth_date: string;
  birth_date_unknown: boolean;
  farm_entry_date: string;
  milking_start_date: string;

  // Parentage
  mother_id: string;
  mother_unknown: boolean;
  father_id: string;
  father_unknown: boolean;
  is_father_ai: boolean;
  ai_bull_brand: string;
  ai_bull_reference: string;
  ai_bull_breed: string;

  // Weight
  entry_weight_kg: string;
  entry_weight_unknown: boolean;
  birth_weight_kg: string;
  current_weight_kg: string;

  // Acquisition (new entrants only)
  acquisition_type: string;
  purchase_price: string;
  grant_source: string;
  grant_source_other: string;

  // Lactation
  is_currently_lactating: boolean;
  estimated_days_in_milk: number;
}

export interface AnimalData {
  id: string;
  name?: string | null;
  ear_tag?: string | null;
  gender?: string | null;
  breed?: string | null;
  livestock_type: string;
  birth_date?: string | null;
  birth_date_unknown?: boolean | null;
  farm_entry_date?: string | null;
  milking_start_date?: string | null;
  mother_id?: string | null;
  mother_unknown?: boolean | null;
  father_id?: string | null;
  father_unknown?: boolean | null;
  entry_weight_kg?: number | null;
  entry_weight_unknown?: boolean | null;
  birth_weight_kg?: number | null;
  current_weight_kg?: number | null;
  acquisition_type?: string | null;
  purchase_price?: number | null;
  grant_source?: string | null;
  grant_source_other?: string | null;
  is_currently_lactating?: boolean | null;
  estimated_days_in_milk?: number | null;
}

export interface ParentAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed?: string | null;
}

// Helper to detect if animal is a new entrant (has farm_entry_date or acquisition_type)
export const isNewEntrant = (animal: AnimalData): boolean => {
  return !!(animal.farm_entry_date || animal.acquisition_type || animal.entry_weight_kg !== null);
};

// Helper to parse breed into breed1/breed2 if it's a mix
const parseBreed = (breed: string | null | undefined): { breed: string; breed1: string; breed2: string } => {
  if (!breed) return { breed: "", breed1: "", breed2: "" };
  
  // Check if it's a cross breed format like "Holstein x Sahiwal"
  if (breed.includes(" x ")) {
    const parts = breed.split(" x ");
    return {
      breed: "Mix Breed",
      breed1: parts[0] || "",
      breed2: parts[1] || ""
    };
  }
  
  return { breed, breed1: "", breed2: "" };
};

export const useEditAnimalForm = (
  animal: AnimalData | null,
  farmId: string,
  onSuccess: () => void
) => {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mothers, setMothers] = useState<ParentAnimal[]>([]);
  const [fathers, setFathers] = useState<ParentAnimal[]>([]);
  const [loadingParents, setLoadingParents] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialFormData: EditAnimalFormData = {
    name: "",
    ear_tag: "",
    gender: "",
    breed: "",
    breed1: "",
    breed2: "",
    livestock_type: "cattle",
    birth_date: "",
    birth_date_unknown: false,
    farm_entry_date: "",
    milking_start_date: "",
    mother_id: "",
    mother_unknown: false,
    father_id: "",
    father_unknown: false,
    is_father_ai: false,
    ai_bull_brand: "",
    ai_bull_reference: "",
    ai_bull_breed: "",
    entry_weight_kg: "",
    entry_weight_unknown: false,
    birth_weight_kg: "",
    current_weight_kg: "",
    acquisition_type: "purchased",
    purchase_price: "",
    grant_source: "",
    grant_source_other: "",
    is_currently_lactating: false,
    estimated_days_in_milk: 60,
  };

  const [formData, setFormData] = useState<EditAnimalFormData>(initialFormData);
  const [originalFormData, setOriginalFormData] = useState<EditAnimalFormData>(initialFormData);

  // Load parent animals for selectors
  useEffect(() => {
    const loadParents = async () => {
      if (!farmId) return;
      
      setLoadingParents(true);
      try {
        const { data: animalsData } = await supabase
          .from("animals")
          .select("id, name, ear_tag, gender, breed")
          .eq("farm_id", farmId)
          .eq("is_deleted", false);

        if (animalsData) {
          // Filter out the current animal from parent options
          const filteredAnimals = animal 
            ? animalsData.filter(a => a.id !== animal.id)
            : animalsData;
            
          setMothers(filteredAnimals.filter(a => a.gender === "Female"));
          setFathers(filteredAnimals.filter(a => a.gender === "Male"));
        }
      } catch (error) {
        console.error("Error loading parents:", error);
      } finally {
        setLoadingParents(false);
      }
    };

    loadParents();
  }, [farmId, animal?.id]);

  // Initialize form data from animal
  useEffect(() => {
    if (animal) {
      const breedParts = parseBreed(animal.breed);
      
      const newFormData: EditAnimalFormData = {
        name: animal.name || "",
        ear_tag: animal.ear_tag || "",
        gender: animal.gender || "",
        breed: breedParts.breed,
        breed1: breedParts.breed1,
        breed2: breedParts.breed2,
        livestock_type: animal.livestock_type || "cattle",
        birth_date: animal.birth_date || "",
        birth_date_unknown: animal.birth_date_unknown || false,
        farm_entry_date: animal.farm_entry_date || "",
        milking_start_date: animal.milking_start_date || "",
        mother_id: animal.mother_id || "",
        mother_unknown: animal.mother_unknown || false,
        father_id: animal.father_id || "",
        father_unknown: animal.father_unknown || false,
        is_father_ai: false, // Will need to detect from AI records if needed
        ai_bull_brand: "",
        ai_bull_reference: "",
        ai_bull_breed: "",
        entry_weight_kg: animal.entry_weight_kg?.toString() || "",
        entry_weight_unknown: animal.entry_weight_unknown || false,
        birth_weight_kg: animal.birth_weight_kg?.toString() || "",
        current_weight_kg: animal.current_weight_kg?.toString() || "",
        acquisition_type: animal.acquisition_type || "purchased",
        purchase_price: animal.purchase_price?.toString() || "",
        grant_source: animal.grant_source || "",
        grant_source_other: animal.grant_source_other || "",
        is_currently_lactating: animal.is_currently_lactating || false,
        estimated_days_in_milk: animal.estimated_days_in_milk || 60,
      };
      
      setFormData(newFormData);
      setOriginalFormData(newFormData);
      setHasChanges(false);
    }
  }, [animal]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify(originalFormData);
    setHasChanges(changed);
  }, [formData, originalFormData]);

  // Validate form in real-time
  const validateForm = (data: EditAnimalFormData, isNewEntrant: boolean): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    // Always required
    if (!data.ear_tag.trim()) {
      newErrors.ear_tag = "Ear tag is required";
    }
    if (!data.gender) {
      newErrors.gender = "Gender is required";
    }

    // Conditional: Mix Breed requires both breeds
    if (data.breed === "Mix Breed") {
      if (!data.breed1) {
        newErrors.breed1 = "First breed is required for mix breed";
      }
      if (!data.breed2) {
        newErrors.breed2 = "Second breed is required for mix breed";
      }
    }

    // Conditional: Grant source required if acquisition type is grant
    if (isNewEntrant && data.acquisition_type === "grant" && !data.grant_source) {
      newErrors.grant_source = "Grant source is required";
    }

    // Conditional: Grant source other required if grant source is "other"
    if (isNewEntrant && data.acquisition_type === "grant" && data.grant_source === "other" && !data.grant_source_other.trim()) {
      newErrors.grant_source_other = "Please specify the grant source";
    }

    return newErrors;
  };

  // Real-time validation effect
  useEffect(() => {
    const currentIsNewEntrant = animal ? isNewEntrant(animal) : false;
    const newErrors = validateForm(formData, currentIsNewEntrant);
    setErrors(newErrors);
  }, [formData, animal]);

  // Computed validity
  const isFormValid = Object.keys(errors).length === 0;

  const resetForm = () => {
    setFormData(originalFormData);
    setHasChanges(false);
  };

  const calculateBreed = (): string => {
    if (formData.breed === "Mix Breed" && formData.breed1 && formData.breed2) {
      return `${formData.breed1} x ${formData.breed2}`;
    }
    return formData.breed;
  };

  const handleSubmit = async () => {
    if (!animal) return;
    
    // Validation
    if (!formData.ear_tag) {
      toast({
        title: "Missing fields",
        description: "Ear tag is required",
        variant: "destructive"
      });
      return;
    }

    if (!formData.gender) {
      toast({
        title: "Missing fields",
        description: "Gender is required",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    try {
      const isAnimalNewEntrant = isNewEntrant(animal);
      const finalBreed = calculateBreed();
      
      // Calculate milking stage if lactating
      const shouldSetMilkingStage = formData.gender === "Female" && formData.is_currently_lactating;
      const calculatedMilkingStage = shouldSetMilkingStage 
        ? calculateMilkingStageFromDays(formData.estimated_days_in_milk)
        : null;

      const updates: Record<string, any> = {
        // Basic Info
        name: formData.name || null,
        ear_tag: formData.ear_tag,
        gender: formData.gender,
        breed: finalBreed || null,
        
        // Dates
        birth_date: formData.birth_date_unknown ? null : (formData.birth_date || null),
        birth_date_unknown: formData.birth_date_unknown,
        milking_start_date: formData.milking_start_date || null,
        
        // Parentage
        mother_id: formData.mother_unknown ? null : (formData.mother_id || null),
        mother_unknown: formData.mother_unknown,
        father_id: formData.father_unknown ? null : (formData.father_id || null),
        father_unknown: formData.father_unknown,
        
        // Current Weight (always updateable)
        current_weight_kg: formData.current_weight_kg ? parseFloat(formData.current_weight_kg) : null,
        
        // Lactation
        is_currently_lactating: shouldSetMilkingStage,
        estimated_days_in_milk: shouldSetMilkingStage ? formData.estimated_days_in_milk : null,
        milking_stage: calculatedMilkingStage,
      };

      // New entrant specific fields
      if (isAnimalNewEntrant) {
        updates.farm_entry_date = formData.farm_entry_date || null;
        updates.entry_weight_kg = !formData.entry_weight_unknown && formData.entry_weight_kg 
          ? parseFloat(formData.entry_weight_kg) 
          : null;
        updates.entry_weight_unknown = formData.entry_weight_unknown;
        updates.acquisition_type = formData.acquisition_type;
        updates.purchase_price = formData.acquisition_type === "purchased" && formData.purchase_price
          ? parseFloat(formData.purchase_price)
          : null;
        updates.grant_source = formData.acquisition_type === "grant" ? formData.grant_source : null;
        updates.grant_source_other = formData.acquisition_type === "grant" && formData.grant_source === "other"
          ? formData.grant_source_other
          : null;
      } else {
        // Offspring specific
        updates.birth_weight_kg = formData.birth_weight_kg ? parseFloat(formData.birth_weight_kg) : null;
      }

      const { error } = await supabase
        .from("animals")
        .update(updates)
        .eq("id", animal.id);

      if (error) throw error;

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["animal", animal.id] });
      queryClient.invalidateQueries({ queryKey: ["animals", farmId] });
      if (formData.gender === "Female") {
        queryClient.invalidateQueries({ queryKey: ["lactating-animals"] });
      }

      toast({
        title: "Success!",
        description: "Animal details updated successfully"
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error updating animal",
        description: translateError(error),
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reason: string) => {
    if (!animal) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("animals")
        .update({
          is_deleted: true,
          exit_date: new Date().toISOString().split('T')[0],
          exit_reason: 'data_error',
          exit_notes: reason,
        })
        .eq("id", animal.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["animal", animal.id] });
      queryClient.invalidateQueries({ queryKey: ["animals", farmId] });
      if (animal.gender === "Female") {
        queryClient.invalidateQueries({ queryKey: ["lactating-animals"] });
      }

      toast({
        title: "Animal Deleted",
        description: "The animal record has been removed from your farm.",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error deleting animal",
        description: translateError(error),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return {
    formData,
    setFormData,
    saving,
    deleting,
    hasChanges,
    errors,
    isFormValid,
    mothers,
    fathers,
    loadingParents,
    handleSubmit,
    handleDelete,
    resetForm,
    isAnimalNewEntrant: animal ? isNewEntrant(animal) : false,
  };
};
