import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search } from 'lucide-react';

interface AnimalSelectionStepProps {
  activityType: string;
  extractedData: any;
  farmId: string;
  onAnimalSelected: (animalId: string) => void;
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
  const [selectedAnimalId, setSelectedAnimalId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnimals = async () => {
      setIsLoading(true);
      try {
        const { data: memberships } = await supabase
          .from('farm_memberships')
          .select('farm_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

        if (!memberships || memberships.length === 0) return;

        const { data } = await supabase
          .from('animals')
          .select('id, ear_tag, name, current_weight_kg, gender')
          .eq('farm_id', farmId)
          .eq('is_deleted', false)
          .order('ear_tag');

        setAnimals(data || []);
      } catch (error) {
        console.error('Error fetching animals:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnimals();
  }, [farmId]);

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

  const handleConfirm = () => {
    if (selectedAnimalId) {
      onAnimalSelected(selectedAnimalId);
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
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Select value={selectedAnimalId} onValueChange={setSelectedAnimalId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an animal...">
                  {selectedAnimalId && (
                    <span>
                      {animals.find(a => a.id === selectedAnimalId)?.ear_tag} 
                      {animals.find(a => a.id === selectedAnimalId)?.name && 
                        ` - ${animals.find(a => a.id === selectedAnimalId)?.name}`}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {animals.map((animal) => (
                  <SelectItem key={animal.id} value={animal.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{animal.ear_tag}</span>
                      {animal.name && (
                        <span className="text-muted-foreground">- {animal.name}</span>
                      )}
                      {animal.current_weight_kg && (
                        <span className="text-xs text-muted-foreground">
                          ({animal.current_weight_kg} kg)
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {animals.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No animals found. Please add animals first.
            </p>
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
              disabled={!selectedAnimalId}
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
