import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BulkFeedingTable } from './activity-confirmation/BulkFeedingTable';
import { ActivitySummary } from './activity-confirmation/ActivitySummary';
import { useInventoryDeduction } from './activity-confirmation/hooks/useInventoryDeduction';

interface Feed {
  feed_type: string;
  quantity: number;
  unit: string;
  total_kg: number;
  weight_per_unit: number;
  notes?: string;
  distributions: Array<{
    animal_id: string;
    animal_name: string;
    ear_tag: string;
    weight_kg: number;
    proportion: number;
    feed_amount: number;
  }>;
}

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
    is_bulk_feeding?: boolean;
    is_bulk_milking?: boolean;
    multiple_feeds?: boolean;
    total_animals?: number;
    total_types?: number;
    total_weight_kg?: number;
    total_kg?: number;
    original_quantity?: number;
    original_unit?: string;
    weight_per_unit?: number | null;
    feeds?: Feed[];
    distributions?: Array<{
      animal_id: string;
      animal_name: string;
      ear_tag: string;
      weight_kg: number;
      milking_stage?: string;
      proportion: number;
      feed_amount?: number;
      milk_liters?: number;
    }>;
    distributions_by_type?: Array<{
      livestock_type: string;
      animals: number;
      distributions: Array<{
        animal_id: string;
        animal_name: string;
        ear_tag: string;
        livestock_type: string;
        weight_kg: number;
        milking_stage?: string;
        proportion: number;
        milk_liters: number;
      }>;
    }>;
  };
  onCancel: () => void;
  onSuccess: () => void;
}

