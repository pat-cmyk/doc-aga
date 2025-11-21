import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface AnimalSelectionStepProps {
  activityType: string;
  extractedData: any;
  farmId: string;
  onAnimalSelected: (animalId: string | string[]) => void;
  onCancel: () => void;
}

const AnimalSelectionStep = ({ 
  activityType, 
  extractedData, 
  farmId, 
  onAnimalSelected, 
  onCancel 
}: AnimalSelectionStepProps) => {
  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const isMilkingActivity = activityType === 'milking';

  useEffect(() => {
    const fetchAnimals = async () => {
      setIsLoading(true);
      try {
        const { data: memberships } = await supabase
          .from('farm_memberships')
          .select('farm_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

        if (!memberships || memberships.length === 0) return;

        let query = supabase
          .from('animals')
          .select('id, ear_tag, name, current_weight_kg, gender, milking_stage')
          .eq('farm_id', farmId)
          .eq('is_deleted', false);

        // For milking activities, filter to only actively milking animals
        if (isMilkingActivity) {
          query = query.in('milking_stage', ['Early Lactation', 'Mid-Lactation', 'Late Lactation']);
        }

        const { data } = await query.order('ear_tag');

        setAnimals(data || []);
      } catch (error) {
        console.error('Error fetching animals:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnimals();
  }, [farmId, isMilkingActivity]);

  const getActivityLabel = () => {
    switch (activityType) {
      case 'weight_measurement':
        return `Weight: ${extractedData.quantity} ${extractedData.unit}`;
      case 'milking':
        return `Milking: ${extractedData.quantity} liters`;
      case 'health_observation':
        return 'Health Observation';
      case 'injection':
        return `Injection: ${extractedData.medicine_name}`;
      default:
        return activityType;
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedAnimalIds(animals.map(a => a.id));
    } else {
      setSelectedAnimalIds([]);
    }
  };

  const handleAnimalToggle = (animalId: string, checked: boolean) => {
    if (checked) {
      const newSelected = [...selectedAnimalIds, animalId];
      setSelectedAnimalIds(newSelected);
      setSelectAll(newSelected.length === animals.length);
    } else {
      const newSelected = selectedAnimalIds.filter(id => id !== animalId);
      setSelectedAnimalIds(newSelected);
      setSelectAll(false);
    }
  };

  const handleConfirm = () => {
    if (selectAll) {
      onAnimalSelected('ALL');
    } else if (selectedAnimalIds.length > 0) {
      onAnimalSelected(selectedAnimalIds);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Select Animal</CardTitle>
          <CardDescription>
            Which animal is this activity for?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium">{getActivityLabel()}</p>
            {extractedData.notes && (
              <p className="text-xs text-muted-foreground mt-1">{extractedData.notes}</p>
            )}
            {isMilkingActivity && extractedData.quantity && (
              <p className="text-xs text-primary font-medium mt-2">
                {extractedData.quantity} liters will be distributed
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : animals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isMilkingActivity 
                ? 'No milking animals found. Animals must be in lactation stage.'
                : 'No animals found. Please add animals first.'}
            </p>
          ) : (
            <div className="space-y-3">
              {isMilkingActivity && (
                <div className="flex items-center space-x-2 p-3 bg-primary/5 rounded-md border border-primary/20">
                  <Checkbox
                    id="select-all"
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                  <label
                    htmlFor="select-all"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Select All ({animals.length} milking animals)
                  </label>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-2">
                {animals.map((animal) => (
                  <div
                    key={animal.id}
                    className={`flex items-start space-x-3 p-3 rounded-md border transition-colors ${
                      selectedAnimalIds.includes(animal.id)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-card border-border hover:bg-muted/50'
                    }`}
                  >
                    {isMilkingActivity && (
                      <Checkbox
                        id={animal.id}
                        checked={selectedAnimalIds.includes(animal.id)}
                        onCheckedChange={(checked) => handleAnimalToggle(animal.id, checked as boolean)}
                        className="mt-1"
                      />
                    )}
                    <label
                      htmlFor={animal.id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{animal.ear_tag}</span>
                          {animal.name && (
                            <span className="text-muted-foreground ml-2">- {animal.name}</span>
                          )}
                        </div>
                        {animal.milking_stage && (
                          <Badge variant="secondary" className="text-xs">
                            {animal.milking_stage}
                          </Badge>
                        )}
                      </div>
                      {animal.current_weight_kg && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Weight: {animal.current_weight_kg} kg
                        </p>
                      )}
                    </label>
                  </div>
                ))}
              </div>

              {isMilkingActivity && selectedAnimalIds.length > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {selectAll ? 'All' : selectedAnimalIds.length} of {animals.length} animals selected
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!isMilkingActivity ? false : selectedAnimalIds.length === 0}
              className="flex-1"
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnimalSelectionStep;
