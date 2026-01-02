import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, WifiOff, Dices, CalendarIcon, ChevronDown } from "lucide-react";
import { generateFilipinoAnimalName } from "@/lib/filipinoAnimalNames";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { updateAnimalCache, getCachedAnimals } from "@/lib/animalCache";
import { getOfflineMessage, translateError } from "@/lib/errorMessages";
import { getBreedsByLivestockType, type LivestockType } from "@/lib/livestockBreeds";
import { WeightHintBadge } from "@/components/ui/weight-hint-badge";
import { GenderSelector } from "@/components/animal-form/GenderSelector";
import { LactatingToggle, calculateMilkingStageFromDays } from "@/components/animal-form/LactatingToggle";
import { WeightEstimateButton } from "@/components/animal-form/WeightEstimateButton";
import { QuickAddToggle } from "@/components/animal-form/QuickAddToggle";
import { AddAnimalSuccessScreen } from "@/components/animal-form/AddAnimalSuccessScreen";
import { BilingualLabel } from "@/components/ui/bilingual-label";
import { labels, getLivestockEmoji } from "@/lib/filipinoLabels";
import VoiceQuickAdd, { type ExtractedAnimalData } from "@/components/animal-form/VoiceQuickAdd";
import { calculateLifeStage, calculateMaleStage, type AnimalStageData } from "@/lib/animalStages";

interface ParentAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed?: string | null;
}

interface AnimalFormProps {
  farmId: string;
  onSuccess: () => void;
  onCancel: () => void;
  defaultQuickMode?: boolean;
}

