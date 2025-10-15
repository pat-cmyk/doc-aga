import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

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
    multiple_feeds?: boolean;
    total_animals?: number;
    total_weight_kg?: number;
    total_kg?: number;
    original_quantity?: number;
    original_unit?: string;
    weight_per_unit?: number | null;
    feeds?: Array<{
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
    }>;
    distributions?: Array<{
      animal_id: string;
      animal_name: string;
      ear_tag: string;
      weight_kg: number;
      proportion: number;
      feed_amount: number;
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
      // Find inventory item to get weight_per_unit
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

  // Helper function to deduct from inventory using FIFO
  const deductFromInventory = async (feedType: string, totalKg: number, originalQuantity: number, originalUnit: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current farm ID
      const { data: membership } = await supabase
        .from('farm_memberships')
        .select('farm_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) return;

      // Strategy 1: Try exact match (case-insensitive)
      let { data: inventoryItems } = await supabase
        .from('feed_inventory')
        .select('*')
        .eq('farm_id', membership.farm_id)
        .ilike('feed_type', feedType)
        .gt('quantity_kg', 0)
        .order('created_at', { ascending: true });

      // Strategy 2: If no exact match, try fuzzy contains
      if (!inventoryItems || inventoryItems.length === 0) {
        console.log(`No exact match for "${feedType}", trying fuzzy match...`);
        ({ data: inventoryItems } = await supabase
          .from('feed_inventory')
          .select('*')
          .eq('farm_id', membership.farm_id)
          .ilike('feed_type', `%${feedType}%`)
          .gt('quantity_kg', 0)
          .order('created_at', { ascending: true }));
      }

      // Strategy 3: Special case for "hay" - also search for variations with "bale"
      if ((!inventoryItems || inventoryItems.length === 0) && feedType.toLowerCase().includes('hay')) {
        console.log(`No match for "hay", trying "bale" variations...`);
        ({ data: inventoryItems } = await supabase
          .from('feed_inventory')
          .select('*')
          .eq('farm_id', membership.farm_id)
          .or('feed_type.ilike.%bale%,feed_type.ilike.%hay%')
          .gt('quantity_kg', 0)
          .order('created_at', { ascending: true }));
      }

      // Strategy 4: For "concentrates" - search for items containing that word
      if ((!inventoryItems || inventoryItems.length === 0) && feedType.toLowerCase().includes('concentrate')) {
        console.log(`Searching for concentrate products...`);
        ({ data: inventoryItems } = await supabase
          .from('feed_inventory')
          .select('*')
          .eq('farm_id', membership.farm_id)
          .ilike('feed_type', '%concentrate%')
          .gt('quantity_kg', 0)
          .order('created_at', { ascending: true }));
      }

      // Strategy 5: Extract first significant word (e.g., "corn" from "corn silage")
      if (!inventoryItems || inventoryItems.length === 0) {
        const significantWord = feedType.split(' ')[0];
        if (significantWord.length > 3) {
          console.log(`No matches found, trying first word: "${significantWord}"...`);
          ({ data: inventoryItems } = await supabase
            .from('feed_inventory')
            .select('*')
            .eq('farm_id', membership.farm_id)
            .ilike('feed_type', `%${significantWord}%`)
            .gt('quantity_kg', 0)
            .order('created_at', { ascending: true }));
        }
      }

      console.log(`Feed type: "${feedType}" → Found ${inventoryItems?.length || 0} inventory items`);

      if (!inventoryItems || inventoryItems.length === 0) {
        console.warn(`⚠ No inventory found for feed type: "${feedType}"`);
        console.log('Available inventory items should be checked manually');
        return;
      }

      let remainingToDeduct = totalKg;

      for (const item of inventoryItems) {
        if (remainingToDeduct <= 0) break;

        const deductAmount = Math.min(Number(item.quantity_kg), remainingToDeduct);
        const newBalance = Number(item.quantity_kg) - deductAmount;

        // Update inventory
        await supabase
          .from('feed_inventory')
          .update({ 
            quantity_kg: newBalance,
            last_updated: new Date().toISOString()
          })
          .eq('id', item.id);

        // Create consumption transaction
        await supabase
          .from('feed_stock_transactions')
          .insert({
            feed_inventory_id: item.id,
            transaction_type: 'consumption',
            quantity_change_kg: -deductAmount,
            balance_after: newBalance,
            notes: `Bulk feeding: ${originalQuantity} ${originalUnit} distributed proportionally`,
            created_by: user.id
          });

        remainingToDeduct -= deductAmount;
        console.log(`Deducted ${deductAmount} kg from ${item.feed_type}, remaining: ${remainingToDeduct} kg`);
      }

      if (remainingToDeduct > 0) {
        console.warn(`Could not deduct full amount. Remaining: ${remainingToDeduct} kg`);
      }
    } catch (error) {
      console.error('Error deducting from inventory:', error);
      // Don't throw - we don't want to fail the feeding record if inventory deduction fails
    }
  };

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
          // Handle multiple feed types - use editable feeds if available
          const feedsToProcess = editableFeeds.length > 0 ? editableFeeds : data.feeds;
          if (data.multiple_feeds && feedsToProcess) {
            console.log(`Processing ${feedsToProcess.length} feed types`);
            
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
              
              // Deduct from inventory
              await deductFromInventory(feed.feed_type, feed.total_kg, feed.quantity, feed.unit);
            }
            
            toast({
              title: "Success",
              description: `${data.feeds.length} feed types recorded for ${data.total_animals} animals`,
            });
          } else if (data.is_bulk_feeding && data.distributions) {
            // Bulk feeding - create multiple records
            console.log('Creating bulk feeding records for', data.distributions.length, 'animals');
            console.log('Feed type received:', data.feed_type);
            console.log('Total kg:', data.total_kg);
            
            // CRITICAL VALIDATION: Check if feed_type is present
            if (!data.feed_type) {
              console.error('ERROR: feed_type is missing in bulk feeding data');
              toast({
                title: "Warning",
                description: "Feed type is missing. Inventory won't be updated. Please mention the feed type explicitly.",
                variant: "destructive",
              });
            }
            
            const feedingRecords = data.distributions.map(dist => ({
              animal_id: dist.animal_id,
              record_datetime: new Date().toISOString(),
              kilograms: dist.feed_amount,
              feed_type: data.feed_type,
              notes: `${data.notes || ''} [Bulk: ${data.original_quantity} ${data.original_unit} = ${data.total_kg?.toFixed(2)}kg distributed]`.trim(),
              created_by: user.id
            }));
            
            console.log('Sample feeding record:', feedingRecords[0]);
            
            const { error: bulkError } = await supabase
              .from('feeding_records')
              .insert(feedingRecords);
            
            if (bulkError) throw bulkError;

            // Deduct from inventory using FIFO
            if (data.feed_type && data.total_kg && data.original_quantity && data.original_unit) {
              console.log('✓ Calling deductFromInventory with:', {
                feed_type: data.feed_type,
                total_kg: data.total_kg,
                original_quantity: data.original_quantity,
                original_unit: data.original_unit
              });
              await deductFromInventory(data.feed_type, data.total_kg, data.original_quantity, data.original_unit);
            } else {
              console.warn('⚠ Skipping inventory deduction - missing data:', {
                feed_type: data.feed_type,
                total_kg: data.total_kg,
                original_quantity: data.original_quantity,
                original_unit: data.original_unit
              });
            }
          } else {
            // Single animal feeding
            if (!data.animal_id) throw new Error('Animal not identified');
            console.log('Creating single animal feeding record with feed_type:', data.feed_type);
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

        {/* Animal or Bulk Distribution */}
        {data.multiple_feeds && data.feeds ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Multiple Feed Types</p>
            <Badge variant="secondary">{data.feeds.length} feed types • {data.total_animals} animals</Badge>
            
            {editableFeeds.map((feed, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium min-w-20">Feed Type:</label>
                    <Select 
                      value={feed.feed_type} 
                      onValueChange={(value) => handleFeedChange(idx, 'feed_type', value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableInventory.map(item => (
                          <SelectItem key={item.id} value={item.feed_type}>
                            {item.feed_type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium min-w-20">Quantity:</label>
                    <Input 
                      type="number" 
                      value={feed.quantity}
                      onChange={(e) => handleFeedChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                    <Select 
                      value={feed.unit} 
                      onValueChange={(value) => handleFeedChange(idx, 'unit', value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bags">bags</SelectItem>
                        <SelectItem value="bales">bales</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="buckets">buckets</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      = {feed.total_kg.toFixed(2)} kg
                    </span>
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                  {feed.distributions.slice(0, 3).map(d => (
                    <div key={d.animal_id} className="flex justify-between p-1">
                      <span>{d.animal_name}</span>
                      <span>{d.feed_amount.toFixed(2)} kg</span>
                    </div>
                  ))}
                  {feed.distributions.length > 3 && (
                    <div className="text-muted-foreground">+{feed.distributions.length - 3} more animals</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : data.is_bulk_feeding && data.distributions ? (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Distribution Method
            </p>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 mb-3">
              Proportional (Weight-Based)
            </Badge>
            
            <div className="bg-muted/50 p-3 rounded-lg space-y-1 mb-3">
              {data.feed_type && (
                <p className="text-sm font-medium text-green-700 mb-1">
                  Feed Type: {data.feed_type}
                </p>
              )}
              {!data.feed_type && (
                <p className="text-sm font-medium text-red-600 mb-1">
                  ⚠ Feed type not detected - inventory won't be updated
                </p>
              )}
              <p className="text-sm font-medium">
                Total Feed: {data.original_quantity} {data.original_unit} = {data.total_kg?.toFixed(2)} kg
              </p>
              {data.weight_per_unit && (
                <p className="text-xs text-muted-foreground">
                  ✓ Using {data.weight_per_unit} kg per {data.original_unit} from inventory (FIFO)
                </p>
              )}
              {!data.weight_per_unit && data.original_unit && data.original_unit !== 'kg' && (
                <p className="text-xs text-amber-600">
                  ⚠ Using default weight conversion (no inventory match found)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Distributed across {data.total_animals} animals based on weight
              </p>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3 bg-muted/30">
              {data.distributions.map(dist => (
                <div key={dist.animal_id} className="flex justify-between items-center p-2 bg-background rounded border">
                  <div className="flex-1">
                    <span className="text-sm font-medium">{dist.animal_name}</span>
                    {dist.ear_tag && (
                      <span className="text-xs text-muted-foreground ml-2">#{dist.ear_tag}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Weight: {dist.weight_kg > 0 ? `${dist.weight_kg.toFixed(0)} kg` : 'Unknown'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{dist.feed_amount.toFixed(2)} kg</div>
                    <div className="text-xs text-muted-foreground">
                      ({(dist.proportion * 100).toFixed(1)}%)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Animal</p>
            <p className="text-lg font-semibold">
              {data.animal_identifier || 'Not identified'}
            </p>
            {!data.animal_id && !data.is_bulk_feeding && (
              <p className="text-sm text-destructive mt-1">⚠️ Animal not found in database</p>
            )}
          </div>
        )}

        {/* Quantity - Only show for non-bulk feeding */}
        {data.quantity && !data.is_bulk_feeding && (
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
            disabled={isSaving || (!data.animal_id && !data.is_bulk_feeding && !data.multiple_feeds)}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : data.is_bulk_feeding ? 'Confirm & Distribute' : 'Confirm & Save'}
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
