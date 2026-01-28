import { useState, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, RefreshCw, Save, Users } from "lucide-react";
import { PendingActivity } from "@/hooks/usePendingActivities";
import { useFarmAnimals, getAnimalDropdownOptions, getSelectedAnimals } from "@/hooks/useFarmAnimals";
import { AnimalCombobox } from "@/components/milk-recording/AnimalCombobox";

interface EditSubmissionDialogProps {
  activity: PendingActivity | null;
  mode: 'edit' | 'resubmit';
  farmId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (activityData: any, animalIds: string[]) => void;
  isSaving: boolean;
}

export const EditSubmissionDialog = ({
  activity,
  mode,
  farmId,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: EditSubmissionDialogProps) => {
  const [formData, setFormData] = useState<any>({});
  const [selectedAnimalOption, setSelectedAnimalOption] = useState<string>('');
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);

  const { data: animals = [] } = useFarmAnimals(farmId);
  const animalOptions = getAnimalDropdownOptions(animals);

  // Reset form when activity changes
  useEffect(() => {
    if (activity) {
      setFormData(activity.activity_data || {});
      // Set initial animal selection based on current animal_ids
      if (activity.animal_ids.length === animals.length && animals.length > 0) {
        setSelectedAnimalOption('all');
      } else if (activity.animal_ids.length === 1) {
        setSelectedAnimalOption(activity.animal_ids[0]);
      } else {
        // Check if it's a species selection
        const selectedAnimals = animals.filter(a => activity.animal_ids.includes(a.id));
        const species = [...new Set(selectedAnimals.map(a => a.livestock_type))];
        if (species.length === 1) {
          const speciesAnimals = animals.filter(a => a.livestock_type === species[0]);
          if (speciesAnimals.length === selectedAnimals.length) {
            setSelectedAnimalOption(`species:${species[0]}`);
          } else {
            setSelectedAnimalOption(activity.animal_ids[0] || '');
          }
        } else {
          setSelectedAnimalOption(activity.animal_ids[0] || '');
        }
      }
      setSelectedAnimalIds(activity.animal_ids);
    }
  }, [activity, animals]);

  // Update selected animal IDs when option changes
  const handleAnimalSelectionChange = (optionValue: string) => {
    setSelectedAnimalOption(optionValue);
    const selected = getSelectedAnimals(animals, optionValue);
    setSelectedAnimalIds(selected.map(a => a.id));
  };

  if (!activity) return null;

  const handleSubmit = () => {
    onSave(formData, selectedAnimalIds);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const renderFields = () => {
    switch (activity.activity_type) {
      case 'milking':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Milk Quantity (liters)</Label>
              <Input
                id="quantity"
                type="number"
                step="0.1"
                min="0"
                value={formData.quantity || ''}
                onChange={(e) => updateField('quantity', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
        );

      case 'feeding':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feed_type">Feed Type</Label>
              <Input
                id="feed_type"
                value={formData.feed_type || ''}
                onChange={(e) => updateField('feed_type', e.target.value)}
                placeholder="e.g., Hay, Concentrate, Grass"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.quantity || ''}
                  onChange={(e) => updateField('quantity', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={formData.unit || 'kg'}
                  onChange={(e) => updateField('unit', e.target.value)}
                  placeholder="kg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
        );

      case 'health_observation':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Health Observation Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Describe the health observation..."
                className="min-h-[120px]"
              />
            </div>
          </div>
        );

      case 'weight_measurement':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Weight (kg)</Label>
              <Input
                id="quantity"
                type="number"
                step="0.1"
                min="0"
                value={formData.quantity || ''}
                onChange={(e) => updateField('quantity', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
        );

      case 'injection':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="medicine_name">Medicine Name</Label>
              <Input
                id="medicine_name"
                value={formData.medicine_name || ''}
                onChange={(e) => updateField('medicine_name', e.target.value)}
                placeholder="Name of the medicine/vaccine"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={formData.dosage || ''}
                onChange={(e) => updateField('dosage', e.target.value)}
                placeholder="e.g., 5ml, 2cc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Instructions/Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional instructions..."
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Activity details..."
                className="min-h-[120px]"
              />
            </div>
          </div>
        );
    }
  };

  const getActivityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      milking: 'Milking',
      feeding: 'Feeding',
      health_observation: 'Health Observation',
      weight_measurement: 'Weight Measurement',
      injection: 'Injection'
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit Submission' : 'Resubmit Activity'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit' 
              ? `Update your ${getActivityTypeLabel(activity.activity_type).toLowerCase()} submission before manager review.`
              : `Correct and resubmit your ${getActivityTypeLabel(activity.activity_type).toLowerCase()} activity.`
            }
          </DialogDescription>
        </DialogHeader>

        {mode === 'resubmit' && activity.rejection_reason && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Previous rejection:</strong> {activity.rejection_reason}
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="py-4 space-y-4 pr-4">
            {/* Animal selection */}
            <div className="space-y-2">
              <Label htmlFor="animals" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Animals ({selectedAnimalIds.length} selected)
              </Label>
              <AnimalCombobox
                options={animalOptions}
                value={selectedAnimalOption}
                onChange={handleAnimalSelectionChange}
                placeholder="Select animals..."
              />
              <p className="text-xs text-muted-foreground">
                Choose individual animals, all animals, or all of a specific species
              </p>
            </div>

            {renderFields()}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : mode === 'edit' ? (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resubmit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
