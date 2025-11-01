import { Badge } from "@/components/ui/badge";

interface ActivitySummaryProps {
  activityType: string;
  animalIdentifier?: string;
  quantity?: number;
  feedType?: string;
  medicineName?: string;
  dosage?: string;
  notes?: string;
  isBulkFeeding?: boolean;
  totalAnimals?: number;
  originalQuantity?: number;
  originalUnit?: string;
  totalKg?: number;
}

/**
 * Helper function to get activity label from type
 */
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

/**
 * Helper function to get activity color for badge
 */
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

/**
 * Component displaying a summary of activity details for confirmation
 */
export const ActivitySummary = ({
  activityType,
  animalIdentifier,
  quantity,
  feedType,
  medicineName,
  dosage,
  notes,
  isBulkFeeding,
  totalAnimals,
  originalQuantity,
  originalUnit,
  totalKg
}: ActivitySummaryProps) => {
  return (
    <div className="space-y-3">
      <div>
        <span className="text-sm text-muted-foreground">Activity Type</span>
        <div className="mt-1">
          <Badge className={getActivityColor(activityType)} variant="outline">
            {getActivityLabel(activityType)}
          </Badge>
        </div>
      </div>

      {animalIdentifier && !isBulkFeeding && (
        <div>
          <span className="text-sm text-muted-foreground">Animal</span>
          <p className="font-medium">{animalIdentifier}</p>
        </div>
      )}

      {isBulkFeeding && totalAnimals && (
        <div>
          <span className="text-sm text-muted-foreground">Distribution</span>
          <p className="font-medium">
            {totalAnimals} animals • {originalQuantity} {originalUnit} ({totalKg?.toFixed(2)} kg total)
          </p>
        </div>
      )}

      {quantity !== undefined && !isBulkFeeding && (
        <div>
          <span className="text-sm text-muted-foreground">Quantity</span>
          <p className="font-medium">{quantity} {activityType === 'milking' ? 'liters' : 'kg'}</p>
        </div>
      )}

      {feedType && (
        <div>
          <span className="text-sm text-muted-foreground">Feed Type</span>
          <p className="font-medium">{feedType}</p>
        </div>
      )}

      {medicineName && (
        <div>
          <span className="text-sm text-muted-foreground">Medicine</span>
          <p className="font-medium">{medicineName}</p>
        </div>
      )}

      {dosage && (
        <div>
          <span className="text-sm text-muted-foreground">Dosage</span>
          <p className="font-medium">{dosage}</p>
        </div>
      )}

      {notes && (
        <div>
          <span className="text-sm text-muted-foreground">Notes</span>
          <p className="text-sm">{notes}</p>
        </div>
      )}
    </div>
  );
};
