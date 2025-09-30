import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, Milk, Syringe, Stethoscope, Calendar, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MilkingRecords from "./MilkingRecords";
import HealthRecords from "./HealthRecords";
import AIRecords from "./AIRecords";

interface Animal {
  id: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  birth_date: string | null;
  milking_start_date: string | null;
  avatar_url: string | null;
}

interface AnimalDetailsProps {
  animalId: string;
  onBack: () => void;
}

const AnimalDetails = ({ animalId, onBack }: AnimalDetailsProps) => {
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAnimal();
  }, [animalId]);

  const loadAnimal = async () => {
    const { data, error } = await supabase
      .from("animals")
      .select("*")
      .eq("id", animalId)
      .single();

    if (error) {
      toast({
        title: "Error loading animal",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setAnimal(data);
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${animalId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('animal-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('animal-photos')
        .getPublicUrl(filePath);

      // Update animal record
      const { error: updateError } = await supabase
        .from('animals')
        .update({ avatar_url: publicUrl })
        .eq('id', animalId);

      if (updateError) throw updateError;

      toast({
        title: "Success!",
        description: "Avatar updated successfully"
      });

      loadAnimal();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!animal) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Animal not found</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={animal.avatar_url || undefined} alt={animal.name || "Animal"} />
                <AvatarFallback>{animal.name?.[0] || animal.ear_tag?.[0] || "A"}</AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">{animal.name}</CardTitle>
              <CardDescription>
                {animal.breed} • Tag: {animal.ear_tag}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Birth Date</p>
              <p className="font-medium">
                {animal.birth_date ? new Date(animal.birth_date).toLocaleDateString() : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Milking Start</p>
              <p className="font-medium">
                {animal.milking_start_date ? new Date(animal.milking_start_date).toLocaleDateString() : "Not yet"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="milking" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="milking">
            <Milk className="h-4 w-4 mr-2" />
            Milking
          </TabsTrigger>
          <TabsTrigger value="health">
            <Stethoscope className="h-4 w-4 mr-2" />
            Health
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Calendar className="h-4 w-4 mr-2" />
            AI/Breeding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="milking">
          <MilkingRecords animalId={animalId} />
        </TabsContent>

        <TabsContent value="health">
          <HealthRecords animalId={animalId} />
        </TabsContent>

        <TabsContent value="ai">
          <AIRecords animalId={animalId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnimalDetails;