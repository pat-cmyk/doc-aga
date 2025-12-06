import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Camera, Image, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { MILESTONE_TYPES } from '@/lib/bcsDefinitions';

interface PhotoTimelineTabProps {
  animalId: string;
  animalName?: string;
}

interface AnimalPhoto {
  id: string;
  photo_path: string;
  label: string | null;
  milestone_type: string | null;
  taken_at: string | null;
  created_at: string;
}

export function PhotoTimelineTab({ animalId, animalName }: PhotoTimelineTabProps) {
  const [filterMilestone, setFilterMilestone] = useState<string>('all');

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['animal-photos-timeline', animalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animal_photos')
        .select('*')
        .eq('animal_id', animalId)
        .order('taken_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as AnimalPhoto[];
    },
    enabled: !!animalId,
  });

  const filteredPhotos = filterMilestone === 'all'
    ? photos
    : photos.filter((p) => p.milestone_type === filterMilestone);

  const getMilestoneLabel = (type: string | null) =>
    MILESTONE_TYPES.find((m) => m.value === type)?.label || type || 'Photo';

  const getMilestoneColor = (type: string | null): string => {
    const colors: Record<string, string> = {
      registration: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      first_heat: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      breeding: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      pregnancy_confirmed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      birth: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      weaning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      first_milking: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      checkup: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return colors[type || ''] || 'bg-muted text-muted-foreground';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center justify-between">
        <Select value={filterMilestone} onValueChange={setFilterMilestone}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by milestone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Photos</SelectItem>
            {MILESTONE_TYPES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-sm text-muted-foreground">
          {filteredPhotos.length} photo{filteredPhotos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Timeline */}
      {filteredPhotos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium">No Photos Yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Photos will appear here as milestones are recorded
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {filteredPhotos.map((photo, index) => (
              <div key={photo.id} className="relative flex gap-4 pl-10">
                {/* Timeline Dot */}
                <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                <Card className="flex-1 overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    {/* Photo */}
                    <div className="sm:w-40 h-32 sm:h-auto bg-muted flex-shrink-0">
                      <img
                        src={supabase.storage.from('animal-photos').getPublicUrl(photo.photo_path).data.publicUrl}
                        alt={photo.label || 'Animal photo'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {photo.milestone_type && (
                              <Badge
                                variant="outline"
                                className={getMilestoneColor(photo.milestone_type)}
                              >
                                <Tag className="h-3 w-3 mr-1" />
                                {getMilestoneLabel(photo.milestone_type)}
                              </Badge>
                            )}
                          </div>
                          {photo.label && (
                            <p className="font-medium mt-1">{photo.label}</p>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(
                            new Date(photo.taken_at || photo.created_at),
                            'MMM d, yyyy'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
