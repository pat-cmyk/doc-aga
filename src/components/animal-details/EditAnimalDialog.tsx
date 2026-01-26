import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ChevronDown, RotateCcw, AlertTriangle } from "lucide-react";
import { BilingualLabel } from "@/components/ui/bilingual-label";
import { GenderSelector } from "@/components/animal-form/GenderSelector";
import { LactatingToggle } from "@/components/animal-form/LactatingToggle";
import { WeightHintBadge } from "@/components/ui/weight-hint-badge";
import { getBreedsByLivestockType, type LivestockType } from "@/lib/livestockBreeds";
import { getLivestockEmoji } from "@/lib/filipinoLabels";
import {
  useEditAnimalForm,
  type AnimalData,
} from "./hooks/useEditAnimalForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EditAnimalDialogProps {
  animalId: string;
  animal: AnimalData;
  farmId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditAnimalDialog({
  animalId,
  animal,
  farmId,
  open,
  onOpenChange,
  onSaved,
}: EditAnimalDialogProps) {
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [openSections, setOpenSections] = useState({
    basic: true,
    dates: false,
    parentage: false,
    weight: false,
    acquisition: false,
    lactation: false,
  });

  const {
    formData,
    setFormData,
    saving,
    hasChanges,
    mothers,
    fathers,
    loadingParents,
    handleSubmit,
    resetForm,
    isAnimalNewEntrant,
  } = useEditAnimalForm(animal, farmId, () => {
    onSaved();
    onOpenChange(false);
  });

  const availableBreeds = getBreedsByLivestockType(formData.livestock_type as LivestockType);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleClose = () => {
    if (hasChanges) {
      setShowUnsavedWarning(true);
    } else {
      onOpenChange(false);
    }
  };

  const confirmClose = () => {
    setShowUnsavedWarning(false);
    resetForm();
    onOpenChange(false);
  };

  const getParentDisplayName = (parent: { name: string | null; ear_tag: string | null }) => {
    if (parent.name && parent.ear_tag) {
      return `${parent.name} (${parent.ear_tag})`;
    }
    return parent.name || parent.ear_tag || "Unknown";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Edit Animal Details</DialogTitle>
            <DialogDescription>
              I-edit ang Detalye ng Hayop
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-180px)] px-6">
            <div className="space-y-4 py-4">
              {/* Basic Information Section */}
              <Collapsible open={openSections.basic} onOpenChange={() => toggleSection("basic")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <span className="font-medium">Basic Information / Pangunahing Impormasyon</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.basic ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {/* Name */}
                  <div className="space-y-2">
                    <BilingualLabel english="Name" filipino="Pangalan" htmlFor="edit-name" />
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Bessie"
                    />
                  </div>

                  {/* Ear Tag */}
                  <div className="space-y-2">
                    <BilingualLabel english="Ear Tag" filipino="Tatak sa Tainga" required htmlFor="edit-ear-tag" />
                    <Input
                      id="edit-ear-tag"
                      value={formData.ear_tag}
                      onChange={(e) => setFormData(prev => ({ ...prev, ear_tag: e.target.value }))}
                      placeholder="e.g., A001"
                      required
                    />
                  </div>

                  {/* Livestock Type */}
                  <div className="space-y-2">
                    <BilingualLabel english="Livestock Type" filipino="Uri ng Livestock" required />
                    <Select
                      value={formData.livestock_type}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        livestock_type: value,
                        breed: "",
                        breed1: "",
                        breed2: ""
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cattle">{getLivestockEmoji("cattle")} Cattle / Baka</SelectItem>
                        <SelectItem value="goat">{getLivestockEmoji("goat")} Goat / Kambing</SelectItem>
                        <SelectItem value="sheep">{getLivestockEmoji("sheep")} Sheep / Tupa</SelectItem>
                        <SelectItem value="carabao">{getLivestockEmoji("carabao")} Carabao / Kalabaw</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gender */}
                  <GenderSelector
                    value={formData.gender}
                    onChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      gender: value,
                      is_currently_lactating: value === "Female" ? prev.is_currently_lactating : false,
                    }))}
                  />

                  {/* Breed */}
                  <div className="space-y-2">
                    <BilingualLabel english="Breed" filipino="Lahi" htmlFor="edit-breed" />
                    <Select
                      value={formData.breed}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        breed: value, 
                        breed1: "", 
                        breed2: "" 
                      }))}
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

                  {/* Mix Breed selectors */}
                  {formData.breed === "Mix Breed" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <BilingualLabel english="First Breed" filipino="Unang Lahi" />
                        <Select
                          value={formData.breed1}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, breed1: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select first breed" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableBreeds.filter(b => b !== "Mix Breed").map((breed) => (
                              <SelectItem key={breed} value={breed}>{breed}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <BilingualLabel english="Second Breed" filipino="Ikalawang Lahi" />
                        <Select
                          value={formData.breed2}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, breed2: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select second breed" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableBreeds.filter(b => b !== "Mix Breed").map((breed) => (
                              <SelectItem key={breed} value={breed}>{breed}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Dates Section */}
              <Collapsible open={openSections.dates} onOpenChange={() => toggleSection("dates")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <span className="font-medium">Dates / Mga Petsa</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.dates ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {/* Birth Date */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <BilingualLabel english="Birth Date" filipino="Petsa ng Kapanganakan" htmlFor="edit-birth-date" />
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-birth-date-unknown"
                          checked={formData.birth_date_unknown}
                          onCheckedChange={(checked) => setFormData(prev => ({ 
                            ...prev, 
                            birth_date_unknown: checked === true,
                            birth_date: checked === true ? "" : prev.birth_date
                          }))}
                        />
                        <label htmlFor="edit-birth-date-unknown" className="text-sm text-muted-foreground cursor-pointer">
                          Unknown / Hindi Alam
                        </label>
                      </div>
                    </div>
                    <Input
                      id="edit-birth-date"
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                      disabled={formData.birth_date_unknown}
                      className={formData.birth_date_unknown ? "opacity-50" : ""}
                    />
                  </div>

                  {/* Farm Entry Date - Only for new entrants */}
                  {isAnimalNewEntrant && (
                    <div className="space-y-2">
                      <BilingualLabel english="Farm Entry Date" filipino="Petsa ng Pagpasok sa Farm" htmlFor="edit-farm-entry-date" />
                      <Input
                        id="edit-farm-entry-date"
                        type="date"
                        value={formData.farm_entry_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, farm_entry_date: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* Milking Start Date - Only for females */}
                  {formData.gender === "Female" && (
                    <div className="space-y-2">
                      <BilingualLabel english="Milking Start Date" filipino="Petsa ng Pagsimula ng Paggatas" htmlFor="edit-milking-start-date" />
                      <Input
                        id="edit-milking-start-date"
                        type="date"
                        value={formData.milking_start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, milking_start_date: e.target.value }))}
                      />
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Parentage Section */}
              <Collapsible open={openSections.parentage} onOpenChange={() => toggleSection("parentage")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <span className="font-medium">Parentage / Magulang</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.parentage ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {loadingParents ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Loading parents...</span>
                    </div>
                  ) : (
                    <>
                      {/* Mother */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <BilingualLabel english="Mother" filipino="Ina" htmlFor="edit-mother" />
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="edit-mother-unknown"
                              checked={formData.mother_unknown}
                              onCheckedChange={(checked) => setFormData(prev => ({ 
                                ...prev, 
                                mother_unknown: checked === true,
                                mother_id: checked === true ? "" : prev.mother_id
                              }))}
                            />
                            <label htmlFor="edit-mother-unknown" className="text-sm text-muted-foreground cursor-pointer">
                              Unknown / Hindi Alam
                            </label>
                          </div>
                        </div>
                        <Select
                          value={formData.mother_id || "none"}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, mother_id: value === "none" ? "" : value }))}
                          disabled={formData.mother_unknown}
                        >
                          <SelectTrigger className={formData.mother_unknown ? "opacity-50" : ""}>
                            <SelectValue placeholder="Select mother / Pumili ng ina" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None / Wala</SelectItem>
                            {mothers.map((mother) => (
                              <SelectItem key={mother.id} value={mother.id}>
                                {getParentDisplayName(mother)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Father */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <BilingualLabel english="Father" filipino="Ama" htmlFor="edit-father" />
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="edit-father-unknown"
                              checked={formData.father_unknown}
                              onCheckedChange={(checked) => setFormData(prev => ({ 
                                ...prev, 
                                father_unknown: checked === true,
                                father_id: checked === true ? "" : prev.father_id
                              }))}
                            />
                            <label htmlFor="edit-father-unknown" className="text-sm text-muted-foreground cursor-pointer">
                              Unknown / Hindi Alam
                            </label>
                          </div>
                        </div>
                        <Select
                          value={formData.father_id || "none"}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, father_id: value === "none" ? "" : value }))}
                          disabled={formData.father_unknown}
                        >
                          <SelectTrigger className={formData.father_unknown ? "opacity-50" : ""}>
                            <SelectValue placeholder="Select father / Pumili ng ama" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None / Wala</SelectItem>
                            {fathers.map((father) => (
                              <SelectItem key={father.id} value={father.id}>
                                {getParentDisplayName(father)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Weight Section */}
              <Collapsible open={openSections.weight} onOpenChange={() => toggleSection("weight")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <span className="font-medium">Weight / Timbang</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSections.weight ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {/* Entry Weight - Only for new entrants */}
                  {isAnimalNewEntrant && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <BilingualLabel english="Entry Weight (kg)" filipino="Timbang sa Pagpasok" htmlFor="edit-entry-weight" />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="edit-entry-weight-unknown"
                            checked={formData.entry_weight_unknown}
                            onCheckedChange={(checked) => setFormData(prev => ({ 
                              ...prev, 
                              entry_weight_unknown: checked === true,
                              entry_weight_kg: checked === true ? "" : prev.entry_weight_kg
                            }))}
                          />
                          <label htmlFor="edit-entry-weight-unknown" className="text-sm text-muted-foreground cursor-pointer">
                            No Data / Walang Data
                          </label>
                        </div>
                      </div>
                      <Input
                        id="edit-entry-weight"
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.entry_weight_kg}
                        onChange={(e) => setFormData(prev => ({ ...prev, entry_weight_kg: e.target.value }))}
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

                  {/* Birth Weight - Only for offspring */}
                  {!isAnimalNewEntrant && (
                    <div className="space-y-2">
                      <BilingualLabel english="Birth Weight (kg)" filipino="Timbang sa Kapanganakan" htmlFor="edit-birth-weight" />
                      <Input
                        id="edit-birth-weight"
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.birth_weight_kg}
                        onChange={(e) => setFormData(prev => ({ ...prev, birth_weight_kg: e.target.value }))}
                        placeholder="e.g., 35"
                      />
                      <WeightHintBadge
                        livestockType={formData.livestock_type}
                        weightType="birth"
                      />
                    </div>
                  )}

                  {/* Current Weight - Always shown */}
                  <div className="space-y-2">
                    <BilingualLabel english="Current Weight (kg)" filipino="Kasalukuyang Timbang" htmlFor="edit-current-weight" />
                    <Input
                      id="edit-current-weight"
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.current_weight_kg}
                      onChange={(e) => setFormData(prev => ({ ...prev, current_weight_kg: e.target.value }))}
                      placeholder="e.g., 450"
                    />
                    <WeightHintBadge
                      livestockType={formData.livestock_type}
                      gender={formData.gender}
                      weightType="current"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Acquisition Section - Only for new entrants */}
              {isAnimalNewEntrant && (
                <Collapsible open={openSections.acquisition} onOpenChange={() => toggleSection("acquisition")}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <span className="font-medium">Acquisition / Pagkuha</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openSections.acquisition ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                      <BilingualLabel english="How was this animal acquired?" filipino="Paano nakuha ang hayop?" />
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
                          <RadioGroupItem value="purchased" id="edit-acquired-purchased" />
                          <label htmlFor="edit-acquired-purchased" className="cursor-pointer">Purchased / Binili</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="grant" id="edit-acquired-grant" />
                          <label htmlFor="edit-acquired-grant" className="cursor-pointer">Grant / Bigay</label>
                        </div>
                      </RadioGroup>

                      {formData.acquisition_type === "purchased" && (
                        <div className="space-y-2">
                          <BilingualLabel english="Purchase Price (PHP)" filipino="Halaga ng Pagbili" htmlFor="edit-purchase-price" />
                          <Input
                            id="edit-purchase-price"
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
                            <BilingualLabel english="Grant Source" filipino="Pinagmulan ng Bigay" htmlFor="edit-grant-source" />
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
                                <SelectItem value="other">Other / Iba pa</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {formData.grant_source === "other" && (
                            <div className="space-y-2">
                              <BilingualLabel english="Specify Source" filipino="Tukuyin ang Pinagmulan" htmlFor="edit-grant-source-other" />
                              <Input
                                id="edit-grant-source-other"
                                value={formData.grant_source_other}
                                onChange={(e) => setFormData(prev => ({ ...prev, grant_source_other: e.target.value }))}
                                placeholder="Enter grant source"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Lactation Section - Only for females */}
              {formData.gender === "Female" && (
                <Collapsible open={openSections.lactation} onOpenChange={() => toggleSection("lactation")}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <span className="font-medium">Lactation Status / Kalagayan ng Paggatas</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openSections.lactation ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4">
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
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t">
            <div className="flex items-center justify-between w-full">
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                disabled={!hasChanges || saving}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={saving || !hasChanges}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Warning */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
