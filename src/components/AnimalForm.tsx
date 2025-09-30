import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParentAnimal {
  id: string;
  name: string | null;
  ear_tag: string | null;
}

interface AnimalFormProps {
  farmId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CATTLE_BREEDS = [
  "Holstein",
  "Jersey",
  "Guernsey",
  "Ayrshire",
  "Brown Swiss",
  "Milking Shorthorn",
  "Angus",
  "Hereford",
  "Brahman",
  "Simmental",
  "Charolais",
  "Limousin",
  "Gelbvieh",
  "Red Poll",
  "Devon",
  "Mix Breed"
];

const AnimalForm = ({ farmId, onSuccess, onCancel }: AnimalFormProps) => {
  const [creating, setCreating] = useState(false);
  const [mothers, setMothers] = useState<ParentAnimal[]>([]);
  const [fathers, setFathers] = useState<ParentAnimal[]>([]);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    ear_tag: "",
    breed: "",
    breed1: "",
    breed2: "",
    gender: "",
    birth_date: "",
    mother_id: "",
    father_id: ""
  });

  useEffect(() => {
    loadParentAnimals();
  }, [farmId]);

  const loadParentAnimals = async () => {
    // Load female animals for mother selection
    const { data: femaleData } = await supabase
      .from("animals")
      .select("id, name, ear_tag")
      .eq("farm_id", farmId)
      .eq("gender", "Female")
      .eq("is_deleted", false)
      .order("name");

    if (femaleData) setMothers(femaleData);

    // Load male animals for father selection
    const { data: maleData } = await supabase
      .from("animals")
      .select("id, name, ear_tag")
      .eq("farm_id", farmId)
      .eq("gender", "Male")
      .eq("is_deleted", false)
      .order("name");

    if (maleData) setFathers(maleData);
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

    setCreating(true);
    
    // Determine final breed value
    let finalBreed = formData.breed;
    if (formData.breed === "Mix Breed" && formData.breed1 && formData.breed2) {
      finalBreed = `${formData.breed1} x ${formData.breed2}`;
    }
    
    const { error } = await supabase.from("animals").insert({
      farm_id: farmId,
      name: formData.name || null,
      ear_tag: formData.ear_tag,
      breed: finalBreed || null,
      gender: formData.gender || null,
      birth_date: formData.birth_date || null,
      mother_id: formData.mother_id && formData.mother_id !== "none" ? formData.mother_id : null,
      father_id: formData.father_id && formData.father_id !== "none" ? formData.father_id : null
    });

    setCreating(false);
    if (error) {
      toast({
        title: "Error creating animal",
        description: error.message,
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
                {CATTLE_BREEDS.map((breed) => (
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
                    {CATTLE_BREEDS.filter(b => b !== "Mix Breed").map((breed) => (
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
                    {CATTLE_BREEDS.filter(b => b !== "Mix Breed").map((breed) => (
                      <SelectItem key={breed} value={breed}>
                        {breed}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
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
            <h3 className="text-sm font-semibold">Parent Information (Optional)</h3>
            
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
                value={formData.father_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, father_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select father" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {fathers.map((father) => (
                    <SelectItem key={father.id} value={father.id}>
                      {father.name || father.ear_tag || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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