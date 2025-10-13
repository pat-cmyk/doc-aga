import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ActivityConfirmationProps {
  data: {
    activity_type: string;
    animal_id?: string;
    animal_identifier?: string;
    quantity?: number;
    notes?: string;
    feed_type?: string;
    medicine_name?: string;
    dosage?: string;
  };
  onCancel: () => void;
  onSuccess: () => void;
}

const ActivityConfirmation = ({ data, onCancel, onSuccess }: ActivityConfirmationProps) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'milking': return 'Milking';
      case 'feeding': return 'Feeding';
      case 'cleaning': return 'Cleaning';
      case 'health_observation': return 'Health Check';
      case 'weight_measurement': return 'Weight Measurement';
      case 'injection': return 'Injection/Medicine';
      default: return type;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'milking': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'feeding': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'cleaning': return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      case 'health_observation': return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'weight_measurement': return 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20';
      case 'injection': return 'bg-red-500/10 text-red-700 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      // Create record based on activity type
      switch (data.activity_type) {
        case 'milking':
          if (!data.animal_id) throw new Error('Animal not identified');
          await supabase.from('milking_records').insert({
            animal_id: data.animal_id,
            record_date: today,
            liters: data.quantity || 0,
            created_by: user.id
          });
          break;

        case 'feeding':
          if (!data.animal_id) throw new Error('Animal not identified');
          await supabase.from('feeding_records').insert({
            animal_id: data.animal_id,
            record_datetime: new Date().toISOString(),
            kilograms: data.quantity,
            feed_type: data.feed_type,
            notes: data.notes,
            created_by: user.id
          });
          break;

        case 'health_observation':
          if (!data.animal_id) throw new Error('Animal not identified');
          await supabase.from('health_records').insert({
            animal_id: data.animal_id,
            visit_date: today,
            diagnosis: 'Routine observation',
            notes: data.notes,
            created_by: user.id
          });
          break;

        case 'weight_measurement':
          if (!data.animal_id) throw new Error('Animal not identified');
          const weight = Number(data.quantity);
          if (!weight || weight <= 0) throw new Error('Weight must be a positive number');
          await supabase.from('weight_records').insert({
            animal_id: data.animal_id,
            measurement_date: today,
            weight_kg: weight,
            measurement_method: 'visual_estimate',
            notes: data.notes,
            recorded_by: user.id
          });
          break;

        case 'injection':
          if (!data.animal_id) throw new Error('Animal not identified');
          await supabase.from('injection_records').insert({
            animal_id: data.animal_id,
            record_datetime: new Date().toISOString(),
            medicine_name: data.medicine_name,
            dosage: data.dosage,
            instructions: data.notes,
            created_by: user.id
          });
          break;

        default:
          throw new Error('Unknown activity type');
      }

      toast({
        title: "Success",
        description: "Activity recorded successfully",
      });
      onSuccess();
    } catch (error) {
      console.error('Error saving record:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save record',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Confirm Activity
        </CardTitle>
        <CardDescription>Review the extracted information before saving</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Activity Type */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Activity Type</p>
          <Badge className={getActivityColor(data.activity_type)}>
            {getActivityLabel(data.activity_type)}
          </Badge>
        </div>

        {/* Animal */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Animal</p>
          <p className="text-lg font-semibold">
            {data.animal_identifier || 'Not identified'}
          </p>
          {!data.animal_id && (
            <p className="text-sm text-destructive mt-1">⚠️ Animal not found in database</p>
          )}
        </div>

        {/* Quantity */}
        {data.quantity && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {data.activity_type === 'milking' ? 'Liters' : 
               data.activity_type === 'feeding' ? 'Kilograms' :
               data.activity_type === 'weight_measurement' ? 'Weight (kg)' : 'Quantity'}
            </p>
            <p className="text-lg font-semibold">{data.quantity}</p>
          </div>
        )}

        {/* Feed Type */}
        {data.feed_type && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Feed Type</p>
            <p className="text-lg">{data.feed_type}</p>
          </div>
        )}

        {/* Medicine */}
        {data.medicine_name && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Medicine</p>
            <p className="text-lg">{data.medicine_name}</p>
            {data.dosage && <p className="text-sm text-muted-foreground">Dosage: {data.dosage}</p>}
          </div>
        )}

        {/* Notes */}
        {data.notes && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
            <p className="text-sm bg-muted/50 p-3 rounded-md">{data.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button 
            onClick={handleConfirm} 
            className="flex-1"
            disabled={isSaving || !data.animal_id}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Confirm & Save'}
          </Button>
          <Button 
            onClick={onCancel} 
            variant="outline"
            className="flex-1"
            disabled={isSaving}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>

        <Button 
          onClick={onCancel} 
          variant="ghost"
          className="w-full"
          disabled={isSaving}
        >
          <Mic className="h-4 w-4 mr-2" />
          Re-record
        </Button>
      </CardContent>
    </Card>
  );
};

export default ActivityConfirmation;
