import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface AnimalSelectionStepProps {
  activityType: string;
  extractedData: any;
  farmId: string;
  detectedLivestockType?: string | null;
  onAnimalSelected: (selections: Array<{ livestock_type: string; selection: 'ALL' | string[] }>) => void;
  onCancel: () => void;
}

const AnimalSelectionStep = ({ 
  activityType, 
  extractedData, 
  farmId,
  detectedLivestockType, 
  onAnimalSelected, 
  onCancel 
}: AnimalSelectionStepProps) => {
  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedByType, setSelectedByType] = useState<Record<string, {
    selectAll: boolean;
    animalIds: string[];
  }>>({});
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
          .select('id, ear_tag, name, current_weight_kg, gender, milking_stage, livestock_type')
          .eq('farm_id', farmId)
          .eq('is_deleted', false);

        // For milking activities, filter to only actively milking animals
        if (isMilkingActivity) {
          query = query.in('milking_stage', ['Early Lactation', 'Mid-Lactation', 'Late Lactation']);
          
          // Further filter by detected livestock type if provided
          if (detectedLivestockType) {
            query = query.eq('livestock_type', detectedLivestockType);
          }
        }

        const { data } = await query.order('livestock_type').order('ear_tag');

        setAnimals(data || []);
      } catch (error) {
        console.error('Error fetching animals:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnimals();
  }, [farmId, isMilkingActivity, detectedLivestockType]);

  const getActivityLabel = () => {
    switch (activityType) {
      case 'weight_measurement':
        return `Weight: ${extractedData.quantity} ${extractedData.unit}`;
      case 'milking':
        const typeLabel = detectedLivestockType ? ` (${capitalize(detectedLivestockType)})` : '';
        return `Milking${typeLabel}: ${extractedData.quantity} liters`;
      case 'health_observation':
        return 'Health Observation';
      case 'injection':
        return `Injection: ${extractedData.medicine_name}`;
      default:
        return activityType;
    }
  };

  // Group animals by livestock_type
  const groupedAnimals = animals.reduce((acc, animal) => {
    const type = animal.livestock_type || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(animal);
    return acc;
  }, {} as Record<string, any[]>);

  const handleTypeSelectAll = (type: string, checked: boolean) => {
    setSelectedByType(prev => ({
      ...prev,
      [type]: {
        selectAll: checked,
        animalIds: checked ? groupedAnimals[type].map(a => a.id) : []
      }
    }));
  };

  const handleAnimalToggle = (type: string, animalId: string, checked: boolean) => {
    setSelectedByType(prev => {
      const current = prev[type] || { selectAll: false, animalIds: [] };
      const newIds = checked
        ? [...current.animalIds, animalId]
        : current.animalIds.filter(id => id !== animalId);
      
      return {
        ...prev,
        [type]: {
          selectAll: newIds.length === groupedAnimals[type].length,
          animalIds: newIds
        }
      };
    });
  };

  const handleConfirm = () => {
    const selections = Object.entries(selectedByType)
      .filter(([_, sel]) => sel.selectAll || sel.animalIds.length > 0)
      .map(([type, sel]) => ({
        livestock_type: type,
        selection: sel.selectAll ? 'ALL' as const : sel.animalIds
      }));
    
    onAnimalSelected(selections);
  };

  const totalSelected = Object.values(selectedByType).reduce(
    (sum, sel) => sum + sel.animalIds.length, 
    0
  );

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Select Animals</CardTitle>
          <CardDescription>
            {isMilkingActivity 
              ? 'Select which animals to distribute the milk production for'
              : 'Which animal is this activity for?'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium">{getActivityLabel()}</p>
            {extractedData.notes && (
              <p className="text-xs text-muted-foreground mt-1">{extractedData.notes}</p>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : animals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isMilkingActivity 
                ? detectedLivestockType
                  ? `No milking ${detectedLivestockType}s found. Animals must be in lactation stage.`
                  : 'No milking animals found. Animals must be in lactation stage.'
                : 'No animals found. Please add animals first.'}
            </p>
          ) : detectedLivestockType && isMilkingActivity ? (
            // Single type view (voice detected specific type)
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-md border border-primary/20">
                <span className="font-medium">{capitalize(detectedLivestockType)}s</span>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`select-all-${detectedLivestockType}`}
                    checked={selectedByType[detectedLivestockType]?.selectAll || false}
                    onCheckedChange={(checked) => handleTypeSelectAll(detectedLivestockType, !!checked)}
                  />
                  <label
                    htmlFor={`select-all-${detectedLivestockType}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    All {detectedLivestockType}s ({animals.length})
                  </label>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {animals.map((animal) => (
                  <div
                    key={animal.id}
                    className={`flex items-start space-x-3 p-3 rounded-md border transition-colors ${
                      selectedByType[detectedLivestockType]?.animalIds.includes(animal.id)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-card border-border hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      id={animal.id}
                      checked={selectedByType[detectedLivestockType]?.animalIds.includes(animal.id) || false}
                      onCheckedChange={(checked) => handleAnimalToggle(detectedLivestockType, animal.id, !!checked)}
                      className="mt-1"
                    />
                    <label htmlFor={animal.id} className="flex-1 cursor-pointer">
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
            </div>
          ) : (
            // Grouped view (no type detected - show all types)
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(groupedAnimals).map(([type, typeAnimals]: [string, any[]], idx) => (
                <div key={type}>
                  {idx > 0 && <Separator className="my-4" />}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-md border border-primary/20">
                      <span className="font-medium">{capitalize(type)}s</span>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`select-all-${type}`}
                          checked={selectedByType[type]?.selectAll || false}
                          onCheckedChange={(checked) => handleTypeSelectAll(type, !!checked)}
                        />
                        <label
                          htmlFor={`select-all-${type}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          All {type}s ({typeAnimals.length})
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2 pl-2">
                      {typeAnimals.map((animal) => (
                        <div
                          key={animal.id}
                          className={`flex items-start space-x-3 p-3 rounded-md border transition-colors ${
                            selectedByType[type]?.animalIds.includes(animal.id)
                              ? 'bg-primary/10 border-primary'
                              : 'bg-card border-border hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            id={animal.id}
                            checked={selectedByType[type]?.animalIds.includes(animal.id) || false}
                            onCheckedChange={(checked) => handleAnimalToggle(type, animal.id, !!checked)}
                            className="mt-1"
                          />
                          <label htmlFor={animal.id} className="flex-1 cursor-pointer">
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
                  </div>
                </div>
              ))}
            </div>
          )}

          {isMilkingActivity && totalSelected > 0 && (
            <div className="bg-primary/5 p-3 rounded-md">
              <p className="text-sm text-center font-medium">
                {totalSelected} of {animals.length} animals selected
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Milk will be distributed proportionally based on weight
              </p>
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
              disabled={!isMilkingActivity ? false : totalSelected === 0}
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