const AnimalForm = ({ farmId, onSuccess, onCancel, defaultQuickMode }: AnimalFormProps) => {
  const [creating, setCreating] = useState(false);
  const [genderError, setGenderError] = useState(false);
  const [mothers, setMothers] = useState<ParentAnimal[]>([]);
  const [fathers, setFathers] = useState<ParentAnimal[]>([]);
  const [livestockType, setLivestockType] = useState<LivestockType>('cattle');
  const [availableBreeds, setAvailableBreeds] = useState<readonly string[]>([]);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  
  // Quick Add Mode state - persisted to localStorage (unless defaultQuickMode is provided)
  const [isQuickMode, setIsQuickMode] = useState(() => {
    if (defaultQuickMode !== undefined) return defaultQuickMode;
    const saved = localStorage.getItem('animalForm_quickMode');
    return saved === null ? true : saved === 'true'; // Default to quick mode for new users
  });
  
  // Success Screen state
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [addedAnimalData, setAddedAnimalData] = useState<{
    name?: string;
    earTag: string;
    gender: string;
    livestockType: string;
    isLactating?: boolean;
    animalId?: string;
    animalType?: string;
  } | null>(null);
  
  const [formData, setFormData] = useState({
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
    farm_entry_date: new Date().toISOString().split("T")[0],
    birth_date_unknown: false,
    mother_unknown: false,
    father_unknown: false,
    entry_weight: "",
    entry_weight_unknown: false,
    birth_weight: "",
    acquisition_type: "purchased",
    purchase_price: "",
    grant_source: "",
    grant_source_other: "",
    is_currently_lactating: false,
    estimated_days_in_milk: 60,
  });

  // Persist Quick Mode preference
  useEffect(() => {
    localStorage.setItem('animalForm_quickMode', String(isQuickMode));
  }, [isQuickMode]);

  useEffect(() => {
    loadParentAnimals();
  }, [farmId, isOnline]);

  useEffect(() => {
    setAvailableBreeds(getBreedsByLivestockType(formData.livestock_type as LivestockType));
  }, [formData.livestock_type]);

  const loadParentAnimals = async () => {
    const cached = await getCachedAnimals(farmId);
    
    if (cached) {
      setMothers(cached.mothers as any);
      setFathers(cached.fathers as any);
    }

    const updated = await updateAnimalCache(farmId, isOnline);
    if (updated && updated !== cached) {
      setMothers(updated.mothers as any);
      setFathers(updated.fathers as any);
    }
  };

  const getFirstAIDate = (birthDate: string) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const aiDate = new Date(birth);
    aiDate.setMonth(aiDate.getMonth() + 15);
    return aiDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const resetForm = () => {
    setFormData({
      animal_type: "new_entrant",
      livestock_type: formData.livestock_type, // Keep the livestock type
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
      farm_entry_date: new Date().toISOString().split("T")[0],
      birth_date_unknown: false,
      mother_unknown: false,
      father_unknown: false,
      entry_weight: "",
      entry_weight_unknown: false,
      birth_weight: "",
      acquisition_type: "purchased",
      purchase_price: "",
      grant_source: "",
      grant_source_other: "",
      is_currently_lactating: false,
      estimated_days_in_milk: 60,
    });
    setGenderError(false);
  };

  const handleSuccessAction = (action: string) => {
    switch (action) {
      case "add_another":
        resetForm();
        setShowSuccessScreen(false);
        break;
      case "back_to_herd":
        setShowSuccessScreen(false);
        onSuccess();
        break;
      case "record_milk":
      case "schedule_ai":
      case "record_weight":
      case "add_photo":
        // For now, just go back to herd - these can be enhanced later
        setShowSuccessScreen(false);
        onSuccess();
        break;
      default:
        setShowSuccessScreen(false);
        onSuccess();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.gender) {
      setGenderError(true);
      toast({
        title: "Kulang ang detalye / Missing fields",
        description: "Piliin ang kasarian ng hayop / Please select the animal's gender",
        variant: "destructive"
      });
      return;
    }
    setGenderError(false);
    
    if (!formData.ear_tag) {
      toast({
        title: "Kulang ang detalye / Missing fields",
        description: "Kinakailangan ang ear tag / Ear tag is required",
        variant: "destructive"
      });
      return;
    }

    // Validate offspring requirements (only in full mode or when offspring is selected)
    if (formData.animal_type === "offspring") {
      if (!formData.mother_id || formData.mother_id === "none") {
        toast({
          title: "Kulang ang detalye / Missing fields",
          description: "Kinakailangan ang ina para sa anak / Mother is required for offspring",
          variant: "destructive"
        });
        return;
      }
      if (!formData.is_father_ai && (!formData.father_id || formData.father_id === "none")) {
        toast({
          title: "Kulang ang detalye / Missing fields",
          description: "Kinakailangan ang ama o AI / Father or AI information is required for offspring",
          variant: "destructive"
        });
        return;
      }
      if (formData.is_father_ai && !formData.ai_bull_breed) {
        toast({
          title: "Kulang ang detalye / Missing fields",
          description: "Kinakailangan ang lahi ng toro / AI bull breed is required for offspring",
          variant: "destructive"
        });
        return;
      }
    }

    setCreating(true);
    
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

    const { data: { user } } = await supabase.auth.getUser();
    
    const shouldSetMilkingStage = formData.animal_type === "new_entrant" 
      && formData.gender === "Female" 
      && formData.is_currently_lactating;
    
    const calculatedMilkingStage = shouldSetMilkingStage 
      ? calculateMilkingStageFromDays(formData.estimated_days_in_milk)
      : null;
    
    // Calculate life stage for new animal
    let calculatedLifeStage: string | null = null;
    const birthDateValue = formData.birth_date_unknown ? null : formData.birth_date;
    
    if (birthDateValue && formData.gender && formData.livestock_type) {
      const stageData: AnimalStageData = {
        birthDate: new Date(birthDateValue),
        gender: formData.gender,
        milkingStartDate: shouldSetMilkingStage ? new Date() : null,
        offspringCount: 0, // New animals have no offspring
        lastCalvingDate: null, // New animals haven't calved
        hasRecentMilking: shouldSetMilkingStage,
        hasActiveAI: false, // New animals don't have AI records yet
        livestockType: formData.livestock_type,
      };
      
      if (formData.gender === 'Male') {
        calculatedLifeStage = calculateMaleStage(stageData);
      } else {
        calculatedLifeStage = calculateLifeStage(stageData);
      }
    }
    
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
      farm_entry_date: formData.animal_type === "new_entrant" ? (formData.farm_entry_date || null) : null,
      birth_date_unknown: formData.animal_type === "new_entrant" ? formData.birth_date_unknown : false,
      mother_unknown: formData.animal_type === "new_entrant" ? formData.mother_unknown : false,
      father_unknown: formData.animal_type === "new_entrant" ? formData.father_unknown : false,
      entry_weight_kg: formData.animal_type === "new_entrant" && !formData.entry_weight_unknown && formData.entry_weight 
        ? parseFloat(formData.entry_weight) 
        : null,
      entry_weight_unknown: formData.animal_type === "new_entrant" ? formData.entry_weight_unknown : false,
      birth_weight_kg: formData.animal_type === "offspring" && formData.birth_weight 
        ? parseFloat(formData.birth_weight) 
        : null,
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
      is_currently_lactating: shouldSetMilkingStage,
      estimated_days_in_milk: shouldSetMilkingStage ? formData.estimated_days_in_milk : null,
      milking_stage: calculatedMilkingStage,
      life_stage: calculatedLifeStage,
    };

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
            } : null,
            initialWeight: formData.animal_type === "new_entrant" && !formData.entry_weight_unknown && formData.entry_weight
              ? { type: 'entry', weight_kg: parseFloat(formData.entry_weight), measurement_date: formData.farm_entry_date }
              : formData.animal_type === "offspring" && formData.birth_weight && formData.birth_date
              ? { type: 'birth', weight_kg: parseFloat(formData.birth_weight), measurement_date: formData.birth_date }
              : null
          },
          createdAt: Date.now(),
        });

        toast({
          title: "Nai-save Offline ✅ / Saved Offline",
          description: getOfflineMessage('animal'),
          duration: 5000,
        });

        // Show success screen even for offline
        setAddedAnimalData({
          name: formData.name,
          earTag: formData.ear_tag,
          gender: formData.gender,
          livestockType: formData.livestock_type,
          isLactating: formData.is_currently_lactating,
          animalType: formData.animal_type,
        });
        setShowSuccessScreen(true);
      } catch (error: any) {
        toast({
          title: "May error / Error",
          description: translateError(error),
          variant: "destructive",
        });
      } finally {
        setCreating(false);
      }
      return;
    }

    const { data, error } = await supabase.from("animals").insert([animalData]).select();

    if (!error && data && data[0]) {
      if (formData.is_father_ai) {
        await supabase.from("ai_records").insert({
          animal_id: data[0].id,
          scheduled_date: formData.birth_date || null,
          performed_date: formData.birth_date || null,
          notes: `Bull Brand: ${formData.ai_bull_brand || 'N/A'}, Reference: ${formData.ai_bull_reference || 'N/A'}`,
          created_by: user?.id || null,
        });
      }

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
      
      // Show success screen instead of immediate callback
      setAddedAnimalData({
        name: formData.name,
        earTag: formData.ear_tag,
        gender: formData.gender,
        livestockType: formData.livestock_type,
        isLactating: formData.is_currently_lactating,
        animalId: data[0].id,
        animalType: formData.animal_type,
      });
      setShowSuccessScreen(true);
    }

    setCreating(false);
    if (error) {
      toast({
        title: "May error sa pagdagdag / Error creating animal",
        description: translateError(error),
        variant: "destructive"
      });
    }
  };

  // Determine if we should show a field based on quick mode
  const showField = (fieldName: string): boolean => {
    if (!isQuickMode) return true; // Full mode shows everything
    
    // Quick mode essential fields
    const quickModeFields = [
      'livestock_type',
      'ear_tag',
      'gender',
      'birth_date',
      'entry_weight',
    ];
    
    return quickModeFields.includes(fieldName);
  };

  // Handle voice-extracted animal data
  const handleVoiceData = (data: ExtractedAnimalData) => {
    setFormData(prev => ({
      ...prev,
      livestock_type: data.livestock_type || prev.livestock_type,
      gender: data.gender || prev.gender,
      ear_tag: data.ear_tag || prev.ear_tag,
      name: data.name || prev.name,
      is_currently_lactating: data.is_lactating || prev.is_currently_lactating,
      entry_weight: data.entry_weight_kg?.toString() || prev.entry_weight,
      breed: data.breed || prev.breed,
      acquisition_type: data.acquisition_type || prev.acquisition_type,
    }));
    
    // Clear gender error if gender was provided
    if (data.gender) {
      setGenderError(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isOnline && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-md flex items-center gap-2 text-sm">
            <WifiOff className="h-4 w-4" />
            <span>Offline mode - Isi-sync kapag online / Data will sync when online</span>
          </div>
        )}
        
        {/* Quick Add Toggle */}
        <QuickAddToggle
          isQuickMode={isQuickMode}
          onToggle={setIsQuickMode}
        />
        
        {/* Voice Quick Add - Only shown in Quick Mode */}
        {isQuickMode && (
          <VoiceQuickAdd 
            onDataExtracted={handleVoiceData}
            disabled={!isOnline}
          />
        )}
        
        {/* Animal Type - Hidden in Quick Mode (defaults to new_entrant) */}
        {showField('animal_type') && (
          <div className="space-y-2">
            <BilingualLabel english="Animal Type" filipino="Uri ng Hayop" required htmlFor="animal_type" />
            <Select
              value={formData.animal_type}
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                animal_type: value,
                breed: "",
                breed1: "",
                breed2: ""
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type / Pumili ng uri" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_entrant">New Entrant / Bagong Dating</SelectItem>
                <SelectItem value="offspring">Offspring / Anak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Livestock Type - Always shown */}
        <div className="space-y-2">
          <BilingualLabel english="Livestock Type" filipino="Uri ng Livestock" required htmlFor="livestock_type" />
          <Select 
            value={formData.livestock_type} 
            onValueChange={(value) => {
              setFormData(prev => ({ 
                ...prev, 
                livestock_type: value,
                breed: "",
                breed1: "",
                breed2: ""
              }));
            }}
          >
            <SelectTrigger id="livestock_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cattle">{getLivestockEmoji('cattle')} Cattle / Baka</SelectItem>
              <SelectItem value="goat">{getLivestockEmoji('goat')} Goat / Kambing</SelectItem>
              <SelectItem value="sheep">{getLivestockEmoji('sheep')} Sheep / Tupa</SelectItem>
              <SelectItem value="carabao">{getLivestockEmoji('carabao')} Carabao / Kalabaw</SelectItem>
            </SelectContent>
          </Select>
          {!isQuickMode && (
            <p className="text-sm text-muted-foreground">
              You can manage multiple types of livestock on the same farm
            </p>
          )}
        </div>
        
        {/* Name - Hidden in Quick Mode */}
        {showField('name') && (
          <div className="space-y-2">
            <BilingualLabel english="Name" filipino="Pangalan" htmlFor="name" />
            <div className="flex gap-2">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Halimbawa: Bessie"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const newName = generateFilipinoAnimalName(formData.livestock_type);
                  setFormData(prev => ({ ...prev, name: newName }));
                }}
                title="I-generate ang random Filipino name"
              >
                <Dices className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Ear Tag - Always shown */}
        <div className="space-y-2">
          <BilingualLabel english="Ear Tag" filipino="Tatak sa Tainga" required htmlFor="ear_tag" />
          <Input
            id="ear_tag"
            value={formData.ear_tag}
            onChange={(e) => setFormData(prev => ({ ...prev, ear_tag: e.target.value }))}
            placeholder="Halimbawa: A001"
            required
          />
        </div>
        
        {/* Gender Selector - Always shown */}
        <GenderSelector
          value={formData.gender}
          onChange={(value) => {
            setFormData(prev => ({ 
              ...prev, 
              gender: value,
              is_currently_lactating: value === "Female" ? prev.is_currently_lactating : false,
            }));
            setGenderError(false);
          }}
          error={genderError}
        />
        
        {/* Lactating Toggle - Hidden in Quick Mode */}
        {showField('lactating') && formData.animal_type === "new_entrant" && formData.gender === "Female" && (
          <LactatingToggle
            isLactating={formData.is_currently_lactating}
            onLactatingChange={(value) => setFormData(prev => ({ 
              ...prev, 
              is_currently_lactating: value 
            }))}
            daysInMilk={formData.estimated_days_in_milk}
            onDaysChange={(days) => setFormData(prev => ({ 
              ...prev, 
              estimated_days_in_milk: days 
            }))}
          />
        )}
        
        {/* Farm Entry Date - Hidden in Quick Mode */}
        {showField('farm_entry_date') && formData.animal_type === "new_entrant" && (
          <div className="space-y-2">
            <BilingualLabel english="Farm Entry Date" filipino="Petsa ng Pagpasok sa Farm" required htmlFor="farm_entry_date" />
            <Input
              id="farm_entry_date"
              type="date"
              value={formData.farm_entry_date}
              onChange={(e) => setFormData(prev => ({ ...prev, farm_entry_date: e.target.value }))}
              required
            />
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              Date when the animal was introduced to your farm
            </p>
          </div>
        )}

        {/* Birth Date - Always shown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <BilingualLabel english="Birth Date" filipino="Petsa ng Kapanganakan" htmlFor="birth_date" />
            {formData.animal_type === "new_entrant" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="birth_date_unknown"
                  checked={formData.birth_date_unknown}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    birth_date_unknown: checked === true,
                    birth_date: checked === true ? "" : prev.birth_date
                  }))}
                />
                <label
                  htmlFor="birth_date_unknown"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  Unknown / Hindi Alam
                </label>
              </div>
            )}
          </div>
          <Input
            id="birth_date"
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
            disabled={formData.birth_date_unknown}
            className={formData.birth_date_unknown ? "opacity-50" : ""}
          />
          {formData.birth_date && formData.gender === "Female" && !formData.birth_date_unknown && (
            <p className="text-sm text-muted-foreground mt-2">
              Recommended first AI: <span className="font-medium">{getFirstAIDate(formData.birth_date)}</span>
            </p>
          )}
        </div>

        {/* Entry Weight - Always shown for new entrants */}
        {formData.animal_type === "new_entrant" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <BilingualLabel english="Entry Weight (kg)" filipino="Timbang sa Pagpasok" htmlFor="entry_weight" />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="entry_weight_unknown"
                  checked={formData.entry_weight_unknown}
                  onCheckedChange={(checked) => setFormData(prev => ({ 
                    ...prev, 
                    entry_weight_unknown: checked === true,
                    entry_weight: checked === true ? "" : prev.entry_weight
                  }))}
                />
                <label
                  htmlFor="entry_weight_unknown"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  No Data / Walang Data
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                id="entry_weight"
                type="number"
                step="0.1"
                min="0"
                value={formData.entry_weight}
                onChange={(e) => setFormData(prev => ({ ...prev, entry_weight: e.target.value }))}
                placeholder="Halimbawa: 350"
                disabled={formData.entry_weight_unknown}
                className={`flex-1 ${formData.entry_weight_unknown ? "opacity-50" : ""}`}
              />
              <WeightEstimateButton
                livestockType={formData.livestock_type}
                gender={formData.gender}
                birthDate={formData.birth_date_unknown ? null : formData.birth_date}
                onEstimate={(weight) => setFormData(prev => ({ ...prev, entry_weight: weight.toString() }))}
                disabled={formData.entry_weight_unknown || !formData.gender}
                weightType="entry"
              />
            </div>
            <WeightHintBadge
              livestockType={formData.livestock_type}
              gender={formData.gender}
              weightType="entry"
            />
          </div>
        )}

        {/* Acquisition Type - Hidden in Quick Mode */}
        {showField('acquisition') && formData.animal_type === "new_entrant" && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <BilingualLabel english="How was this animal acquired?" filipino="Paano nakuha ang hayop?" required />
            <RadioGroup
              value={formData.acquisition_type}
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                acquisition_type: value,
                purchase_price: value === "grant" ? "" : prev.purchase_price,
                grant_source: value === "purchased" ? "" : prev.grant_source,
                grant_source_other: value === "purchased" ? "" : prev.grant_source_other
              }))}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="purchased" id="acquired_purchased" />
                <label htmlFor="acquired_purchased" className="cursor-pointer font-normal">Purchased / Binili</label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="grant" id="acquired_grant" />
                <label htmlFor="acquired_grant" className="cursor-pointer font-normal">Grant / Bigay</label>
              </div>
            </RadioGroup>

            {formData.acquisition_type === "purchased" && (
              <div className="space-y-2">
                <BilingualLabel english="Purchase Price (PHP)" filipino="Halaga ng Pagbili" htmlFor="purchase_price" />
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchase_price: e.target.value }))}
                  placeholder="Halimbawa: 50000"
                />
              </div>
            )}

            {formData.acquisition_type === "grant" && (
              <>
                <div className="space-y-2">
                  <BilingualLabel english="Grant Source" filipino="Pinagmulan ng Bigay" required htmlFor="grant_source" />
                  <Select
                    value={formData.grant_source}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      grant_source: value,
                      grant_source_other: value !== "other" ? "" : prev.grant_source_other
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grant source / Pumili ng pinagmulan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national_dairy_authority">National Dairy Authority (NDA)</SelectItem>
                      <SelectItem value="local_government_unit">Local Government Unit (LGU)</SelectItem>
                      <SelectItem value="other">Other / Iba pa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.grant_source === "other" && (
                  <div className="space-y-2">
                    <BilingualLabel english="Specify Source" filipino="Tukuyin ang Pinagmulan" required htmlFor="grant_source_other" />
                    <Input
                      id="grant_source_other"
                      value={formData.grant_source_other}
                      onChange={(e) => setFormData(prev => ({ ...prev, grant_source_other: e.target.value }))}
                      placeholder="Enter grant source / Ilagay ang pinagmulan"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Breed Selection - Hidden in Quick Mode */}
        {showField('breed') && formData.animal_type === "new_entrant" && (
          <>
            <div className="space-y-2">
              <BilingualLabel english="Breed" filipino="Lahi" htmlFor="breed" />
              <Select
                value={formData.breed}
                onValueChange={(value) => setFormData(prev => ({ ...prev, breed: value, breed1: "", breed2: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select breed / Pumili ng lahi" />
                </SelectTrigger>
                <SelectContent>
                  {availableBreeds.map((breed) => (
                    <SelectItem key={breed} value={breed}>
                      {breed}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.breed === "Mix Breed" && (
              <>
                <div className="space-y-2">
                  <BilingualLabel english="First Breed" filipino="Unang Lahi" htmlFor="breed1" />
                  <Select
                    value={formData.breed1}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, breed1: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select first breed / Pumili ng unang lahi" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBreeds.filter(b => b !== "Mix Breed").map((breed) => (
                        <SelectItem key={breed} value={breed}>
                          {breed}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <BilingualLabel english="Second Breed" filipino="Ikalawang Lahi" htmlFor="breed2" />
                  <Select
                    value={formData.breed2}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, breed2: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select second breed / Pumili ng ikalawang lahi" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBreeds.filter(b => b !== "Mix Breed").map((breed) => (
                        <SelectItem key={breed} value={breed}>
                          {breed}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </>
        )}
        
        {showField('breed') && formData.animal_type === "offspring" && (
          <div className="space-y-2">
            <BilingualLabel english="Breed" filipino="Lahi" />
            <p className="text-sm text-muted-foreground">
              Breed will be automatically determined from parents
            </p>
          </div>
        )}

        {/* Birth Weight - Only for offspring */}
        {formData.animal_type === "offspring" && (
          <div className="space-y-2">
            <BilingualLabel english="Birth Weight (kg)" filipino="Timbang sa Kapanganakan" htmlFor="birth_weight" />
            <div className="flex gap-2">
              <Input
                id="birth_weight"
                type="number"
                step="0.1"
                min="0"
                value={formData.birth_weight}
                onChange={(e) => setFormData(prev => ({ ...prev, birth_weight: e.target.value }))}
                placeholder="Halimbawa: 35"
                className="flex-1"
              />
              <WeightEstimateButton
                livestockType={formData.livestock_type}
                gender={formData.gender}
                onEstimate={(weight) => setFormData(prev => ({ ...prev, birth_weight: weight.toString() }))}
                weightType="birth"
              />
            </div>
            <WeightHintBadge
              livestockType={formData.livestock_type}
              weightType="birth"
            />
          </div>
        )}

        {/* Parent Information - Hidden in Quick Mode */}
        {showField('parents') && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">
              Parent Information / Impormasyon ng Magulang {formData.animal_type === "offspring" ? "*" : "(Optional)"}
            </h3>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <BilingualLabel english="Mother" filipino="Ina" htmlFor="mother_id" />
                {formData.animal_type === "new_entrant" && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mother_unknown"
                      checked={formData.mother_unknown}
                      onCheckedChange={(checked) => setFormData(prev => ({ 
                        ...prev, 
                        mother_unknown: checked === true,
                        mother_id: checked === true ? "" : prev.mother_id
                      }))}
                    />
                    <label
                      htmlFor="mother_unknown"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Unknown / Hindi Alam
                    </label>
                  </div>
                )}
              </div>
              <Select
                value={formData.mother_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, mother_id: value }))}
                disabled={formData.mother_unknown}
              >
                <SelectTrigger className={formData.mother_unknown ? "opacity-50" : ""}>
                  <SelectValue placeholder="Select mother / Pumili ng ina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / Wala</SelectItem>
                  {mothers.map((mother) => (
                    <SelectItem key={mother.id} value={mother.id}>
                      {mother.name || mother.ear_tag || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <BilingualLabel english="Father" filipino="Ama" htmlFor="father_id" />
                {formData.animal_type === "new_entrant" && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="father_unknown"
                      checked={formData.father_unknown}
                      onCheckedChange={(checked) => setFormData(prev => ({ 
                        ...prev, 
                        father_unknown: checked === true,
                        father_id: checked === true ? "" : prev.father_id,
                        is_father_ai: checked === true ? false : prev.is_father_ai
                      }))}
                    />
                    <label
                      htmlFor="father_unknown"
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      Unknown / Hindi Alam
                    </label>
                  </div>
                )}
              </div>
              <Select
                value={formData.is_father_ai ? "ai" : formData.father_id}
                onValueChange={(value) => {
                  if (value === "ai") {
                    setFormData(prev => ({ ...prev, is_father_ai: true, father_id: "" }));
                  } else {
                    setFormData(prev => ({ ...prev, is_father_ai: false, father_id: value }));
                  }
                }}
                disabled={formData.father_unknown}
              >
                <SelectTrigger className={formData.father_unknown ? "opacity-50" : ""}>
                  <SelectValue placeholder="Select father / Pumili ng ama" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / Wala</SelectItem>
                  <SelectItem value="ai">Artificial Insemination / AI</SelectItem>
                  {fathers.map((father) => (
                    <SelectItem key={father.id} value={father.id}>
                      {father.name || father.ear_tag || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.is_father_ai && !formData.father_unknown && (
              <>
                <div className="space-y-2">
                  <BilingualLabel english="Bull Semen Brand" filipino="Brand ng Semen" htmlFor="ai_bull_brand" />
                  <Input
                    id="ai_bull_brand"
                    value={formData.ai_bull_brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, ai_bull_brand: e.target.value }))}
                    placeholder="Enter bull semen brand"
                  />
                </div>
                <div className="space-y-2">
                  <BilingualLabel english="Bull Reference/Name" filipino="Pangalan ng Toro" htmlFor="ai_bull_reference" />
                  <Input
                    id="ai_bull_reference"
                    value={formData.ai_bull_reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, ai_bull_reference: e.target.value }))}
                    placeholder="Enter bull reference or name"
                  />
                </div>
                {formData.animal_type === "offspring" && (
                  <div className="space-y-2">
                    <BilingualLabel english="Bull Breed" filipino="Lahi ng Toro" required htmlFor="ai_bull_breed" />
                    <Select
                      value={formData.ai_bull_breed}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, ai_bull_breed: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bull breed / Pumili ng lahi ng toro" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBreeds.filter(b => b !== "Mix Breed").map((breed) => (
                          <SelectItem key={breed} value={breed}>
                            {breed}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Show More Fields button in Quick Mode */}
        {isQuickMode && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => setIsQuickMode(false)}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            Show More Fields / Ipakita ang Higit Pang Fields
          </Button>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-12">
            Cancel
          </Button>
          <Button type="submit" disabled={creating} className="flex-1 h-12">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Animal"}
          </Button>
        </div>
      </form>
      
      {/* Success Screen */}
      {addedAnimalData && (
        <AddAnimalSuccessScreen
          open={showSuccessScreen}
          onClose={() => {
            setShowSuccessScreen(false);
            onSuccess();
          }}
          animalData={addedAnimalData}
          onAction={handleSuccessAction}
        />
      )}
    </>
  );
};

export default AnimalForm;
