import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Loader2 } from "lucide-react";

interface EditAcquisitionWeightDialogProps {
  animalId: string;
  isNewEntrant: boolean; // has farm_entry_date
  currentValues: {
    entry_weight_kg: number | null;
    entry_weight_unknown: boolean | null;
    birth_weight_kg: number | null;
    acquisition_type: string | null;
    purchase_price: number | null;
    grant_source: string | null;
    grant_source_other: string | null;
  };
  isOnline: boolean;
  onSaved: () => void;
}

export function EditAcquisitionWeightDialog({
  animalId,
  isNewEntrant,
  currentValues,
  isOnline,
  onSaved,
}: EditAcquisitionWeightDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [entryWeightKg, setEntryWeightKg] = useState<string>(
    currentValues.entry_weight_kg?.toString() || ""
  );
  const [entryWeightUnknown, setEntryWeightUnknown] = useState(
    currentValues.entry_weight_unknown || false
  );
  const [birthWeightKg, setBirthWeightKg] = useState<string>(
    currentValues.birth_weight_kg?.toString() || ""
  );
  const [acquisitionType, setAcquisitionType] = useState<string>(
    currentValues.acquisition_type || "purchased"
  );
  const [purchasePrice, setPurchasePrice] = useState<string>(
    currentValues.purchase_price?.toString() || ""
  );
  const [grantSource, setGrantSource] = useState<string>(
    currentValues.grant_source || ""
  );
  const [grantSourceOther, setGrantSourceOther] = useState<string>(
    currentValues.grant_source_other || ""
  );

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setEntryWeightKg(currentValues.entry_weight_kg?.toString() || "");
      setEntryWeightUnknown(currentValues.entry_weight_unknown || false);
      setBirthWeightKg(currentValues.birth_weight_kg?.toString() || "");
      setAcquisitionType(currentValues.acquisition_type || "purchased");
      setPurchasePrice(currentValues.purchase_price?.toString() || "");
      setGrantSource(currentValues.grant_source || "");
      setGrantSourceOther(currentValues.grant_source_other || "");
    }
    setOpen(newOpen);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Build update object
      const updates: Record<string, unknown> = {};

      if (isNewEntrant) {
        // Entry weight
        updates.entry_weight_unknown = entryWeightUnknown;
        updates.entry_weight_kg = entryWeightUnknown
          ? null
          : entryWeightKg
          ? parseFloat(entryWeightKg)
          : null;

        // Acquisition details
        updates.acquisition_type = acquisitionType;

        if (acquisitionType === "purchased") {
          updates.purchase_price = purchasePrice
            ? parseFloat(purchasePrice)
            : null;
          updates.grant_source = null;
          updates.grant_source_other = null;
        } else {
          updates.purchase_price = null;
          updates.grant_source = grantSource || null;
          updates.grant_source_other =
            grantSource === "other" ? grantSourceOther : null;
        }
      } else {
        // Birth weight for offspring
        updates.birth_weight_kg = birthWeightKg
          ? parseFloat(birthWeightKg)
          : null;
      }

      // Update the animals table
      const { error: animalError } = await supabase
        .from("animals")
        .update(updates)
        .eq("id", animalId);

      if (animalError) throw animalError;

      // Update weight_records if weight value changed
      if (isNewEntrant && !entryWeightUnknown && entryWeightKg) {
        const weightValue = parseFloat(entryWeightKg);
        
        // Check if entry weight record exists
        const { data: existingRecord } = await supabase
          .from("weight_records")
          .select("id")
          .eq("animal_id", animalId)
          .eq("measurement_method", "entry_weight")
          .maybeSingle();

        if (existingRecord) {
          await supabase
            .from("weight_records")
            .update({ weight_kg: weightValue })
            .eq("id", existingRecord.id);
        }
      } else if (!isNewEntrant && birthWeightKg) {
        const weightValue = parseFloat(birthWeightKg);
        
        // Check if birth weight record exists
        const { data: existingRecord } = await supabase
          .from("weight_records")
          .select("id")
          .eq("animal_id", animalId)
          .eq("measurement_method", "birth_weight")
          .maybeSingle();

        if (existingRecord) {
          await supabase
            .from("weight_records")
            .update({ weight_kg: weightValue })
            .eq("id", existingRecord.id);
        }
      }

      toast({
        title: "Saved",
        description: "Details updated successfully",
      });

      setOpen(false);
      onSaved();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save changes";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          disabled={!isOnline}
          title={!isOnline ? "Available when online" : "Edit details"}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Details</DialogTitle>
          <DialogDescription>
            {isNewEntrant
              ? "Update entry weight and acquisition information"
              : "Update birth weight"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isNewEntrant ? (
            <>
              {/* Entry Weight Section */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Entry Weight</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Weight in kg"
                      value={entryWeightKg}
                      onChange={(e) => setEntryWeightKg(e.target.value)}
                      disabled={entryWeightUnknown}
                      className="flex-1"
                      min="0"
                      step="0.1"
                    />
                    <span className="text-muted-foreground">kg</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="entry-weight-unknown"
                      checked={entryWeightUnknown}
                      onCheckedChange={(checked) =>
                        setEntryWeightUnknown(checked === true)
                      }
                    />
                    <Label
                      htmlFor="entry-weight-unknown"
                      className="text-sm font-normal cursor-pointer"
                    >
                      No data / Unknown
                    </Label>
                  </div>
                </div>
              </div>

              {/* Acquisition Section */}
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  How was this animal acquired?
                </Label>
                <RadioGroup
                  value={acquisitionType}
                  onValueChange={setAcquisitionType}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="purchased" id="purchased" />
                    <Label htmlFor="purchased" className="font-normal cursor-pointer">
                      Purchased
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="grant" id="grant" />
                    <Label htmlFor="grant" className="font-normal cursor-pointer">
                      Grant / Donation
                    </Label>
                  </div>
                </RadioGroup>

                {acquisitionType === "purchased" && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="purchase-price">Purchase Price (PHP)</Label>
                    <Input
                      id="purchase-price"
                      type="number"
                      placeholder="e.g., 50000"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      min="0"
                    />
                  </div>
                )}

                {acquisitionType === "grant" && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-2">
                      <Label>Grant Source</Label>
                      <Select value={grantSource} onValueChange={setGrantSource}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="national_dairy_authority">
                            National Dairy Authority (NDA)
                          </SelectItem>
                          <SelectItem value="local_government_unit">
                            Local Government Unit (LGU)
                          </SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {grantSource === "other" && (
                      <div className="space-y-2">
                        <Label htmlFor="grant-source-other">Specify Source</Label>
                        <Input
                          id="grant-source-other"
                          placeholder="Enter grant source"
                          value={grantSourceOther}
                          onChange={(e) => setGrantSourceOther(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Birth Weight for Offspring */
            <div className="space-y-3">
              <Label className="text-base font-medium">Birth Weight</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Weight in kg"
                  value={birthWeightKg}
                  onChange={(e) => setBirthWeightKg(e.target.value)}
                  className="flex-1"
                  min="0"
                  step="0.1"
                />
                <span className="text-muted-foreground">kg</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
