import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, WifiOff, Dices, CalendarIcon } from "lucide-react";
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
}

const AnimalForm = ({ farmId, onSuccess, onCancel }: AnimalFormProps) => {
  const [creating, setCreating] = useState(false);
  const [genderError, setGenderError] = useState(false);
  const [mothers, setMothers] = useState<ParentAnimal[]>([]);
  const [fathers, setFathers] = useState<ParentAnimal[]>([]);
  const [livestockType, setLivestockType] = useState<LivestockType>('cattle');
  const [availableBreeds, setAvailableBreeds] = useState<readonly string[]>([]);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const [formData, setFormData] = useState({
    animal_type: "new_entrant", // "offspring" or "new_entrant"
    livestock_type: "cattle", // NEW: livestock type per animal
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
    // New fields for new entrants
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
    grant_source_other: "",
    // Enhancement 1: Lactating toggle
    is_currently_lactating: false,
    estimated_days_in_milk: 60,
  });

  useEffect(() => {
    loadParentAnimals();
  }, [farmId, isOnline]);

  // Update breeds when livestock_type changes
  useEffect(() => {
    setAvailableBreeds(getBreedsByLivestockType(formData.livestock_type as LivestockType));
  }, [formData.livestock_type]);

  // Load parent breed information
  const getParentBreed = async (parentId: string) => {
    const { data } = await supabase
      .from("animals")
      .select("breed")
      .eq("id", parentId)
      .single();
    return data?.breed || "Unknown";
  };

  const loadParentAnimals = async () => {
    // Try to use cached data first (especially when offline)
    const cached = await getCachedAnimals(farmId);
    
    if (cached) {
      setMothers(cached.mothers as any);
      setFathers(cached.fathers as any);
    }

    // Update cache if online
    const updated = await updateAnimalCache(farmId, isOnline);
    if (updated && updated !== cached) {
      setMothers(updated.mothers as any);
      setFathers(updated.fathers as any);
    }
  };

  // Calculate recommended first AI date (15 months after birth for heifers)
  const getFirstAIDate = (birthDate: string) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const aiDate = new Date(birth);
    aiDate.setMonth(aiDate.getMonth() + 15);
    return aiDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhancement 2: Gender is now required
    if (!formData.gender) {
      setGenderError(true);
      toast({
        title: "Missing fields",
        description: "Please select the animal's gender",
        variant: "destructive"
      });
      return;
    }
    setGenderError(false);
    
    if (!formData.ear_tag) {
      toast({
        title: "Missing fields",
        description: "Ear tag is required",
        variant: "destructive"
      });
      return;
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
    
    // Determine final breed value
    let finalBreed = formData.breed;
    
    if (formData.animal_type === "offspring") {
      // Calculate breed from parents
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
      // New entrant - use selected breed
      if (formData.breed === "Mix Breed" && formData.breed1 && formData.breed2) {
        finalBreed = `${formData.breed1} x ${formData.breed2}`;
      }
    }

    // Get user ID for created_by field
    const { data: { user } } = await supabase.auth.getUser();
    
    // Enhancement 1: Calculate milking_stage for lactating new entrants
    const shouldSetMilkingStage = formData.animal_type === "new_entrant" 
      && formData.gender === "Female" 
      && formData.is_currently_lactating;
    
    const calculatedMilkingStage = shouldSetMilkingStage 
      ? calculateMilkingStageFromDays(formData.estimated_days_in_milk)
      : null;
    
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
      // New entrant specific fields
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
      // Enhancement 1: Lactating toggle fields
      is_currently_lactating: shouldSetMilkingStage,
      estimated_days_in_milk: shouldSetMilkingStage ? formData.estimated_days_in_milk : null,
      milking_stage: calculatedMilkingStage,
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

    // Online: Normal submission
    const { data, error } = await supabase.from("animals").insert([animalData]).select();

    if (!error && data && data[0]) {
      // If AI was used, create AI record
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
          {!isOnline && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-md flex items-center gap-2 text-sm">
              <WifiOff className="h-4 w-4" />
              <span>Offline mode - Data will sync when online</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="animal_type">Animal Type *</Label>
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
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_entrant">New Entrant</SelectItem>
                <SelectItem value="offspring">Offspring</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* NEW: Livestock Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="livestock_type">Livestock Type *</Label>
            <Select 
              value={formData.livestock_type} 
              onValueChange={(value) => {
                setFormData(prev => ({ 
                  ...prev, 
                  livestock_type: value,
                  breed: "", // Reset breed when livestock type changes
                  breed1: "",
                  breed2: ""
                }));
              }}
            >
              <SelectTrigger id="livestock_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cattle">🐄 Cattle</SelectItem>
                <SelectItem value="goat">🐐 Goat</SelectItem>
                <SelectItem value="sheep">🐑 Sheep</SelectItem>
                <SelectItem value="carabao">🐃 Carabao</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              You can manage multiple types of livestock on the same farm
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Bessie"
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
                title="Generate random Filipino name"
              >
                <Dices className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ear_tag">Ear Tag *</Label>
            <Input
              id="ear_tag"
              value={formData.ear_tag}
              onChange={(e) => setFormData(prev => ({ ...prev, ear_tag: e.target.value }))}
              placeholder="A001"
              required
            />
          </div>
          
          {/* Enhancement 2: Visual Gender Selector (Required) */}
          <GenderSelector
            value={formData.gender}
            onChange={(value) => {
              setFormData(prev => ({ 
                ...prev, 
                gender: value,
                // Reset lactating toggle when gender changes
                is_currently_lactating: value === "Female" ? prev.is_currently_lactating : false,
              }));
              setGenderError(false);
            }}
            error={genderError}
          />
          
          {/* Enhancement 1: Lactating Toggle - Only for Female new entrants */}
          {formData.animal_type === "new_entrant" && formData.gender === "Female" && (
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
          
          {/* Farm Entry Date - Only for new entrants */}
          {formData.animal_type === "new_entrant" && (
            <div className="space-y-2">
              <Label htmlFor="farm_entry_date">Farm Entry Date *</Label>
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

          {/* Entry Weight - Only for new entrants */}
          {formData.animal_type === "new_entrant" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="entry_weight">Entry Weight (kg)</Label>
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
                    No data
                  </label>
                </div>
              </div>
              <Input
                id="entry_weight"
                type="number"
                step="0.1"
                min="0"
                value={formData.entry_weight}
                onChange={(e) => setFormData(prev => ({ ...prev, entry_weight: e.target.value }))}
                placeholder="e.g., 350"
                disabled={formData.entry_weight_unknown}
                className={formData.entry_weight_unknown ? "opacity-50" : ""}
              />
              <WeightHintBadge
                livestockType={formData.livestock_type}
                gender={formData.gender}
                weightType="entry"
              />
            </div>
          )}

          {/* Acquisition Type - Only for new entrants */}
          {formData.animal_type === "new_entrant" && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <Label>How was this animal acquired? *</Label>
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
                  <Label htmlFor="acquired_purchased" className="cursor-pointer font-normal">Purchased</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="grant" id="acquired_grant" />
                  <Label htmlFor="acquired_grant" className="cursor-pointer font-normal">Grant / Donation</Label>
                </div>
              </RadioGroup>

              {formData.acquisition_type === "purchased" && (
                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase Price (PHP)</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, purchase_price: e.target.value }))}
                    placeholder="e.g., 50000"
                  />
                </div>
              )}

              {formData.acquisition_type === "grant" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="grant_source">Grant Source *</Label>
                    <Select
                      value={formData.grant_source}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        grant_source: value,
                        grant_source_other: value !== "other" ? "" : prev.grant_source_other
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grant source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="national_dairy_authority">National Dairy Authority (NDA)</SelectItem>
                        <SelectItem value="local_government_unit">Local Government Unit (LGU)</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.grant_source === "other" && (
                    <div className="space-y-2">
                      <Label htmlFor="grant_source_other">Specify Source *</Label>
                      <Input
                        id="grant_source_other"
                        value={formData.grant_source_other}
                        onChange={(e) => setFormData(prev => ({ ...prev, grant_source_other: e.target.value }))}
                        placeholder="Enter grant source"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {formData.animal_type === "new_entrant" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="breed">Breed</Label>
                <Select
                  value={formData.breed}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, breed: value, breed1: "", breed2: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select breed" />
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
                    <Label htmlFor="breed1">First Breed</Label>
                    <Select
                      value={formData.breed1}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, breed1: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select first breed" />
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
                    <Label htmlFor="breed2">Second Breed</Label>
                    <Select
                      value={formData.breed2}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, breed2: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select second breed" />
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
          {formData.animal_type === "offspring" && (
            <div className="space-y-2">
              <Label>Breed</Label>
              <p className="text-sm text-muted-foreground">
                Breed will be automatically determined from parents
              </p>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="birth_date">Birth Date</Label>
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
                    Unknown
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
                Recommended first AI date: <span className="font-medium">{getFirstAIDate(formData.birth_date)}</span>
              </p>
            )}
          </div>

          {/* Birth Weight - Only for offspring */}
          {formData.animal_type === "offspring" && (
            <div className="space-y-2">
              <Label htmlFor="birth_weight">Birth Weight (kg)</Label>
              <Input
                id="birth_weight"
                type="number"
                step="0.1"
                min="0"
                value={formData.birth_weight}
                onChange={(e) => setFormData(prev => ({ ...prev, birth_weight: e.target.value }))}
                placeholder="e.g., 35"
              />
              <WeightHintBadge
                livestockType={formData.livestock_type}
                weightType="birth"
              />
            </div>
          )}

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">
              Parent Information {formData.animal_type === "offspring" ? "*" : "(Optional)"}
            </h3>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="mother_id">Mother</Label>
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
                      Unknown
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
                  <SelectValue placeholder="Select mother" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
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
                <Label htmlFor="father_id">Father</Label>
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
                      Unknown
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
                  <SelectValue placeholder="Select father" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="ai">Artificial Insemination</SelectItem>
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
                  <Label htmlFor="ai_bull_brand">Bull Semen Brand</Label>
                  <Input
                    id="ai_bull_brand"
                    value={formData.ai_bull_brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, ai_bull_brand: e.target.value }))}
                    placeholder="Enter bull semen brand"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai_bull_reference">Bull Reference/Name</Label>
                  <Input
                    id="ai_bull_reference"
                    value={formData.ai_bull_reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, ai_bull_reference: e.target.value }))}
                    placeholder="Enter bull reference or name"
                  />
                </div>
                {formData.animal_type === "offspring" && (
                  <div className="space-y-2">
                    <Label htmlFor="ai_bull_breed">Bull Breed *</Label>
                    <Select
                      value={formData.ai_bull_breed}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, ai_bull_breed: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bull breed" />
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

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={creating} className="flex-1">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Animal"}
            </Button>
          </div>
        </form>
  );
};

export default AnimalForm;