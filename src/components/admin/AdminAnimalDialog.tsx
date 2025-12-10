import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { LIVESTOCK_BREEDS } from "@/lib/livestockBreeds";

interface AnimalData {
  id?: string;
  name: string | null;
  ear_tag: string | null;
  breed: string | null;
  gender: string | null;
  birth_date: string | null;
  life_stage: string | null;
  current_weight_kg: number | null;
  livestock_type?: string;
}

interface AdminAnimalDialogProps {
  farmId: string;
  farmName: string;
  animal?: AnimalData | null; // null = add mode, defined = edit mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AdminAnimalDialog = ({
  farmId,
  farmName,
  animal,
  open,
  onOpenChange,
}: AdminAnimalDialogProps) => {
  const queryClient = useQueryClient();
  const isEditMode = !!animal?.id;

  const [formData, setFormData] = useState<AnimalData>({
    name: "",
    ear_tag: "",
    breed: "",
    gender: "",
    birth_date: "",
    life_stage: "",
    current_weight_kg: null,
  });
  const [reason, setReason] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  // Get farm's livestock type
  const { data: farm } = useQuery({
    queryKey: ["admin-farm-detail", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("farms")
        .select("livestock_type")
        .eq("id", farmId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (animal) {
      setFormData({
        name: animal.name || "",
        ear_tag: animal.ear_tag || "",
        breed: animal.breed || "",
        gender: animal.gender || "",
        birth_date: animal.birth_date || "",
        life_stage: animal.life_stage || "",
        current_weight_kg: animal.current_weight_kg,
        livestock_type: animal.livestock_type,
      });
    } else {
      setFormData({
        name: "",
        ear_tag: "",
        breed: "",
        gender: "",
        birth_date: "",
        life_stage: "",
        current_weight_kg: null,
      });
    }
    setReason("");
    setTicketNumber("");
  }, [animal, open]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const animalData: Record<string, unknown> = {
        name: formData.name || null,
        ear_tag: formData.ear_tag || null,
        breed: formData.breed || null,
        gender: formData.gender || null,
        birth_date: formData.birth_date || null,
        life_stage: formData.life_stage || null,
        current_weight_kg: formData.current_weight_kg,
      };

      const { data, error } = await supabase.rpc("admin_add_animal", {
        _farm_id: farmId,
        _animal_data: animalData as Json,
        _reason: reason,
        _ticket_number: ticketNumber || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-farms"] });
      queryClient.invalidateQueries({ queryKey: ["admin-farm-animals"] });
      toast({
        title: "Animal Added",
        description: "Animal has been added on behalf of the farmer. Changes logged to audit trail.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!animal?.id) throw new Error("No animal selected");

      // Build changes object
      const changes: Record<string, unknown> = {};
      Object.keys(formData).forEach((key) => {
        const animalKey = key as keyof AnimalData;
        if (formData[animalKey] !== animal[animalKey]) {
          changes[key] = formData[animalKey];
        }
      });

      if (Object.keys(changes).length === 0) {
        throw new Error("No changes made");
      }

      const { data, error } = await supabase.rpc("admin_edit_animal", {
        _animal_id: animal.id,
        _changes: changes as Json,
        _reason: reason,
        _ticket_number: ticketNumber || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-farms"] });
      queryClient.invalidateQueries({ queryKey: ["admin-farm-animals"] });
      toast({
        title: "Animal Updated",
        description: "Animal details have been updated. Changes logged to audit trail.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const livestockType = formData.livestock_type || farm?.livestock_type || "cattle";
  const availableBreeds = LIVESTOCK_BREEDS[livestockType as keyof typeof LIVESTOCK_BREEDS] || [];

  const handleSubmit = () => {
    if (isEditMode) {
      editMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  const isPending = addMutation.isPending || editMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Animal" : "Add Animal for Client"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? `Editing animal on farm "${farmName}"`
              : `Adding animal to farm "${farmName}" on behalf of the farmer`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Bessie"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ear_tag">Ear Tag</Label>
              <Input
                id="ear_tag"
                value={formData.ear_tag || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, ear_tag: e.target.value }))}
                placeholder="e.g., TAG-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="breed">Breed</Label>
              <Select
                value={formData.breed || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, breed: value }))}
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birth_date">Birth Date</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, birth_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="life_stage">Life Stage</Label>
              <Select
                value={formData.life_stage || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, life_stage: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calf">Calf</SelectItem>
                  <SelectItem value="heifer">Heifer</SelectItem>
                  <SelectItem value="cow">Cow</SelectItem>
                  <SelectItem value="bull">Bull</SelectItem>
                  <SelectItem value="steer">Steer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="current_weight_kg">Current Weight (kg)</Label>
            <Input
              id="current_weight_kg"
              type="number"
              step="0.1"
              value={formData.current_weight_kg || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  current_weight_kg: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
              placeholder="e.g., 450"
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Action <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Customer requested to add new animal purchase, correcting ear tag typo..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket_number">Support Ticket Number (Optional)</Label>
              <Input
                id="ticket_number"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="e.g., TICKET-2024-001"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!reason.trim() || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditMode ? "Save Changes" : "Add Animal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
