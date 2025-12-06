import { format, formatDistanceToNow } from 'date-fns';
import { Flame, Clock, Target, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useHeatRecords } from '@/hooks/useHeatRecords';
import { RecordHeatDialog } from './RecordHeatDialog';
import { DETECTION_METHODS, HEAT_INTENSITY } from '@/lib/bcsDefinitions';

interface HeatHistoryTabProps {
  animalId: string;
  farmId: string;
  animalName?: string;
  gender?: string;
}

export function HeatHistoryTab({ animalId, farmId, animalName, gender }: HeatHistoryTabProps) {
  const { heatRecords, isLoading, averageCycleLength } = useHeatRecords(animalId);

  // Only show for female animals
  if (gender?.toLowerCase() === 'male') {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Heat detection is only applicable for female animals.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const getMethodLabel = (method: string) =>
    DETECTION_METHODS.find((m) => m.value === method)?.label || method;

  const getIntensityBadge = (intensity: string | null) => {
    const colors: Record<string, string> = {
      weak: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      normal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      strong: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[intensity || 'normal'] || colors.normal;
  };

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{heatRecords.length}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {averageCycleLength && (
          <Card className="flex-1 min-w-[140px]">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{averageCycleLength} days</p>
                  <p className="text-sm text-muted-foreground">Avg Cycle Length</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center">
          <RecordHeatDialog
            animalId={animalId}
            farmId={farmId}
            animalName={animalName}
          />
        </div>
      </div>

      {/* Heat History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Heat History</CardTitle>
        </CardHeader>
        <CardContent>
          {heatRecords.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Flame className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No heat records yet</p>
              <p className="text-sm">Record heat signs to track breeding cycles</p>
            </div>
          ) : (
            <div className="space-y-3">
              {heatRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-shrink-0 mt-1">
                    <Flame className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {format(new Date(record.detected_at), 'MMM d, yyyy')}
                      </span>
                      <Badge variant="outline" className={getIntensityBadge(record.intensity)}>
                        {HEAT_INTENSITY.find((i) => i.value === record.intensity)?.label || 'Normal'}
                      </Badge>
                      {record.standing_heat && (
                        <Badge variant="secondary">Standing Heat</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getMethodLabel(record.detection_method)} •{' '}
                      {formatDistanceToNow(new Date(record.detected_at), { addSuffix: true })}
                    </p>
                    {record.optimal_breeding_start && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-green-600 dark:text-green-400">
                        <Target className="h-4 w-4" />
                        Optimal breeding: {format(new Date(record.optimal_breeding_start), 'MMM d, h:mm a')} - {format(new Date(record.optimal_breeding_end!), 'h:mm a')}
                      </div>
                    )}
                    {record.notes && (
                      <p className="text-sm mt-1 text-muted-foreground italic">
                        {record.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
