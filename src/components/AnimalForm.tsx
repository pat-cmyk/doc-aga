import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { addToQueue } from "@/lib/offlineQueue";
import { updateAnimalCache, getCachedAnimals } from "@/lib/animalCache";
import { getOfflineMessage, translateError } from "@/lib/errorMessages";
import { getBreedsByLivestockType, type LivestockType } from "@/lib/livestockBreeds";

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
    ai_bull_breed: ""
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
    
    const animalData = {
      farm_id: farmId,
      livestock_type: formData.livestock_type, // NEW: Include livestock type
      name: formData.name || null,
      ear_tag: formData.ear_tag,
      breed: finalBreed || null,
      gender: formData.gender || null,
      birth_date: formData.birth_date || null,
      mother_id: formData.mother_id && formData.mother_id !== "none" ? formData.mother_id : null,
      father_id: formData.is_father_ai ? null : (formData.father_id && formData.father_id !== "none" ? formData.father_id : null),
      unique_code: null as any, // Auto-generated by database trigger
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

    // Online: Normal submission
    const { data, error } = await supabase.from("animals").insert([animalData]).select();

    // If AI was used and animal was created successfully, create AI record
    if (!error && formData.is_father_ai && data && data[0]) {
      await supabase.from("ai_records").insert({
        animal_id: data[0].id,
        scheduled_date: formData.birth_date || null,
        performed_date: formData.birth_date || null,
        notes: `Bull Brand: ${formData.ai_bull_brand || 'N/A'}, Reference: ${formData.ai_bull_reference || 'N/A'}`,
        created_by: user?.id || null,
      });
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
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Bessie"
            />
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
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            <Label htmlFor="birth_date">Birth Date</Label>
            <Input
              id="birth_date"
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
            />
            {formData.birth_date && formData.gender === "Female" && (
              <p className="text-sm text-muted-foreground mt-2">
                Recommended first AI date: <span className="font-medium">{getFirstAIDate(formData.birth_date)}</span>
              </p>
            )}
          </div>

          {/* Parent Selection */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">
              Parent Information {formData.animal_type === "offspring" ? "*" : "(Optional)"}
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="mother_id">Mother</Label>
              <Select
                value={formData.mother_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, mother_id: value }))}
              >
                <SelectTrigger>
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
              <Label htmlFor="father_id">Father</Label>
              <Select
                value={formData.is_father_ai ? "ai" : formData.father_id}
                onValueChange={(value) => {
                  if (value === "ai") {
                    setFormData(prev => ({ ...prev, is_father_ai: true, father_id: "" }));
                  } else {
                    setFormData(prev => ({ ...prev, is_father_ai: false, father_id: value }));
                  }
                }}
              >
                <SelectTrigger>
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

            {formData.is_father_ai && (
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