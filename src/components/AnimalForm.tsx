import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AnimalFormProps {
  farmId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const AnimalForm = ({ farmId, onSuccess, onCancel }: AnimalFormProps) => {
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    ear_tag: "",
    breed: "",
    birth_date: ""
  });

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
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("animals").insert({
      farm_id: farmId,
      name: formData.name || null,
      ear_tag: formData.ear_tag,
      breed: formData.breed || null,
      birth_date: formData.birth_date || null,
      created_by: user?.id
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle>Add New Animal</CardTitle>
            <CardDescription>Create a digital baby book for your animal</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
            <Label htmlFor="breed">Breed</Label>
            <Input
              id="breed"
              value={formData.breed}
              onChange={(e) => setFormData(prev => ({ ...prev, breed: e.target.value }))}
              placeholder="Holstein"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birth_date">Birth Date</Label>
            <Input
              id="birth_date"
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
            />
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
      </CardContent>
    </Card>
  );
};

export default AnimalForm;