const ActivityConfirmation = ({ data, onCancel, onSuccess }: ActivityConfirmationProps) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [editableFeeds, setEditableFeeds] = useState(data.feeds || []);
  const [availableInventory, setAvailableInventory] = useState<Array<{id: string, feed_type: string, unit: string, weight_per_unit: number | null}>>([]);
  const { deductFromInventory } = useInventoryDeduction();

  // Fetch available inventory items
  useEffect(() => {
    const fetchInventory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('farm_memberships')
        .select('farm_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) return;

      const { data: inventory } = await supabase
        .from('feed_inventory')
        .select('id, feed_type, unit, weight_per_unit')
        .eq('farm_id', membership.farm_id)
        .gt('quantity_kg', 0)
        .order('feed_type');

      if (inventory) {
        setAvailableInventory(inventory);
      }
    };

    fetchInventory();
  }, []);

  // Initialize editable feeds from data
  useEffect(() => {
    if (data.feeds) {
      setEditableFeeds(data.feeds);
    }
  }, [data.feeds]);

  // Recompute distribution when feed type or quantity changes
  const handleFeedChange = (index: number, field: 'feed_type' | 'quantity' | 'unit', value: string | number) => {
    const newFeeds = [...editableFeeds];
    const feed = newFeeds[index];

    if (field === 'feed_type') {
      const inventoryItem = availableInventory.find(item => item.feed_type === value);
      feed.feed_type = value as string;
      if (inventoryItem?.weight_per_unit) {
        feed.weight_per_unit = inventoryItem.weight_per_unit;
        feed.total_kg = feed.quantity * inventoryItem.weight_per_unit;
      }
    } else if (field === 'quantity') {
      feed.quantity = value as number;
      feed.total_kg = feed.quantity * (feed.weight_per_unit || 1);
    } else if (field === 'unit') {
      feed.unit = value as string;
    }

    // Recompute distributions based on new total_kg
    const totalWeight = data.total_weight_kg || feed.distributions.reduce((sum, d) => sum + d.weight_kg, 0);
    feed.distributions = feed.distributions.map(dist => ({
      ...dist,
      proportion: dist.weight_kg / totalWeight,
      feed_amount: (dist.weight_kg / totalWeight) * feed.total_kg
    }));

    setEditableFeeds(newFeeds);
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      switch (data.activity_type) {
        case 'milking':
          if (data.distributions_by_type) {
            // Bulk milking with type grouping
            const allRecords = data.distributions_by_type.flatMap(typeGroup =>
              typeGroup.distributions.map(dist => ({
                animal_id: dist.animal_id,
                record_date: today,
                liters: dist.milk_liters,
                created_by: user.id
              }))
            );
            
            const { error: bulkError } = await supabase
              .from('milking_records')
              .insert(allRecords);
            
            if (bulkError) throw bulkError;
            
            // Show type-specific summary
            const summary = data.distributions_by_type
              .map(tg => `${tg.animals} ${tg.livestock_type}${tg.animals > 1 ? 's' : ''}`)
              .join(', ');
            
            toast({
              title: "Bulk Milking Recorded",
              description: `${data.quantity} liters recorded for ${summary}`,
            });
          } else if (data.is_bulk_milking && data.distributions) {
            // Legacy bulk milking (without type grouping)
            const milkingRecords = data.distributions.map(dist => ({
              animal_id: dist.animal_id,
              record_date: today,
              liters: dist.milk_liters || 0,
              created_by: user.id
            }));
            
            const { error: bulkError } = await supabase
              .from('milking_records')
              .insert(milkingRecords);
            
            if (bulkError) throw bulkError;
            
            toast({
              title: "Bulk Milking Recorded",
              description: `${data.quantity} liters recorded for ${data.total_animals} animals`,
            });
          } else {
            // Single animal milking
            if (!data.animal_id) throw new Error('Please select an animal for this activity');
            await supabase.from('milking_records').insert({
              animal_id: data.animal_id,
              record_date: today,
              liters: data.quantity || 0,
              created_by: user.id
            });
          }
          break;

        case 'feeding':
          const feedsToProcess = editableFeeds.length > 0 ? editableFeeds : data.feeds;
          if (data.multiple_feeds && feedsToProcess) {
            for (const feed of feedsToProcess) {
              const feedingRecords = feed.distributions.map(dist => ({
                animal_id: dist.animal_id,
                record_datetime: new Date().toISOString(),
                kilograms: dist.feed_amount,
                feed_type: feed.feed_type,
                notes: `${feed.notes || ''} [Bulk: ${feed.quantity} ${feed.unit} = ${feed.total_kg.toFixed(2)}kg]`.trim(),
                created_by: user.id
              }));
              
              const { error: bulkError } = await supabase
                .from('feeding_records')
                .insert(feedingRecords);
              
              if (bulkError) throw bulkError;
              
              await deductFromInventory(feed.feed_type, feed.total_kg, feed.quantity, feed.unit);
            }
            
            toast({
              title: "Success",
              description: `${data.feeds?.length} feed types recorded for ${data.total_animals} animals`,
            });
          } else if (data.is_bulk_feeding && data.distributions) {
            const feedingRecords = data.distributions.map(dist => ({
              animal_id: dist.animal_id,
              record_datetime: new Date().toISOString(),
              kilograms: dist.feed_amount,
              feed_type: data.feed_type,
              notes: `${data.notes || ''} [Bulk: ${data.original_quantity} ${data.original_unit} = ${data.total_kg?.toFixed(2)}kg distributed]`.trim(),
              created_by: user.id
            }));
            
            const { error: bulkError } = await supabase
              .from('feeding_records')
              .insert(feedingRecords);
            
            if (bulkError) throw bulkError;

            if (data.feed_type && data.total_kg && data.original_quantity && data.original_unit) {
              await deductFromInventory(data.feed_type, data.total_kg, data.original_quantity, data.original_unit);
            }
          } else {
            if (!data.animal_id) throw new Error('Please select an animal for this activity');
            await supabase.from('feeding_records').insert({
              animal_id: data.animal_id,
              record_datetime: new Date().toISOString(),
              kilograms: data.quantity,
              feed_type: data.feed_type,
              notes: data.notes,
              created_by: user.id
            });
          }
          break;

        case 'health_observation':
          if (!data.animal_id) throw new Error('Please select an animal for this activity');
          await supabase.from('health_records').insert({
            animal_id: data.animal_id,
            visit_date: today,
            diagnosis: 'Routine observation',
            notes: data.notes,
            created_by: user.id
          });
          break;

        case 'weight_measurement':
          if (!data.animal_id) throw new Error('Please select an animal for this activity');
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
          if (!data.animal_id) throw new Error('Please select an animal for this activity');
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

      if (data.is_bulk_feeding) {
        toast({
          title: "Bulk Feeding Recorded",
          description: `${data.original_quantity} ${data.original_unit} (${data.total_kg?.toFixed(2)}kg) distributed across ${data.total_animals} animals`,
        });
      } else {
        toast({
          title: "Success",
          description: "Activity recorded successfully",
        });
      }
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
        <CardDescription>Review and confirm the recorded activity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ActivitySummary
          activityType={data.activity_type}
          animalIdentifier={data.animal_identifier}
          quantity={data.quantity}
          feedType={data.feed_type}
          medicineName={data.medicine_name}
          dosage={data.dosage}
          notes={data.notes}
          isBulkFeeding={data.is_bulk_feeding}
          totalAnimals={data.total_animals}
          originalQuantity={data.original_quantity}
          originalUnit={data.original_unit}
          totalKg={data.total_kg}
        />

        {data.multiple_feeds && editableFeeds.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">Feed Distribution</h3>
            <BulkFeedingTable
              feeds={editableFeeds}
              availableInventory={availableInventory}
              onFeedChange={handleFeedChange}
            />
          </div>
        )}

        {data.is_bulk_feeding && !data.multiple_feeds && data.distributions && (
          <div className="space-y-2">
            <h3 className="font-medium">Feed Distribution</h3>
            <p className="text-sm text-muted-foreground">
              Feed will be distributed proportionally based on animal weights
            </p>
          </div>
        )}

        {/* Type-grouped milk distribution */}
        {data.distributions_by_type && data.distributions_by_type.map((typeGroup) => (
          <div key={typeGroup.livestock_type} className="space-y-2">
            <h3 className="font-medium capitalize">
              {typeGroup.livestock_type} Distribution ({typeGroup.animals} animals)
            </h3>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Animal</th>
                    <th className="text-right p-2 font-medium">Weight</th>
                    <th className="text-right p-2 font-medium">Stage</th>
                    <th className="text-right p-2 font-medium">Proportion</th>
                    <th className="text-right p-2 font-medium">Milk (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {typeGroup.distributions.map((dist, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">
                        <div>
                          <span className="font-medium">{dist.ear_tag}</span>
                          {dist.animal_name && (
                            <span className="text-muted-foreground text-xs ml-1">
                              - {dist.animal_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right p-2">{dist.weight_kg.toFixed(1)} kg</td>
                      <td className="text-right p-2">
                        {dist.milking_stage && (
                          <Badge variant="secondary" className="text-xs">
                            {dist.milking_stage}
                          </Badge>
                        )}
                      </td>
                      <td className="text-right p-2">{(dist.proportion * 100).toFixed(1)}%</td>
                      <td className="text-right p-2 font-medium">{dist.milk_liters.toFixed(2)} L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Distribution is proportional based on animal weights
            </p>
          </div>
        ))}

        {/* Legacy bulk milking display */}
        {data.is_bulk_milking && data.distributions && !data.distributions_by_type && (
          <div className="space-y-2">
            <h3 className="font-medium">Milk Distribution</h3>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Animal</th>
                    <th className="text-right p-2 font-medium">Weight</th>
                    <th className="text-right p-2 font-medium">Stage</th>
                    <th className="text-right p-2 font-medium">Proportion</th>
                    <th className="text-right p-2 font-medium">Milk (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.distributions.map((dist, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">
                        <div>
                          <span className="font-medium">{dist.ear_tag}</span>
                          {dist.animal_name && (
                            <span className="text-muted-foreground text-xs ml-1">
                              - {dist.animal_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right p-2">{dist.weight_kg.toFixed(1)} kg</td>
                      <td className="text-right p-2">
                        {dist.milking_stage && (
                          <Badge variant="secondary" className="text-xs">
                            {dist.milking_stage}
                          </Badge>
                        )}
                      </td>
                      <td className="text-right p-2">{(dist.proportion * 100).toFixed(1)}%</td>
                      <td className="text-right p-2 font-medium">{dist.milk_liters?.toFixed(2)} L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Distribution is proportional based on animal weights
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onCancel} disabled={isSaving} className="flex-1">
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={onCancel} disabled={isSaving} variant="outline" className="flex-1">
            <Mic className="h-4 w-4 mr-2" />
            Re-record
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving} className="flex-1">
            {isSaving ? 'Saving...' : 'Confirm'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityConfirmation;
